# notification

In-app notifications. It turns other services' events (badges, reports, flash card proposals, blog comments and forum replies) into stored notifications for the right users, respects each user's notification preferences, and pushes new notifications to open browser tabs over Server-Sent Events. Users list, read and delete their notifications over gRPC.

## Tech used

| Technology                                                     | What for                                                                                                                                                                                                      | Where                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| NestJS gRPC (`Transport.GRPC`)                                 | `NotificationService`, `NotificationPreferencesService` on `GRPC_HOST:GRPC_PORT`                                                                                                                              | `src/bootstrap.ts`, `src/presentation/controllers/notification*.controller.ts`                                |
| NestJS HTTP + SSE (`@Sse`)                                     | `GET /notifications/stream/:recipientId` on `HTTP_HOST:HTTP_PORT` (also `/health/*`): heartbeat every 25 s, SSE `id` = notification id; reconnect with `Last-Event-ID` replays up to 100 missed notifications | `src/presentation/controllers/notification-sse.controller.ts`, `src/app/services/notification-sse.service.ts` |
| Redis via `ioredis` (pub/sub)                                  | Fan-out of pushes to every replica on channel `notification:sse` (separate publisher and subscriber connections)                                                                                              | `src/app/services/notification-sse.service.ts`                                                                |
| Prisma + Postgres `notification_db` (`db push`, no migrations) | Notifications and preferences                                                                                                                                                                                 | `prisma/schema/notification.prisma`                                                                           |
| `nestjs-cls` + `@nestjs-cls/transactional`                     | Transactions; a notification is pushed only after its transaction commits                                                                                                                                     | `src/notification.module.ts`, `src/app/services/notification.service.ts`                                      |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging`  | Eight consumers with `InboxService`, retry and DLQ. `OutboxRelay` runs on `pub` (default `relay`) for metrics, alerts and inbox cleanup; nothing is published                                                 | `src/app/events/handlers/`, `src/configs/rmq.*.config.ts`                                                     |
| auth gRPC client (`auth.AuthServiceClient`)                    | `FindIdentityIdsByRole` (admins to notify about a new report)                                                                                                                                                 | `src/app/events/handlers/report-created.handler.ts`                                                           |
| OpenTelemetry + health (`@server/telemetry`)                   | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                                                                                                 | `src/main.ts`, `src/notification.module.ts`                                                                   |

No BullMQ, no e-mail sending (the `email_enabled` / `push_enabled` preferences are stored only).

## Talks to

- **Called by**: the gateway (`/api/v1/notifications/*` over gRPC, always with `recipientId = req.user.sub`; `stream/:recipientId` proxied to `HTTP_PORT` only when it is the caller's own id).
- **Calls**: auth gRPC (`FindIdentityIdsByRole`).
- **gRPC** (`proto/notification.proto`): `NotificationService` (`CreateNotification`, `GetNotification`, `DeleteNotification`, `ListNotifications`, `MarkAsRead`, `MarkAllAsRead`) and `NotificationPreferencesService` (`GetPreferences`, `UpdatePreferences`).

Events consumed (`src/app/events/handlers/`):

| Routing key                             | Queue                                              | Effect                                                                                                   |
| --------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `achievement.badge.earned`              | `notification.events.badge.earned`                 | "Achievement Unlocked!" for the user (`achievement`, pref `achievementEnabled`)                          |
| `resource.report.created`               | `notification.events.report.created`               | Asks auth for the admins and notifies each (`report`, pref `reportEnabled`)                              |
| `resource.report.status-changed`        | `notification.events.report.status-changed`        | Tells the reporter (`report`, pref `reportEnabled`)                                                      |
| `resource.flashcard-proposal.created`   | `notification.events.flashcard-proposal.created`   | Tells the list owner (`flashcard`, pref `flashcardEnabled`)                                              |
| `resource.flashcard-proposal.decided`   | `notification.events.flashcard-proposal.decided`   | Tells the proposer, unless they decided it themselves (`flashcard`)                                      |
| `resource.flashcard-proposal.withdrawn` | `notification.events.flashcard-proposal.withdrawn` | Deletes the owner's notification for that proposal                                                       |
| `resource.blog-comment.created`         | `notification.events.blog-comment.created`         | Replied-to author (`comment_reply`) and post author (`blog_comment`); never the writer, one per person   |
| `resource.forum-reply.created`          | `notification.events.forum-reply.created`          | Quoted author (`forum_quote`) and thread author (`forum_reply`); link carries the reply and its position |

Recipients for the discussion events come from `src/app/events/handlers/discussion-recipients.ts`. Publishes nothing.

## Data

Postgres `notification_db`, schema `prisma/schema/notification.prisma`:

| Table                      | Key columns                                                                                                                                                                                                                                                     | Purpose                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notifications`            | `id`, `recipient_id` (indexed), `type`, `title`, `message`, `data?` (JSON), `is_read`, `read_at?`, `created_at`                                                                                                                                                 | One notification for one user. Types: `achievement`, `report`, `system`, `flashcard`, `blog_comment`, `comment_reply`, `forum_reply`, `forum_quote` |
| `notification_preferences` | `id`, `identity_id` (unique), `email_enabled`, `push_enabled`, `achievement_enabled`, `report_enabled`, `system_enabled`, `blog_comment_enabled`, `comment_reply_enabled`, `forum_reply_enabled`, `forum_quote_enabled`, `flashcard_enabled` (all default true) | Per-user switches checked by the consumers; no row = everything on                                                                                  |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)). Redis: pub/sub channel `notification:sse` only (no keys).

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `GRPC_HOST`, `GRPC_PORT`, `HTTP_HOST`, `HTTP_PORT` (SSE and health).
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `REDIS_HOST`, `REDIS_PORT` (SSE fan-out).
- `AUTH_SERVICE_HOST`, `AUTH_SERVICE_PORT` (optional `AUTH_SERVICE_URL`).
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run notification:prisma:generate
pnpm exec nx run notification:prisma:push     # no migrations folder: schema is pushed
pnpm exec nx run notification:prisma:seed     # only the demo account's badge notifications
pnpm exec nx run notification:serve
pnpm exec nx run notification:test
```

Ports: gRPC 50060, HTTP/SSE/health 50061 (locally and in Docker). Docker host access through `envoy-notification` on 8085 (gRPC) and 8095 (SSE). Needs Postgres, Redis, RabbitMQ and auth.

## More

- Flows (notifications, preferences, SSE stream): [flows/live-and-notification.md](../../docs/architecture/flows/live-and-notification.md); discussion and proposal notifications in [flows/resource-community.md](../../docs/architecture/flows/resource-community.md).
- Events: [messaging.md](../../docs/architecture/messaging.md).
