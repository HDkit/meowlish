# live

Chat rooms and live sessions. Rooms are managed over gRPC (list, create, delete, schedule a live stream URL and time, ban and unban users) and chat happens over socket.io: clients join rooms, send messages that are stored in the chat log and broadcast to the room. Socket handshakes are authenticated here (JWT + auth `ValidateAccess`), and a locked account is disconnected everywhere.

## Tech used

| Technology                                                                   | What for                                                                                                                                                                | Where                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| NestJS gRPC (`Transport.GRPC`)                                               | `ChatService` on `GRPC_HOST:GRPC_PORT`                                                                                                                                  | `src/bootstrap.ts`, `src/app/presentation/controllers/`                              |
| NestJS HTTP + socket.io (`@nestjs/websockets`, `@nestjs/platform-socket.io`) | `ChatGateway` on `HTTP_HOST:HTTP_PORT` (also serves `/health/*`). Events in: `join-room`, `leave-room`, `chat` (acked with the stored id); out: `message`               | `src/app/services/chat.gateway.ts`                                                   |
| Redis via `redis` + `@socket.io/redis-adapter`                               | socket.io adapter, so rooms, broadcasts and `fetchSockets` work across replicas                                                                                         | `src/app/infra/adapter/redis-io.adapter.ts`                                          |
| `allowRequest` origin check                                                  | Refuses handshakes whose `Origin` is not in `CORS_ORIGINS` (no `Origin` = non-browser client, allowed)                                                                  | `src/app/infra/adapter/redis-io.adapter.ts`                                          |
| `jsonwebtoken`                                                               | Verifies the access token (cookie `access_token`, then socket.io `auth.token`, `?token=`, `Authorization: Bearer`) with `JWT_PUBLIC_KEY`, RS256; refresh tokens refused | `src/app/services/chat.gateway.ts`                                                   |
| auth gRPC client (`auth.AuthServiceClient`)                                  | `ValidateAccess` on every handshake (revoked sessions, locked accounts)                                                                                                 | `src/live.module.ts`, `src/app/services/chat.gateway.ts`                             |
| Prisma + Postgres `live_db` (`db push`, no migrations)                       | Rooms, bans, chat log                                                                                                                                                   | `prisma/schema/live.prisma`, `src/app/infra/repositories/`                           |
| `nestjs-cls` + `@nestjs-cls/transactional`                                   | Transactions                                                                                                                                                            | `src/live.module.ts`                                                                 |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging`                | `OutboxPublisher` + `OutboxRelay` (`relay: true`, connection `pub`); one consumer on `sub` with `InboxService`, retry and DLQ                                           | `src/app/services/chat.service.ts`, `src/app/events/handlers/user-locked.handler.ts` |
| BullMQ (`@nestjs/bullmq`)                                                    | Queue `live` is registered, but no job or processor uses it                                                                                                             | `src/live.module.ts`, `src/configs/bullmq.config.ts`                                 |
| OpenTelemetry + health (`@server/telemetry`)                                 | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                                                           | `src/main.ts`, `src/live.module.ts`                                                  |

## Talks to

- **Called by**: the gateway (`/api/v1/chat/rooms/*` over gRPC; `/api/v1/chat/ws/socket.io` proxied to `HTTP_PORT`).
- **Calls**: auth gRPC (`ValidateAccess`).
- **gRPC `ChatService`** (`proto/live.proto`): `GetRoomList` (case-insensitive name search; the name is carried in the signed cursor, and `nextCursor`/`prevCursor` are empty when there is no such page), `GetChatLog`, `CreateRoom`, `RemoveRoom` (also closes the room's sockets after the commit), `UpdateRoomSchedule`, `BanUserFromRoom`, `UnbanUserFromRoom`. Ban and unban carry a requester: only the room owner (`created_by`) or an admin; rooms with no recorded owner are admin-only.

Events published (outbox, envelope):

| Routing key         | When                                         | Consumer queue → service                            |
| ------------------- | -------------------------------------------- | --------------------------------------------------- |
| `live.room.created` | `CreateRoom`, only when `createdBy` is known | `authorization.events.room.created` → authorization |
| `live.room.deleted` | `RemoveRoom`                                 | `authorization.events.room.deleted` → authorization |

Events consumed:

| Routing key        | Queue                     | Effect                                            |
| ------------------ | ------------------------- | ------------------------------------------------- |
| `auth.user.locked` | `live.events.user.locked` | Disconnect every socket of the user on every node |

## Data

Postgres `live_db`, schema `prisma/schema/live.prisma`:

| Table     | Key columns                                                                                  | Purpose                                                                                           |
| --------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `rooms`   | `id`, `name` (unique), `scheduled_live_url?`, `scheduled_time?`, `is_deleted`, `created_by?` | A room; soft-deleted (name rewritten to `<id>:deleted` to free it); `created_by` drives ban/unban |
| `banneds` | PK `(room_id, uid)`, `reason`                                                                | Users banned from a room (checked on `join-room`, fail closed)                                    |
| `logs`    | `id`, `roomId`, `created_at`, `from_id`, `message`                                           | Chat history                                                                                      |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)). Redis: socket.io adapter pub/sub channels (managed by `@socket.io/redis-adapter`); each socket also joins a private room named after its user id.

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `GRPC_HOST`, `GRPC_PORT`, `HTTP_HOST`, `HTTP_PORT` (socket.io and health).
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `REDIS_HOST`, `REDIS_PORT` (socket.io adapter, BullMQ).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `AUTH_SERVICE_HOST`, `AUTH_SERVICE_PORT` (optional `AUTH_SERVICE_URL`).
- `JWT_PUBLIC_KEY`: RS256 public key; when empty every socket is rejected (a warning is logged).
- `CORS_ORIGINS`: allowed socket origins (local frontends by default outside production).
- `CURSOR_SECRET`: signs room-list cursors.
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run live:prisma:generate
pnpm exec nx run live:prisma:push     # no migrations folder: schema is pushed
pnpm exec nx run live:prisma:seed
pnpm exec nx run live:serve
pnpm exec nx run live:test
```

Ports: gRPC 50057 locally (`.env.example`), 50050 in Docker; socket.io/HTTP/health 1511. Docker host access through `envoy-live` on 8087 (gRPC) and 8088 (WebSocket). Needs Postgres, Redis, RabbitMQ and auth.

## More

- Flows (rooms, socket.io proxy, bans): [flows/live-and-notification.md](../../docs/architecture/flows/live-and-notification.md).
- Events: [messaging.md](../../docs/architecture/messaging.md).
