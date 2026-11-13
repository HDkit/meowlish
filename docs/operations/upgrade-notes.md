# Upgrade notes

Steps an operator must take when deploying a build over an existing environment. Newest release first. Queue-level details live in [observability.md](observability.md) ("One-time upgrade: recreate consumer queues").

## November 2026 backlog release (branch `chore/local-dev-fixes`)

Covers cookie sessions, requester-scoped authorization on exam/live/files, consumer retries with backoff, attempt versioning, tag IDs, Google Calendar tokens kept server-side, and UTC login streaks.

### 1. Release backend and frontend together

The HTTP contract changed in ways an old frontend can't handle, and an old backend can't serve the new frontend:

- **Cookie auth**: login, register, refresh and Google token exchange return `data: null` and set HttpOnly `access_token` / `refresh_token` cookies. The frontend must send credentials (`credentials: 'include'` / `withCredentials`), refresh with `POST /auth/refresh` and no body, and log out with `POST /auth/logout`. `POST /auth/logout` only clears this browser's cookies: the refresh token stays valid until it expires. `POST /auth/logout-all` revokes every token of the identity (use it for "log out everywhere" or a suspected token leak).
- **Google login exchange** is `POST /auth/google/tokens` with a JSON body `{ "loginToken": "…" }` (was `GET ?loginToken=`). Non-JSON bodies get 415, so a cross-site form can't trigger it.
- **Password change** requires `currentPassword` (401 "Wrong password" otherwise).
- **Exam tags** are added and removed by tag **ID**, not name.
- **Google Calendar**: `GET .../google/calendar/token` returns `{ accessToken, expiresAt }`; connect/exchange return `{ connected, expiresAt }`. Refresh tokens no longer leave the server.

Also deploy **gateway and auth together**: the three Google Calendar RPCs changed their return types, so a mixed-version pair fails those routes.

### 2. The browser talks only to the frontend origin (proxy `/api` and `/socket.io`)

The frontend and the API **may be on different sites** (e.g. `app.servebeer.com` and `meowlish.servebeer.com`, which are cross-site because `servebeer.com` is a public suffix, or two unrelated domains). This works because the browser never calls the API host directly: the frontend proxies to the gateway, so the session cookies are first-party cookies of the **frontend host**, and `SameSite=Lax` never comes into play.

- `/api/*` -> gateway `/api/*`. This also carries `GET /api/v1/auth/google/callback`, so set `BASE_URL` to the **frontend's** public origin: Google must redirect back through the proxy, where the `oauth2_state` cookie of the linking flow lives.
- `/socket.io/*` -> gateway `/api/v1/chat/ws/socket.io/*`. WebSocket upgrades need a proxy that forwards them (nginx/Envoy, or `next start` itself); without one socket.io falls back to long-polling.

The frontend's Next.js config does both rewrites (target: `NEXT_PUBLIC_API_URL`, which may be any host). Calling the API host directly from the browser is **not supported** when it is cross-site: the cookies would be third-party, which Safari and Firefox block and `SameSite=Lax` refuses on fetch. (Same-site direct calls, e.g. `app.example.com` -> `api.example.com`, still work.)

**`CORS_ORIGINS` (gateway and live) must include the frontend origin.** Behind the proxy the browser still sends `Origin: <frontend>`, which `CookieIssuanceGuard` and live's socket handshake check against that list.

**Client IPs and `TRUST_PROXY`.** Rate limits key on the client IP (strict auth routes: 10/min per IP and account, plus 100/min per IP). Next's rewrite proxy forwards the incoming `X-Forwarded-For` unchanged and does not append its own entry, so set `TRUST_PROXY` to the number of proxies that **append** to `X-Forwarded-For` (nginx, Envoy, Caddy, a load balancer); Next does not count:

| Path from the browser                                                      | `TRUST_PROXY` | Gateway sees                    |
| -------------------------------------------------------------------------- | ------------- | ------------------------------- |
| reverse proxy (routes `/api`, `/socket.io` straight to gateway) -> gateway | `1`           | the real client                 |
| reverse proxy -> Next -> gateway                                           | `1`           | the real client                 |
| reverse proxy -> Next -> bundled Envoy -> gateway                          | `2`           | the real client                 |
| Next -> bundled Envoy -> gateway (nothing in front of Next)                | `1`           | the Next server, for every user |
| Next -> gateway (nothing in front of Next)                                 | `false`       | the Next server, for every user |

Never set it higher than the number of appending proxies: the gateway would then believe an `X-Forwarded-For` the client wrote itself, and anyone could pick their own rate-limit bucket. When every user shows up as the Next server, all of them share one bucket (100 logins a minute in total), so put a reverse proxy in front of Next in production.

### 3. Configuration

Set these before starting the new build (`docker/.env.services`, or each app's `.env`):

| Variable                 | Where                         | Value                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CORS_ORIGINS`           | gateway, live                 | Comma-separated frontend origins (no `*`, credentials are on). **Unset in production means no cross-origin access**, so the frontend is refused, and live refuses socket handshakes from other origins.                                    |
| `TRUST_PROXY`            | gateway                       | The number of proxies that append to `X-Forwarded-For` (Next's rewrite proxy doesn't); see the table in section 2. `1` behind the bundled Envoy alone. Too high lets clients spoof their IP; too low makes clients share one bucket.       |
| `CURSOR_SECRET`          | auth, exam, achievement, live | At least 32 chars (`openssl rand -hex 32`). Unset means a random key per process, so pagination cursors break on restart and differ between replicas.                                                                                      |
| `JWT_PUBLIC_KEY`         | live (new), gateway           | The RS256 public key. live now verifies socket tokens itself and refuses every connection without it.                                                                                                                                      |
| `FE_LOGIN_REDIRECT_URL`  | gateway                       | The frontend's Google login callback page, e.g. `https://app.example.com/auth/callback` (locally `http://localhost:6767/auth/callback`). The frontend root redirects and drops `?loginToken`, so Google login fails if this points at `/`. |
| `FILE_SERVICE_HOST/PORT` | resource (new)                | file-service gRPC address. Resource now checks file ownership when attaching files to reports.                                                                                                                                             |

### 3a. Mock AI scorer (dev and staging only)

`apps/mock-ai-scorer` is a stand-in for the external AI writing scorer. It consumes `exam.writing.submitted` from the `mock-ai-scorer.writing.submitted` queue and publishes random IELTS scores (4.0-8.5, no real AI) on `exam.writing.scored` after a random delay. Docker starts it only with `--profile mock-ai`.

| Variable                   | Default  | Meaning                                                        |
| -------------------------- | -------- | -------------------------------------------------------------- |
| `MOCK_SCORER_MIN_DELAY_MS` | `60000`  | Lower bound of the random delay before scoring (<= max).       |
| `MOCK_SCORER_MAX_DELAY_MS` | `180000` | Upper bound of the random delay.                               |
| `RMQ_*`, `HEALTH_PORT`     | -        | Same as the other services; health is served on `HEALTH_PORT`. |

**Never run it in production or alongside the real AI scorer.** Both would consume `exam.writing.submitted` (each with its own queue, so every submission is scored twice and the later result overwrites the earlier one).

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
