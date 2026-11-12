# Upgrade notes

Steps an operator must take when deploying a build over an existing environment. Newest release first. Queue-level details live in [observability.md](observability.md) ("One-time upgrade: recreate consumer queues").

## November 2026 backlog release (branch `chore/local-dev-fixes`)

Covers cookie sessions, requester-scoped authorization on exam/live/files, consumer retries with backoff, attempt versioning, tag IDs, Google Calendar tokens kept server-side, and UTC login streaks.

### 1. Release backend and frontend together

The HTTP contract changed in ways an old frontend can't handle, and an old backend can't serve the new frontend:

- **Cookie auth**: login, register, refresh and Google token exchange return `data: null` and set HttpOnly `access_token` / `refresh_token` cookies. The frontend must send credentials (`credentials: 'include'` / `withCredentials`), refresh with `POST /auth/refresh` and no body, and log out with `POST /auth/logout`. `POST /auth/logout` only clears this browser's cookies: the refresh token stays valid until it expires. `POST /auth/logout-all` revokes every token of the identity (use it for "log out everywhere" or a suspected token leak).
- **Password change** requires `currentPassword` (401 "Wrong password" otherwise).
- **Exam tags** are added and removed by tag **ID**, not name.
- **Google Calendar**: `GET .../google/calendar/token` returns `{ accessToken, expiresAt }`; connect/exchange return `{ connected, expiresAt }`. Refresh tokens no longer leave the server.

Also deploy **gateway and auth together**: the three Google Calendar RPCs changed their return types, so a mixed-version pair fails those routes.

### 2. Frontend and API must be same-site (proxy `/api` and `/socket.io` through the frontend)

Cookies are `SameSite=Lax`, so the browser must see the frontend and the API as one site. A cross-site frontend can't store the cookies, `CookieIssuanceGuard` refuses its cookie-issuing requests with 403, and the socket handshake arrives without the access cookie. Note that hosts under a public suffix such as `servebeer.com` or `ddns.net` are **different sites** even when they share that suffix (`app.servebeer.com` and `meowlish.servebeer.com` are cross-site).

The supported setup: the frontend calls the API on **its own origin** and proxies to the gateway:

- `/api/*` -> gateway `/api/*` (this also carries `GET /api/v1/auth/google/callback`, so set `BASE_URL` to the **frontend's** public origin: Google must redirect back through the proxy, where the `oauth2_state` cookie of the linking flow lives);
- `/socket.io/*` -> gateway `/api/v1/chat/ws/socket.io/*`. WebSocket upgrades need a reverse proxy that forwards them (nginx/Envoy, or `next start` itself); without one socket.io falls back to long-polling.

The frontend's Next.js config does both rewrites (target: `NEXT_PUBLIC_API_URL`). In production, prefer a reverse proxy in front of both that routes these paths straight to the gateway: Next's built-in proxy does not add `X-Forwarded-For`, so the gateway sees the Next server as every client's address (shared rate-limit buckets) unless a proxy in front sets it and `TRUST_PROXY` counts both hops. That matters more on the strict auth routes (login, register, refresh, add mail credential, change password): besides 10/min per IP and account, each is capped at 100/min per client IP, so with one shared address all users together get 100 logins a minute.

Alternatively serve frontend and API on hosts of one registrable domain (`app.example.com` + `api.example.com`) and let the frontend call the API directly.

Either way, **`CORS_ORIGINS` (gateway and live) must include the frontend origin**: when the frontend calls the API directly for CORS, and behind the proxy too, because the browser still sends `Origin: <frontend>`, which `CookieIssuanceGuard` and live's socket handshake check against that list. See backlog S15 for the remaining limits.

### 3. Configuration

Set these before starting the new build (`docker/.env.services`, or each app's `.env`):

| Variable                 | Where                         | Value                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CORS_ORIGINS`           | gateway, live                 | Comma-separated frontend origins (no `*`, credentials are on). **Unset in production means no cross-origin access**, so the frontend is refused, and live refuses socket handshakes from other origins.                                    |
| `TRUST_PROXY`            | gateway                       | `1` behind the bundled Envoy (one trusted hop; Envoy sets `X-Forwarded-For`). With `false` behind a proxy, every client shares one rate-limit bucket.                                                                                      |
| `CURSOR_SECRET`          | auth, exam, achievement, live | At least 32 chars (`openssl rand -hex 32`). Unset means a random key per process, so pagination cursors break on restart and differ between replicas.                                                                                      |
| `JWT_PUBLIC_KEY`         | live (new), gateway           | The RS256 public key. live now verifies socket tokens itself and refuses every connection without it.                                                                                                                                      |
| `FE_LOGIN_REDIRECT_URL`  | gateway                       | The frontend's Google login callback page, e.g. `https://app.example.com/auth/callback` (locally `http://localhost:6767/auth/callback`). The frontend root redirects and drops `?loginToken`, so Google login fails if this points at `/`. |
| `FILE_SERVICE_HOST/PORT` | resource (new)                | file-service gRPC address. Resource now checks file ownership when attaching files to reports.                                                                                                                                             |

### 4. Database

Run in this order:

1. **Stop the achievement consumers** (the achievement container). Migration `20261112152409_count_first_login_day` adds +1 to every `login_criteria` row's `total` and `longest_streak` (the first login day was never counted). Logins processed by the old consumer while or after it runs use the old counting rules on corrected rows, so stop it first. Queued `user.login` events wait in RabbitMQ and are processed by the new build.
2. `prisma migrate deploy` for **achievement**, **exam** (`attempt_version_scorer_data_cascade`: attempt version column, cascading scorer data) and **file-service** (`add_file_uploaded_by`, `add_file_is_system`). `pnpm db:setup` does all of it locally.
3. `prisma db push` for **live** (`Room.createdBy`), then re-run the **authorization seed**, which backfills `createdBy` from the authorization service's room ownership rows. Rooms without an ownership row stay `NULL`, so only admins can moderate them.
4. Start the new build.

After the release:

- Files uploaded before it have no `uploadedBy`. Only admins can attach them. The current avatar keeps working.
- Achievement login badges catch up at each user's next login.

### 5. RabbitMQ

- Delete `exam.events.writing.scored` once (check it is empty first). Its dead-letter arguments changed, so redeclaring it fails with `PRECONDITION_FAILED` and exam won't consume. Its DLQ is now `exam.events.writing.scored.dlq`. The old `exam.retry` / `exam.dlx` exchanges and `exam.retry.writing-scored.{1,2,3}` / `exam.writing.result.dlq` queues can be deleted once empty.
- If you are upgrading from a build before the outbox/inbox change, also delete the consumer queues listed in [observability.md](observability.md#delete-the-queues), then start consumers before publishers.
- The new `<q>.retry.1..5` queues are created on startup.
