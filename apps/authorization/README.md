# authorization

Keeps a copy of "who owns which resource" for the gateway's legacy `@ResourceAccess({ requireOwnership: true })` routes (room delete/schedule, blog and flash card mutations). Ownership is written only from the owning services' `created`/`deleted` events and from the seed; the gateway asks `CheckOwnership` before forwarding such a route. New rules should not use it: data-dependent rules belong in the owning service (see [authorization.md §1-2](../../docs/architecture/authorization.md#2-what-the-design-said-vs-what-was-built)).

## Tech used

| Technology                                                      | What for                                                                                                                                                            | Where                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| NestJS gRPC (`Transport.GRPC`)                                  | `AuthorizationService` on `HOST:PORT`; HTTP on `HEALTH_PORT` for health only                                                                                        | `src/bootstrap.ts`, `src/app/services/authorization.grpc.controller.ts`                       |
| Prisma + Postgres `authorization_db` (`db push`, no migrations) | `resource_ownership` table                                                                                                                                          | `prisma/schema/ownership.prisma`, `src/app/infra/repositories/ownership.prisma.repository.ts` |
| `nestjs-cls` + `@nestjs-cls/transactional`                      | Transactions for consumers                                                                                                                                          | `src/authorization.module.ts`                                                                 |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging`   | Six consumers with `InboxService` (idempotent) and per-queue retry/DLQ; `OutboxRelay` runs on the `sub` connection (`relay: true`) but nothing writes to the outbox | `src/app/events/handlers/`, `src/configs/rmq.sub.config.ts`                                   |
| OpenTelemetry + health (`@server/telemetry`)                    | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                                                       | `src/main.ts`, `src/authorization.module.ts`                                                  |

No Redis, no BullMQ, no outgoing gRPC calls.

## Talks to

- **Called by**: the gateway's `ResourceAccessGuard` (`apps/gateway/src/auth/guards/resource-access.guard.ts`).
- **gRPC `AuthorizationService`** (`proto/authorization.proto`): `CheckOwnership`.
- **Publishes**: nothing.

Events consumed (handlers in `src/app/events/handlers/`, queues in `ownership-queues.ts`):

| Routing key                 | Queue                                   | Effect                                                                |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `exam.exam.created`         | `authorization.events.exam.created`     | Register owner (`createMany` with `skipDuplicates`: first owner wins) |
| `exam.exam.deleted`         | `authorization.events.exam.deleted`     | Remove ownership                                                      |
| `live.room.created`         | `authorization.events.room.created`     | Register owner                                                        |
| `live.room.deleted`         | `authorization.events.room.deleted`     | Remove ownership                                                      |
| `resource.resource.created` | `authorization.events.resource.created` | Register owner (`blog`, `flashcard`)                                  |
| `resource.resource.deleted` | `authorization.events.resource.deleted` | Remove ownership                                                      |

## Data

Postgres `authorization_db`, schema `prisma/schema/ownership.prisma`:

| Table                | Key columns                                                                                                                                                   | Purpose                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resource_ownership` | `id` (cuid), `resource_type`, `resource_id`, `owner_id`, `created_at`; unique `(resource_type, resource_id)`; indexes `owner_id`, `(resource_type, owner_id)` | One owner per resource. Types written at runtime: `exam`, `room`, `blog`, `flashcard` (the seed backfills the same types and deletes stale `flashcard-list` rows) |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)).

The seed (`prisma/seed.ts`) is the only code in the repo that reads other services' databases: it backfills ownership from `exam_db`, `resource_db` and `live_db` (override with `EXAM_DB_URL`, `RESOURCE_DB_URL`, `LIVE_DB_URL`). Run it after those databases are seeded (`pnpm db:setup` orders it last but one).

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT` (gRPC), `HEALTH_PORT`.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run authorization:prisma:generate
pnpm exec nx run authorization:prisma:push          # no migrations folder: schema is pushed
pnpm exec nx run authorization:serve
pnpm exec nx run authorization:test
```

There is no `prisma:seed` target; the seed runs through `pnpm db:setup` (or `pnpm exec prisma db seed` in `apps/authorization`). Ports: gRPC 50052 locally (`.env.example`), 50050 in Docker; health 9108. No Envoy sidecar. Needs Postgres and RabbitMQ.

## More

- Flows: [flows/achievement-file-authorization.md](../../docs/architecture/flows/achievement-file-authorization.md).
- Events: [messaging.md](../../docs/architecture/messaging.md).
- Rules: [authorization.md](../../docs/architecture/authorization.md).
