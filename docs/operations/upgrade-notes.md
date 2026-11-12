# Upgrade notes

Steps an operator must take when deploying a build over an existing environment. Newest release first. Queue-level details live in [observability.md](observability.md) ("One-time upgrade: recreate consumer queues").

## November 2026 backlog release (branch `chore/local-dev-fixes`)

Covers cookie sessions, requester-scoped authorization on exam/live/files, consumer retries with backoff, attempt versioning, tag IDs, Google Calendar tokens kept server-side, and UTC login streaks.

### 1. Release backend and frontend together

The HTTP contract changed in ways an old frontend can't handle, and an old backend can't serve the new frontend:

- **Cookie auth**: login, register, refresh and Google token exchange return `data: null` and set HttpOnly `access_token` / `refresh_token` cookies. The frontend must send credentials (`credentials: 'include'` / `withCredentials`), refresh with `POST /auth/refresh` and no body, and log out with `POST /auth/logout`.
- **Password change** requires `currentPassword` (401 "Wrong password" otherwise).
- **Exam tags** are added and removed by tag **ID**, not name.
- **Google Calendar**: `GET .../google/calendar/token` returns `{ accessToken, expiresAt }`; connect/exchange return `{ connected, expiresAt }`. Refresh tokens no longer leave the server.

Also deploy **gateway and auth together**: the three Google Calendar RPCs changed their return types, so a mixed-version pair fails those routes.

### 2. Frontend and API must be same-site

Cookies are `SameSite=Lax`, so the frontend and the API must share a registrable domain (e.g. `app.example.com` + `api.example.com`; different ports or subdomains are fine). A cross-site frontend can't store the cookies, and `CookieIssuanceGuard` refuses cross-site cookie-issuing requests with 403. See backlog S15 for the remaining limits.

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
