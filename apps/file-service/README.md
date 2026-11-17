# file-service

Stores file metadata and hands out MinIO URLs: presigned POST policies for uploads (the browser uploads straight to MinIO) and download URLs for stored files. It counts how many references other services hold on each file (from their events) and deletes objects nobody references any more.

## Tech used

| Technology                                                    | What for                                                                                                                                                                                              | Where                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| NestJS gRPC (`Transport.GRPC`)                                | `FileService` on `HOST:PORT`; HTTP on `HEALTH_PORT` for health only                                                                                                                                   | `src/bootstrap.ts`, `src/presentation/controllers/file.controller.ts`                |
| Prisma + Postgres `file_db` (migrations)                      | `files` table; `prisma/migrations/`                                                                                                                                                                   | `prisma/schema/file.prisma`, `src/infra/repositories/file.prisma.repository.impl.ts` |
| `nestjs-cls` + `@nestjs-cls/transactional`                    | Transactions                                                                                                                                                                                          | `src/file.module.ts`                                                                 |
| MinIO (`nestjs-minio`, `minio`)                               | Buckets `public` (anonymous read policy) and `private`; presigned POST (15 min, max 10 MB), public URLs, presigned GET for private files (5 min); object deletion                                     | `src/configs/minio.config.ts`, `src/app/services/file.service.ts`                    |
| BullMQ (`@nestjs/bullmq`, queue `file`, Redis)                | Repeatable job `cleanup-orphaned-files` every 5 min: locks up to 500 rows with `ref_count <= 0`, not `is_system`, untouched for 24 h (`FOR UPDATE SKIP LOCKED`), deletes their objects, then the rows | `src/infra/jobs/orphan-cleanup.job.ts`                                               |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging` | Two consumers with `InboxService`, retry and DLQ. `OutboxRelay` runs on the `sub` connection (its only one) for metrics, alerts and inbox cleanup; nothing is published                               | `src/app/events/handlers/`, `src/configs/rmq.sub.config.ts`                          |
| OpenTelemetry + health (`@server/telemetry`)                  | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                                                                                         | `src/main.ts`, `src/file.module.ts`                                                  |

## Talks to

- **Called by**: the gateway (`POST /api/v1/files` → `GetPresignedUrl`, with `uploadedBy` from the JWT); auth, exam and resource (`GetUrls`, `CheckFilesOwnedBy`).
- **Calls**: MinIO only.
- **gRPC `FileService`** (`proto/file.proto`): `GetPresignedUrl` (creates the row, returns a POST policy for the public or private bucket), `GetUrls`, `CheckFilesOwnedBy` (returns `ok` and the `foreignIds` not uploaded by the user, files with no uploader included; the calling service turns that into a 403).

Events consumed (any service's prefix):

| Binding                             | Queue                       | Effect                           |
| ----------------------------------- | --------------------------- | -------------------------------- |
| `*.file.added`                      | `file.events.file.added`    | `ref_count + 1`                  |
| `*.file.removed`, `*.files.removed` | `file.events.files.removed` | Decrement by each file's `count` |

Today's publishers: `auth.*` (avatars), `exam.*` (section/question files), `resource.*` (report attachments, flash card images). No publisher uses the singular `*.file.removed` key.

## Data

Postgres `file_db`:

| Table   | Key columns                                                                                                                                | Purpose                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files` | `id` (uuid, also the object key), `name`, `size`, `mime_type`, `ref_count`, `updatedAt`, `isPublic`, `uploaded_by?` (indexed), `is_system` | One uploaded object. `uploaded_by` comes from the JWT at presign time (`NULL` for legacy, seeded and system files). `is_system` rows are exempt from orphan cleanup |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)). Redis holds only BullMQ's keys for queue `file`. Object storage: MinIO buckets `public` and `private`, object key = file id.

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT` (gRPC), `HEALTH_PORT`.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `REDIS_HOST`, `REDIS_PORT` (BullMQ).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `MINIO_HOST`, `MINIO_PORT`, `MINIO_USER`, `MINIO_PASSWORD`, `MINIO_USE_SSL` (defaults to on in production).
- `MINIO_PUBLIC_URL` (optional): the browser-facing MinIO address used to sign upload policies and build download URLs, when it differs from `MINIO_HOST:MINIO_PORT`.
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run file-service:prisma:generate
pnpm exec nx run file-service:prisma:migrate -- --name <change>
pnpm exec nx run file-service:prisma:seed     # indexes eng-media/ as system files
pnpm exec nx run file-service:serve
pnpm exec nx run file-service:test
```

Also `prisma:push` and `prisma:migrate:reset`. The seed needs the `eng-media/` folder (system media); `pnpm db:setup` also generates and uploads placeholder media (`scripts/dev-media/`). Ports: gRPC 50056 locally (`.env.example`), 50050 in Docker; health 9106. Docker host access through `envoy-file-service` on 8086. Needs Postgres, Redis, RabbitMQ and MinIO.

## More

- Flows (presigned upload, reference counting, orphan cleanup): [flows/achievement-file-authorization.md](../../docs/architecture/flows/achievement-file-authorization.md).
- Events: [messaging.md](../../docs/architecture/messaging.md).
