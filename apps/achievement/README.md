# achievement

Awards badges. It listens to login and exam-attempt events, keeps per-user counters (login days and streak, attempts taken, good and perfect scores), and when a threshold is reached records the badge and announces it so notification can tell the user. It also serves the badge catalogue and each user's badges and progress.

## Tech used

| Technology                                                    | What for                                                                                                                             | Where                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| NestJS gRPC (`Transport.GRPC`)                                | `AchievementService` on `HOST:PORT`; HTTP on `HEALTH_PORT` for health only                                                           | `src/bootstrap.ts`, `src/presentation/controllers/badge.controller.ts`                 |
| CQRS (`@nestjs/cqrs`)                                         | Queries for the gRPC reads                                                                                                           | `src/app/queries/`                                                                     |
| Prisma + Postgres `achievement_db` (migrations)               | Badges, user badges, counters; `prisma/migrations/`                                                                                  | `prisma/schema/{badge,exam-criteria,login-criteria}.prisma`, `src/infra/repositories/` |
| `nestjs-cls` + `@nestjs-cls/transactional`                    | Transactions; consumers retry optimistic `version` conflicts in a fresh transaction                                                  | `src/achievement.module.ts`, `src/app/events/handlers/version-conflict.ts`             |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging` | Four consumers (prefetch 1) with `InboxService`, retry and DLQ; `OutboxPublisher` + `OutboxRelay` (`relay: true`, connection `pub`)  | `src/app/events/handlers/`, `src/configs/rmq.*.config.ts`                              |
| Domain badge managers                                         | Login thresholds 7, 14, 30, 365 days (total and streak, UTC days); attempt counters; score badges (good/perfect, moved on rescoring) | `src/domain/entities/*-badge-manager.entity.ts`                                        |
| OpenTelemetry + health (`@server/telemetry`)                  | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                        | `src/main.ts`, `src/achievement.module.ts`                                             |

No Redis, no BullMQ, no outgoing gRPC calls (Docker Compose still lists `redis` in its `depends_on`).

## Talks to

- **Called by**: the gateway (`/api/v1/achievements/badges/*`).
- **gRPC `AchievementService`** (`proto/achievement.proto`): `GetAll`, `GetUsersBadges`, `GetUsersProgess` (sic).

Events consumed:

| Routing key              | Queue                                  | Effect                                                                                                                                                |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.user.login`        | `achievement.events.user.login`        | Update total login days and best streak, then check every login threshold, so a badge whose threshold was already passed is awarded on the next login |
| `exam.attempt.submitted` | `achievement.events.attempt.submitted` | Attempt counter badges                                                                                                                                |
| `exam.attempt.scored`    | `achievement.events.attempt.scored`    | Good/perfect score badges                                                                                                                             |
| `exam.attempt.rescored`  | `achievement.events.attempt.rescored`  | Move the attempt between the good/perfect counters (`AttemptScoreBadgeManager.rescore`)                                                               |

Events published:

| Routing key                | When                                                                                                                                | Consumer queue → service                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `achievement.badge.earned` | Same transaction as the badge award (`badge-manager.prisma.repository.impl.ts`); payload `{ uid, badgeName }` with the display name | `notification.events.badge.earned` → notification |

## Data

Postgres `achievement_db`:

| Table              | Key columns                                                                                                            | Purpose                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `badges`           | `name` PK, `type`, `description`, `display_name`                                                                       | Badge catalogue; `display_name`/`description` are the Vietnamese texts users see (`src/constants/badge-info.const.ts`, upserted by the seed) |
| `user_badges`      | `id`, `uid`, `badge` (→ `badges.name`, on update cascade), `updatedAt`; unique `(uid, badge)`; index `(updatedAt, id)` | Badges a user earned, once each                                                                                                              |
| `attempt_criteria` | `uid` PK, `version`, `total`, `perfect`, `good`                                                                        | Per-user attempt counters (optimistic `version`)                                                                                             |
| `login_criteria`   | `uid` PK, `version`, `longest_streak`, `total`, `started_at`, `last_login`                                             | Per-user login streak (UTC days)                                                                                                             |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)).

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT` (gRPC), `HEALTH_PORT`.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `CURSOR_SECRET`: signs pagination cursors.
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run achievement:prisma:generate
pnpm exec nx run achievement:prisma:migrate -- --name <change>
pnpm exec nx run achievement:prisma:seed     # badge catalogue
pnpm exec nx run achievement:serve
pnpm exec nx run achievement:test
```

Also `prisma:push` and `prisma:migrate:reset`. Ports: gRPC 50054 locally (`.env.example`), 50050 in Docker; health 9103. Docker host access through `envoy-achievement` on 8083. Needs Postgres and RabbitMQ.

## More

- Flows: [flows/achievement-file-authorization.md](../../docs/architecture/flows/achievement-file-authorization.md).
- Events: [messaging.md](../../docs/architecture/messaging.md).
