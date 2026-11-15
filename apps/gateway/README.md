# gateway

The only HTTP entry point of the backend. It serves the REST API under `/api/v1/*`, verifies the session JWT (RS256 public key), applies rate limits and the role, permission and ownership guards, then forwards each call to the owning microservice over gRPC. It also proxies the live chat socket.io traffic and the notification SSE stream, and serves the API reference at `/reference`. It has no database and holds no business logic.

## Tech used

| Technology                                              | What for                                                                                                                                                                                                                     | Where                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| NestJS on Express (HTTP)                                | REST API, global prefix `api`, URI versioning (default `1`), CORS with credentials, `trust proxy`                                                                                                                            | `src/bootstrap.ts`, `src/cors.ts`                                                                                |
| `RouterModule`                                          | Path prefixes per backend (`/auth`, `/exams`, `/files`, `/achievements`, `/chat`, `/chat/ws`, `/notifications`, `/resources`)                                                                                                | `src/router.module.ts`                                                                                           |
| gRPC clients (`@nestjs/microservices`, `@grpc/grpc-js`) | Calls to auth, authorization, exam, file-service, achievement, live, notification, resource                                                                                                                                  | `src/*-gateway/*.router.module.ts`                                                                               |
| Passport (`@nestjs/passport`, `passport-jwt`)           | Strategies `access-jwt` and `refresh-jwt`: read the `access_token` / `refresh_token` cookie, then `Authorization: Bearer`; verify RS256; ask auth `ValidateAccess` / `ValidateRefresh` (revocation, locked accounts)         | `src/auth-gateway/strategies/jwt.strategy.ts`, `jwt-refresh.strategy.ts`                                         |
| Passport (`passport-google-oauth20`)                    | Strategy `google`: Google sign-in and account linking, then auth `RegisterOrLoginGoogle` / `AddGoogleCredential`                                                                                                             | `src/auth-gateway/strategies/google-oauth2.strategy.ts`, `src/auth/guards/google-oauth2.guard.ts`                |
| Global guards                                           | `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard` → `ResourceAccessGuard` (calls authorization `CheckOwnership`); route-level `CookieIssuanceGuard` on cookie-setting routes                             | `src/gateway.module.ts`, `src/auth/guards/`                                                                      |
| `@nestjs/throttler`                                     | Rate limits: `default` 100/min per route per IP+account (per IP when signed out); strict auth routes 10/min per IP+account plus `ip` 100/min per IP; answer autosave 300/min. `jsonwebtoken` decodes the subject for the key | `src/throttle.ts`                                                                                                |
| Redis via `ioredis` (throttler storage)                 | `RedisThrottlerStorage`: one Lua script per hit, counters shared by every gateway replica; falls back to in-memory counting while Redis is down (fail open, one warning)                                                     | `src/throttle-storage.ts`                                                                                        |
| Redis via `@liaoliaots/nestjs-redis`                    | Google OAuth state and the one-time login token handed to the frontend                                                                                                                                                       | `src/auth-gateway/auth.router.module.ts`, `src/configs/redis.config.ts`                                          |
| `http-proxy-middleware`                                 | Proxies `/api/v1/chat/ws/socket.io` (HTTP polling and WebSocket upgrades) to live, and `/api/v1/notifications/stream/:recipientId` (SSE) to notification's HTTP port                                                         | `src/live-ws-gateway/live-ws.router.controller.ts`, `src/notification-gateway/notification.router.controller.ts` |
| `@nestjs/swagger` + `@scalar/nestjs-api-reference`      | OpenAPI document built from decorators, served at `/reference`                                                                                                                                                               | `src/bootstrap.ts`                                                                                               |
| `@server/utils`                                         | Validation pipe, response envelope interceptor, gRPC → HTTP exception filters                                                                                                                                                | `src/gateway.module.ts`                                                                                          |
| OpenTelemetry + health (`@server/telemetry`)            | `startTelemetry` in `main.ts`; `HealthModule` (`rabbitmq: false`) serves `/health/live`, `/health/ready` outside the `/api` prefix                                                                                           | `src/main.ts`, `src/gateway.module.ts`                                                                           |
| zod (`zod/v4`)                                          | Env validation                                                                                                                                                                                                               | `src/configs/config.ts`                                                                                          |

No Postgres, no RabbitMQ, no BullMQ.

## Talks to

| Route prefix                | Controller                                                                                | Backend                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/auth`              | `auth-gateway/auth.router.controller.ts`                                                  | auth gRPC `AuthService`; Redis                                                                                             |
| `/api/v1/exams`             | `exam-gateway/` (`management`, `practice`, `tags`, `goals`)                               | exam gRPC `ExamManagementService`, `ExamPracticeService`, `TagService`, `GoalService`                                      |
| `/api/v1/files`             | `file-gateway/file.router.controller.ts`                                                  | file-service gRPC `FileService`                                                                                            |
| `/api/v1/achievements`      | `achievement-gateway/achievement.router.controller.ts` (`badges`)                         | achievement gRPC `AchievementService`                                                                                      |
| `/api/v1/chat`              | `live-gateway/live.router.controller.ts` (`rooms`)                                        | live gRPC `ChatService`                                                                                                    |
| `/api/v1/chat/ws/socket.io` | `live-ws-gateway/live-ws.router.controller.ts`                                            | HTTP/WebSocket proxy to live (`LIVE_SERVICE_WS_*`, 1511)                                                                   |
| `/api/v1/notifications`     | `notification-gateway/notification.router.controller.ts`                                  | notification gRPC; `stream/:recipientId` proxied to notification HTTP (SSE), only when `recipientId` is the caller's `sub` |
| `/api/v1/resources`         | `resource-gateway/` (blogs, comments, flash cards and lists, proposals, reports, `forum`) | resource gRPC (all seven services)                                                                                         |
| (every guarded route)       | `auth/guards/resource-access.guard.ts`                                                    | authorization gRPC `CheckOwnership` for `@ResourceAccess` routes                                                           |

Nothing calls the gateway except the frontend (which proxies `/api/*` and `/socket.io/*` to it) and the Envoy edge proxy in Docker. It publishes and consumes no events.

Session tokens travel in HttpOnly cookies (`access_token`, `refresh_token`), set and cleared in `src/auth-gateway/auth-cookies.ts`; see [authorization.md](../../docs/architecture/authorization.md) for the guards and the requester pattern.

## Data

No database. Redis keys:

| Key                               | TTL    | Written by                                    | Purpose                                                       |
| --------------------------------- | ------ | --------------------------------------------- | ------------------------------------------------------------- |
| `oauth2:google:loginToken:<uuid>` | 60 s   | `auth.router.controller.ts` (Google callback) | One-time token the frontend exchanges for cookies (`getdel`)  |
| `gateway:oauth2:state:<nonce>`    | 300 s  | `auth/guards/google-oauth2.guard.ts`          | OAuth `state`: frontend origin and, for linking, the identity |
| `throttle:<key>:hits`             | window | `throttle-storage.ts`                         | Rate-limit hit counter                                        |
| `throttle:<key>:block`            | block  | `throttle-storage.ts`                         | Rate-limit block marker                                       |

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT`: mode and HTTP listener.
- `BASE_URL`: public URL of the gateway (Google callback). `FE_LOGIN_REDIRECT_URL`: frontend page that receives `?loginToken`. `GOOGLE_OAUTH_FRONTENDS`: extra frontend origins allowed to run the Google flow.
- `JWT_PUBLIC_KEY`: RS256 public key matching auth's private key.
- `GOOGLE_OA2_CLIENT_ID`, `GOOGLE_OA2_CLIENT_SECRET`: Google OAuth client.
- `REDIS_HOST`, `REDIS_PORT`.
- `<SVC>_SERVICE_HOST` / `<SVC>_SERVICE_PORT` (optional `<SVC>_SERVICE_URL` override) for `AUTH`, `AUTHORIZATION`, `EXAM`, `ACHIEVEMENT`, `RESOURCE`, `FILE`, `LIVE`, `NOTIFICATION`; plus `LIVE_SERVICE_WS_HOST`/`_PORT` (or `LIVE_SERVICE_WS_URL`) and `NOTIFICATION_SERVICE_HTTP_PORT` (or `NOTIFICATION_SERVICE_SSE_URL`) for the proxies.
- `CORS_ORIGINS`: allowed origins (defaults to the local frontends outside production). `TRUST_PROXY`: `false`, `true` or a hop count, for the client IP used by rate limiting.
- `OTEL_EXPORTER_OTLP_ENDPOINT` (or `OTEL_SDK_DISABLED=true`).

## Running

```sh
pnpm exec nx run gateway:serve   # builds, then runs on PORT (3000)
pnpm exec nx run gateway:test
pnpm exec nx run gateway:lint
pnpm exec nx run gateway:build
```

Ports: HTTP 3000 (API, `/reference`, `/health/*`). In Docker it is reached through `envoy-gateway` on host port 8080. It needs Redis and the gRPC services; no Prisma targets.

## More

- Flows per route: [operation flows](../../docs/architecture/README.md#operation-flows) (every flow starts at the gateway).
- Guards, cookies, throttling: [authorization.md](../../docs/architecture/authorization.md).
- Architecture overview: [docs/architecture/README.md](../../docs/architecture/README.md).
