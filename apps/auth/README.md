# auth

Owns user accounts: identities, login credentials (mail + password, Google), roles and permissions, and Google Calendar tokens. It signs the RS256 access and refresh tokens (it alone holds the private key), rotates refresh tokens with reuse detection, revokes sessions, and locks accounts. It also tracks avatar file references for file-service.

## Tech used

| Technology                                                    | What for                                                                                                                                                                                                    | Where                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| NestJS gRPC (`Transport.GRPC`)                                | `AuthService` on `HOST:PORT`; HTTP listener on `HEALTH_PORT` for health only                                                                                                                                | `src/bootstrap.ts`, `src/presentation/controllers/auth.controller.ts`                     |
| CQRS (`@nestjs/cqrs`)                                         | Command and query handlers                                                                                                                                                                                  | `src/app/commands/handlers/`, `src/app/queries/handlers/`                                 |
| Prisma + Postgres `auth_db` (migrations)                      | Identities, credentials, roles, Google Calendar tokens; `prisma/migrations/`. A Postgres trigger (`src/sql/trig_file_change.sql`, installed by a migration) writes released avatar ids into `deleted_files` | `prisma/schema/auth.prisma`, `src/infra/repositories/`                                    |
| `nestjs-cls` + `@nestjs-cls/transactional`                    | Transactions (`@Transactional()`, `TransactionHost`)                                                                                                                                                        | `src/auth.module.ts`                                                                      |
| `@nestjs/jwt`                                                 | Two RS256 signers (`JWT_ACCESS_TOKEN`, `JWT_REFRESH_TOKEN`)                                                                                                                                                 | `src/configs/jwt.config.ts`, `jwt-refresh.config.ts`, `src/app/services/token.service.ts` |
| `bcrypt`                                                      | Password hashes                                                                                                                                                                                             | `src/domain/entities/credential.entity.ts`                                                |
| Redis via `@liaoliaots/nestjs-redis`                          | Session revocation timestamps and refresh-token rotation records                                                                                                                                            | `src/configs/redis.config.ts`, `src/app/services/token.service.ts`                        |
| BullMQ (`@nestjs/bullmq`, queue `auth`)                       | Repeatable job `publish-deleted-files` every 60 s: drains `deleted_files` into `auth.files.removed`                                                                                                         | `src/app/events/publisher/files-removed.publisher.ts`                                     |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging` | `OutboxPublisher` + `OutboxRelay` (`relay: true`, connection `pub`). A `sub` connection is also opened, but auth has no consumers                                                                           | `src/auth.module.ts`, `src/configs/rmq.*.config.ts`, `src/app/events/publisher/`          |
| file-service gRPC client (`file.FileServiceClient`)           | `GetUrls` (avatar URLs in find/hydrate queries), `CheckFilesOwnedBy` (avatar must be uploaded by the user)                                                                                                  | `src/app/queries/handlers/*.handler.ts`, `src/app/services/file-ownership.service.ts`     |
| Google OAuth token endpoint (`fetch`)                         | Refreshes a user's Google Calendar access token (`https://oauth2.googleapis.com/token`)                                                                                                                     | `src/app/queries/handlers/get-google-calendar-token.handler.ts`                           |
| OpenTelemetry + health (`@server/telemetry`)                  | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                                                                                               | `src/main.ts`, `src/auth.module.ts`                                                       |

## Talks to

- **Called by**: the gateway (every `/auth/*` route, JWT strategies `ValidateAccess` / `ValidateRefresh`, Google strategy), live (`ValidateAccess` on each socket handshake), notification (`FindIdentityIdsByRole` to find admins for a new report).
- **Calls**: file-service gRPC (`GetUrls`, `CheckFilesOwnedBy`); Google's OAuth token endpoint.
- **gRPC `AuthService`** (`proto/auth.proto`): `RegisterMail`, `LoginMail`, `AddMailCredential`, `UpdateMailPassword`, `RegisterOrLoginGoogle`, `AddGoogleCredential`, `GetCredentials`, `RemoveCredential`, `Refresh`, `ValidateRefresh`, `ValidateAccess`, `LogOutAll`, `GetRoleList`, `GetPermList`, `AssignRoleTo`, `RemoveRoleFrom`, `UpdateIdentity`, `LockIdentity`, `UnlockIdentity`, `ConnectGoogleCalendar`, `DisconnectGoogleCalendar`, `GetGoogleCalendarToken`, `RefreshGoogleCalendarToken`, `FindIdentityIds`, `FindIdentityIdsByRole`, `FindIdentities`, `FindIdentitiesByPhone`, `HydrateIdentities`, `HydrateIdentity`.

Events published (all through the outbox, envelope format):

| Routing key          | When                                            | Consumer queue → service                                         |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `auth.user.login`    | Mail login, Google login to an existing account | `achievement.events.user.login` → achievement (login badges)     |
| `auth.user.locked`   | `LockIdentity`                                  | `live.events.user.locked` → live (disconnect the user's sockets) |
| `auth.file.added`    | Avatar set                                      | `file.events.file.added` → file-service (`ref_count + 1`)        |
| `auth.files.removed` | BullMQ job, every 60 s, from `deleted_files`    | `file.events.files.removed` → file-service (decrement)           |

Consumes nothing.

## Data

Postgres `auth_db`, schema `prisma/schema/auth.prisma`:

| Table                    | Key columns                                                                                                                                                         | Purpose                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `identities`             | `id`, `version`, `username` (unique), `full_name`, `bio`, `avatar_file_id`, `phone_number` (unique), `is_locked`, `locked_at`, `locked_by`, `is_demo`, `deleted_at` | A user account; `is_demo` blocks actions that would affect other testers of the shared demo account |
| `credentials`            | `id`, `identity_id` (→ identity, cascade), `identifier`, `secret_hash?`, `login_type`; unique `(identifier, login_type)`, `(identity_id, login_type)`               | Login methods (mail + bcrypt hash, Google id), one per type per identity                            |
| `roles`                  | `id`, `name` (unique)                                                                                                                                               | Role catalogue, seeded from the `Role` enum                                                         |
| `permissions`            | `id`, `name` (unique)                                                                                                                                               | Permission catalogue, seeded from the `Permission` enum                                             |
| `roles_permissions`      | PK `(role_id, permission_id)`                                                                                                                                       | Role → permission mapping (`prisma/seed.ts`)                                                        |
| `identity_roles`         | PK `(identity_id, role_id)`                                                                                                                                         | Role assignment                                                                                     |
| `deleted_files`          | `file_id` PK, `count`                                                                                                                                               | Released avatar references, drained every 60 s into `auth.files.removed`                            |
| `google_calendar_tokens` | `id`, `identity_id` (unique, cascade), `access_token`, `refresh_token`, `expires_at`, `scopes`                                                                      | Google Calendar OAuth tokens kept server-side (refresh token never returned)                        |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)).

Redis keys (`src/app/services/token.service.ts`; TTL = refresh-token lifetime):

| Key                                    | Purpose                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jwt:blacklist:user:<identityId>`      | Revocation time; tokens issued before it are rejected (logout-all, password change, role assign/remove). Locked accounts are refused by `ValidateAccess` from `is_locked` |
| `auth:refresh:used:<jti>`              | `SET NX` when a refresh token is exchanged: its family and successor (reuse detection)                                                                                    |
| `auth:refresh:family:<family>:revoked` | Set when a used refresh token is replayed after the grace period: the whole family is dead                                                                                |

BullMQ also keeps its own keys for queue `auth`.

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT` (gRPC), `HEALTH_PORT`.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `REDIS_HOST`, `REDIS_PORT` (revocation, rotation, BullMQ).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `FILE_SERVICE_HOST`, `FILE_SERVICE_PORT` (optional `FILE_SERVICE_URL`).
- `JWT_PRIVATE_KEY` (RS256), `JWT_ACCESS_TOKEN_EXPIRATION` (default 900 s), `JWT_REFRESH_TOKEN_EXPIRATION` (default 604800 s).
- `GOOGLE_OA2_CLIENT_ID`, `GOOGLE_OA2_CLIENT_SECRET` (Google Calendar token refresh).
- `CURSOR_SECRET`: signs pagination cursors (random per process when unset).
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run auth:prisma:generate
pnpm exec nx run auth:prisma:migrate -- --name <change>   # dev; production config runs migrate deploy
pnpm exec nx run auth:prisma:seed                        # roles, permissions, demo users
pnpm exec nx run auth:serve
pnpm exec nx run auth:test
```

Also `prisma:push` and `prisma:migrate:reset` (disabled in production). Ports: gRPC 50051 locally (`.env.example`), 50050 in Docker; health 9101. Docker host access through `envoy-auth` on 8081. Needs Postgres, Redis, RabbitMQ and file-service.

## More

- Flows: [flows/auth.md](../../docs/architecture/flows/auth.md).
- Events, outbox, inbox: [messaging.md](../../docs/architecture/messaging.md).
- Tokens and guards: [authorization.md](../../docs/architecture/authorization.md).
