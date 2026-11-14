# Live and notification flows

Chat rooms, live-stream schedules, bans and the chat socket (`apps/live`, gateway `apps/gateway/src/live-gateway/live.router.controller.ts` and the socket.io proxy `apps/gateway/src/live-ws-gateway/live-ws.router.controller.ts`), and in-app notifications, preferences and the SSE push stream (`apps/notification`, gateway `apps/gateway/src/notification-gateway/notification.router.controller.ts`). Data models: [services-and-data.md: live](../services-and-data.md#live-appslive), [notification](../services-and-data.md#notification-appsnotification). Event mechanics: [messaging.md](../messaging.md). Auth layers: [authorization.md](../authorization.md).

Paths: global prefix `api` + URI version `1` (`apps/gateway/src/bootstrap.ts`), `RouterModule` mounts `LiveGatewayModule` at `/chat`, `LiveWsGatewayModule` at `/chat/ws`, `NotificationGatewayModule` at `/notifications` (`apps/gateway/src/router.module.ts`). Every route below passes the global guards in order `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard` → `ResourceAccessGuard` (`apps/gateway/src/gateway.module.ts`); unless noted, the throttle is the `default` one (100/min per IP + access-token `sub`, `apps/gateway/src/throttle.ts`). gRPC errors become HTTP through `gRPC2HttpExceptionFilter`; a non-`HttpException` thrown in a service (e.g. a raw Prisma error) arrives as gRPC `UNKNOWN` and becomes **502** (`libs/utils/src/filters/rpc-to-http.http.filter.ts`).

## Contents

| Operation                                                                                     | Access                                        | Writes                                 | Events                           |
| --------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- | -------------------------------- |
| [GET /api/v1/chat/rooms](#get-apiv1chatrooms)                                                 | any signed-in                                 | -                                      | -                                |
| [GET /api/v1/chat/rooms/:roomId/logs](#get-apiv1chatroomsroomidlogs)                          | any signed-in                                 | -                                      | -                                |
| [POST /api/v1/chat/rooms](#post-apiv1chatrooms)                                               | Mod, Admin                                    | `rooms`, `outbox_events`               | `live.room.created`              |
| [DELETE /api/v1/chat/rooms/:roomId](#delete-apiv1chatroomsroomid)                             | Mod (owner via authorization), Admin          | `rooms` (soft delete), `outbox_events` | `live.room.deleted`              |
| [PATCH /api/v1/chat/rooms/:roomId/schedule](#patch-apiv1chatroomsroomidschedule)              | Mod (owner via authorization), Admin          | `rooms`                                | -                                |
| [POST /api/v1/chat/rooms/:roomId/ban](#post-apiv1chatroomsroomidban)                          | Mod, Admin; live: owner or Admin              | `banneds`                              | - (socket kick)                  |
| [DELETE /api/v1/chat/rooms/:roomId/ban/:uid](#delete-apiv1chatroomsroomidbanuid)              | Mod, Admin; live: owner or Admin              | `banneds`                              | -                                |
| [ALL /api/v1/chat/ws/socket.io](#all-apiv1chatwssocketio)                                     | public at gateway; live verifies JWT          | via socket events                      | socket.io                        |
| [socket.io events](#socketio-chatgateway)                                                     | verified JWT                                  | `logs`                                 | `message` emit                   |
| [GET /api/v1/notifications/stream/:recipientId](#get-apiv1notificationsstreamrecipientid-sse) | signed-in, `recipientId === sub`, no throttle | -                                      | SSE                              |
| [POST /api/v1/notifications](#post-apiv1notifications)                                        | Admin                                         | `notifications`                        | SSE push                         |
| [GET /api/v1/notifications/preferences](#get-apiv1notificationspreferences)                   | signed-in (own)                               | `notification_preferences` (upsert)    | -                                |
| [PATCH /api/v1/notifications/preferences](#patch-apiv1notificationspreferences)               | signed-in (own)                               | `notification_preferences`             | -                                |
| [GET /api/v1/notifications](#get-apiv1notifications)                                          | signed-in (own)                               | -                                      | -                                |
| [GET /api/v1/notifications/:id](#get-apiv1notificationsid)                                    | signed-in (own, else 404)                     | -                                      | -                                |
| [PATCH /api/v1/notifications/:id/read](#patch-apiv1notificationsidread)                       | signed-in (own, else 404)                     | `notifications`                        | -                                |
| [POST /api/v1/notifications/read-all](#post-apiv1notificationsread-all)                       | signed-in (own)                               | `notifications`                        | -                                |
| [DELETE /api/v1/notifications/:id](#delete-apiv1notificationsid)                              | signed-in (own, else 404)                     | `notifications`                        | -                                |
| [Background work](#background-work)                                                           | -                                             | `notifications`, `inbox_events`        | consumes 3 events (+4 elsewhere) |

## Chat rooms (`LiveGatewayController`, `@Controller('rooms')`)

The gateway calls `live.ChatService/*` through `ErrorHandlingGrpcProxy` (`LIVE_SERVICE_URL` or `LIVE_SERVICE_HOST:PORT`, `apps/gateway/src/live-gateway/live.router.module.ts`). Live's gRPC controller is `apps/live/src/app/presentation/controllers/chat.controller.ts`; all logic is in `apps/live/src/app/services/chat.service.ts` (no CQRS in live); repositories in `apps/live/src/app/infra/repositories/`.

### GET /api/v1/chat/rooms

List rooms, newest message per room included, optional case-insensitive name search, signed cursors.

- **Access**: any authenticated user.
- **Flow**:
  1. Gateway `GetRoomListQueryDto` (`dtos/req/get-room-list.query.dto.ts`): `cursor?`, `limit?` 1..50 (default 10), `name?` max 100 chars → `live.ChatService/GetRoomList`.
  2. Live `ChatService.getRoomList`: decodes the cursor with `CursorPaginationHelper` namespace `GetRoomList` (HMAC with `CURSOR_SECRET`, random per process if unset: `libs/utils/src/functions/pagination/cursor-pagination.factory.ts`). The cursor's `name` wins over the query's `name` so paging can't drift to another filter; `limit` from the query wins over the cursor's.
  3. `RoomReadPrismaRepositoryImpl.getRoomList`: `Room.findMany` where `isDeleted = false` (+ `name contains … insensitive`), `orderBy id asc`, Prisma cursor + `skip 1`, `take ±(limit+1)` (extra row tells if another page exists). Then one `Log.findMany` with `distinct: ['roomId']` ordered `createdAt desc` for the `lastMessage` of each room.
  4. Response `RoomListDto { rooms[{ id, name, scheduledLiveUrl?, scheduledDate?, createdBy?, lastMessage? }], nextCursor, prevCursor }`; a cursor is `''` when there is no such page.

### GET /api/v1/chat/rooms/:roomId/logs

Chat history of a room.

- **Access**: any authenticated user. No membership or ban check (see Findings).
- **Flow**:
  1. Gateway takes individual `@Query('uid')`, `@Query('cursor')`, `@Query('limit')` params (no DTO, no max on `limit`) → `live.ChatService/GetChatLog`. `dateRange` exists in the proto/live DTO but the gateway never sends it.
  2. Live `GetChatLogDto` (`limit` `@IsPositive`) → `ChatService.getChatLogsOf`: decodes cursor (namespace `GetChatLogsOf`), cursor's `uid`/`dateRange` win.
  3. `ChatLogReadPrismaRepositoryImpl.getChatLogsOf`: `Log.findMany` where `roomId`, `room.isDeleted = false`, optional `fromId = uid`, optional `createdAt` range; `orderBy [createdAt asc, id asc]`, cursor + `skip 1`, `take ±limit` (default 10 from the service). The first page is therefore the **oldest** messages.
  4. Response `ChatLogDto { chats[{ id, uid, message, createdAt }], nextCursor, prevCursor }`. Both cursors are always encoded, even for an empty page.

### POST /api/v1/chat/rooms

Create a room owned by the caller.

- **Access**: `@HasRoles(Mod, Admin)`.
- **Flow**:
  1. Gateway `CreateRoomDto { name }` (`@IsString`, no length limit) → `live.ChatService/CreateRoom` with `createdBy: req.user.sub`.
  2. Live `ChatService.createRoom` (`@Transactional()`): `RoomPrismaRepositoryImpl.createRoom` inserts `Room { name, createdBy }`; then, only if `createdBy` is set (always, via the gateway), `OutboxPublisher.add('live.room.created', { resourceType: 'room', resourceId, ownerId })` (envelope) in the same transaction.
  3. Response `CreatedRoomDto { id }`.
- **Async**: `live.room.created` → `authorization.events.room.created` → `RoomCreatedHandler` (`apps/authorization/src/app/events/handlers/live-ownership.handler.ts`): inbox claim yes, registers `resource_ownership('room', id, ownerId)` (first owner wins). This feeds `@ResourceAccess` on delete/schedule; until it is consumed, the creating mod gets 403 on those two routes.
- **Errors**: duplicate name (unique `rooms.name`, P2002) → 409 `A room with this name already exists`.

### DELETE /api/v1/chat/rooms/:roomId

Soft-delete a room and kick everyone out.

- **Access**: `@HasRoles(Mod, Admin)` + `@ResourceAccess({ resourceType: 'room', resourceIdParam: 'roomId', rules: [{ roles: [Admin] }, { roles: [Mod], requireOwnership: true }] })`: admins pass; mods need `authorization.AuthorizationService/CheckOwnership` to return `isOwner` ([authorization.md §5](../authorization.md#5-legacy-resourceaccess-and-the-authorization-service)).
- **Flow**:
  1. Gateway → `live.ChatService/RemoveRoom { roomId }`.
  2. Live `ChatService.removeRoom` (`@Transactional()`): `RoomPrismaRepositoryImpl.removeRoom` updates `Room` where `id` (no `isDeleted` filter) to `isDeleted = true, name = '<id>:deleted'` (frees the unique name); `ChatGateway.closeRoom(roomId)` makes every socket leave the socket.io room (cluster-wide through the Redis adapter, runs before the commit); `OutboxPublisher.add('live.room.deleted', { resourceId })` (envelope).
  3. Response empty.
- **Async**: `live.room.deleted` → `authorization.events.room.deleted` → `RoomDeletedHandler` (same file): inbox claim yes, removes the ownership row.
- **Errors**: mod on a room it doesn't own (or that doesn't exist) → 403 from the guard. Admin on an unknown id → Prisma P2025 → 502. Deleting an already deleted room succeeds again and emits a second `live.room.deleted`.

### PATCH /api/v1/chat/rooms/:roomId/schedule

Set or clear the scheduled live-stream URL and time.

- **Access**: same `@HasRoles` + `@ResourceAccess` as delete. Live itself does no requester check.
- **Flow**:
  1. Gateway `UpdateRoomScheduleDto { url?, time? (Date), setUrlNull?, setTimeNull? }`; a non-empty `url` must match `^https?://(www\.)?(youtube\.com|youtu\.be|twitch\.tv)/` or 400 (checked in the controller, not in live).
  2. → `live.ChatService/UpdateRoomSchedule` → `ChatService.updateRoomSchedule`: `setUrlNull`/`setTimeNull` turn into `null`, otherwise `undefined` leaves the column alone.
  3. `RoomPrismaRepositoryImpl.updateRoomSchedule`: single `Room.update` where `{ id, isDeleted: false }` on `scheduled_live_url`, `scheduled_time`. No transaction, no event, no socket notification.
- **Errors**: 400 bad URL; 403 from the guard; admin on a missing or deleted room → P2025 → 502.

### POST /api/v1/chat/rooms/:roomId/ban

Ban a user from a room and remove their sockets from it.

- **Access**: `@HasRoles(Mod, Admin)`, then `requesterOf(req.user, [Admin])`; live `ChatService.assertCanModerate` allows only `rooms.created_by === requesterId` or `privileged` ([authorization.md §7(d)](../authorization.md#d-live-ban--unban-post-apiv1chatroomsroomidban-delete-apiv1chatroomsroomidbanuid)).
- **Flow**:
  1. Gateway `BanUserFromRoomDto { uid, reason? }` → `live.ChatService/BanUserFromRoom { uid, reason, roomId, requesterId, privileged }`.
  2. Live `BanUserDto` (requires `reason` as a string, see Findings) → `ChatService.banUserFrom`: `getRoomOwner` (`Room.findFirst` where not deleted) → 404/403 rules → `RoomPrismaRepositoryImpl.banUserFrom` inserts `Banned { roomId, uid, reason }` first (duplicate P2002 ignored, so re-banning is idempotent) → then `ChatGateway.disconnectUser(uid, roomId)`: `server.in(uid).socketsLeave(roomId)` plus `fetchSockets()` on the room, removing every socket whose verified `data.uid` is the user (all nodes, through the Redis adapter). No transaction, no event.
  3. Response empty. Later `join-room` attempts are refused by `canJoinRoom`.
- **Errors**: 403 role (gateway); 404 missing/deleted room; 403 not owner and not admin (ownerless rooms are admin-only).

### DELETE /api/v1/chat/rooms/:roomId/ban/:uid

Lift a ban.

- **Access**: as for ban.
- **Flow**: gateway → `live.ChatService/UnbanUserFromRoom { uid, roomId, requesterId, privileged }` → `ChatService.unbanUserFrom`: `assertCanModerate` → `Banned.delete` by `(roomId, uid)`; P2025 (not banned) is ignored. Response empty.
- **Errors**: same 404/403 as ban.

## Chat socket

### ALL /api/v1/chat/ws/socket.io

socket.io transport (long-polling and WebSocket upgrade) proxied to live.

- **Access**: `@IsPublic()` and `@SkipAllThrottlers()` at the gateway; authentication happens in live's `handleConnection`.
- **Flow**:
  1. `LiveWsGatewayController` (`apps/gateway/src/live-ws-gateway/live-ws.router.controller.ts`) hands the request to an `http-proxy-middleware` instance (`ws: true`, `changeOrigin`) targeting `LIVE_SERVICE_WS_URL` or `http://LIVE_SERVICE_WS_HOST:PORT` (live `HTTP_PORT`, 1511 in compose); `pathRewrite` turns any `…/socket.io` or `…/socket.io/` into `/socket.io/`, keeping the query.
  2. WebSocket upgrades are not routed through Nest: http-proxy-middleware subscribes to the HTTP server's `upgrade` event the first time an ordinary request passes through this route, and from then on proxies every upgrade (no path filter) to live.
  3. Live (`apps/live/src/bootstrap.ts`) listens on `HTTP_PORT` with `RedisIoAdapter` (`apps/live/src/app/infra/adapter/redis-io.adapter.ts`): `createIOServer` sets `cors` from `CORS_ORIGINS` (credentials on) and `allowRequest: originAllowed(corsOrigins)`, which accepts a handshake only if it has no `Origin` header or one listed in `CORS_ORIGINS` (covers WebSocket upgrades too, which CORS doesn't). The adapter is `@socket.io/redis-adapter` over two `redis` clients (`REDIS_HOST:PORT`, pub + duplicated sub), so room broadcasts and `socketsLeave` work across live replicas.
  4. `ChatGateway.handleConnection` (`apps/live/src/app/services/chat.gateway.ts`): token from `access_token` cookie, else `handshake.auth.token`, else `?token=`, else `Authorization: Bearer`; `jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })`; requires a string `sub`. On success `socket.data.uid = sub` and the socket joins a personal room named after the uid. Any failure (or `JWT_PUBLIC_KEY` unset) → `socket.disconnect(true)`. No revocation check (backlog S17).

### socket.io (`ChatGateway`)

`@UseGuards(ClsGuard)`, `@UsePipes(GlobalValidationPipe)`, `@UseFilters(GlobalWsExceptionFilter)`; any thrown error is sent to the client as event `exception { status: 'error', message }` (`libs/utils/src/filters/global.ws.filter.ts`). No per-socket rate limit.

| Client event | Payload                                                 | What happens                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `join-room`  | `roomId` (string)                                       | Must be a UUID, else `exception` "User is not allowed to join this room". `RoomPrismaRepositoryImpl.canJoinRoom`: room exists, not deleted, and no `banneds` row for this uid. DB errors fail closed. Then `socket.join(roomId)`.                                                                             |
| `leave-room` | `roomId` (must be a UUID, else `UnauthorizedException`) | `socket.leave(roomId)`; a socket cannot leave its own uid room.                                                                                                                                                                                                                                               |
| `chat`       | `ChatDto { roomId, message (≤2000) }`                   | Socket must already be in `roomId`, else `exception` 403 text. `saveLog`: re-checks the room is not deleted (404) and inserts `Log { roomId, fromId: uid, message }` (no transaction). Emits `message { id, fromId, message, createdAt }` to the room **excluding the sender** (`socket.to(roomId)`); no ack. |

Server-initiated: `closeRoom` (room delete) and `disconnectUser` (ban) only remove sockets from socket.io rooms; they don't emit an event or disconnect the socket.

## Notifications (`NotificationGatewayController`, `@Controller()` under `/notifications`)

gRPC through `ErrorHandlingGrpcProxy` (`NOTIFICATION_SERVICE_URL` or `NOTIFICATION_SERVICE_HOST:PORT`) to two services, `NotificationService` and `NotificationPreferencesService` (`apps/notification/src/presentation/controllers/notification.controller.ts`, `notification-preferences.controller.ts`). Logic in `apps/notification/src/app/services/notification.service.ts` and `notification-preferences.service.ts`; no repositories layer, the services use `TransactionHost` directly. Every recipient-scoped route takes the recipient from `req.user.sub`, never from the request.

### GET /api/v1/notifications/stream/:recipientId (SSE)

Live push of new notifications for the caller.

- **Access**: JWT required (cookie or Bearer, so `EventSource` works with the session cookie); `recipientId !== req.user.sub` → 403 `You can only subscribe to your own notifications`; `@SkipAllThrottlers()`. Declared with `@All`, so any method is proxied.
- **Flow**:
  1. Gateway proxies with `http-proxy-middleware` to `NOTIFICATION_SERVICE_SSE_URL` or `http://NOTIFICATION_SERVICE_HOST:NOTIFICATION_SERVICE_HTTP_PORT` (default 50061), rewriting `^/api/v1/notifications/stream` → `/notifications/stream`.
  2. Notification's HTTP listener (`HTTP_PORT`, 50061 in compose; code default 1520) serves `NotificationSseController` (`apps/notification/src/presentation/controllers/notification-sse.controller.ts`) `@Sse('stream/:recipientId')`, which trusts the path parameter (no auth in the service).
  3. `NotificationSseService.subscribe(recipientId)` (`apps/notification/src/app/services/notification-sse.service.ts`): one process-wide RxJS `Subject`, fed by an `EventEmitter2` listener on `notification.created`; each subscriber gets `filter(recipientId)` → `{ type: 'notification', data: NotificationReadModel }`. No event ids, no replay of missed notifications, no heartbeat; fan-out is in memory, so only clients connected to the replica that created the notification receive it.
  4. Producers: `NotificationService.createNotification` calls `sseService.emit(recipientId, notification)` right after the insert (both the admin route and every consumer).
- **Errors**: 401 without a valid token; 403 other recipient.

### POST /api/v1/notifications

Admin creates an arbitrary notification for any user.

- **Access**: `@HasRoles(Admin)`.
- **Flow**:
  1. Gateway `CreateNotificationDto { recipientId, type, title, message, data? (@IsJSON) }` → `notification.NotificationService/CreateNotification` (body passed as is).
  2. `NotificationService.createNotification`: `parseData` (`JSON.parse`, 400 on failure) → `Notification.create` → `toReadModel` (`data` re-stringified) → SSE emit. No preference check, no recipient existence check, no transaction.
  3. Response `NotificationDto { id, recipientId, type, title, message, data?, isRead, readAt?, createdAt }`.

### GET /api/v1/notifications/preferences

- **Access**: signed-in; `identityId: req.user.sub`.
- **Flow**: `notification.NotificationPreferencesService/GetPreferences` → `NotificationPreferencesService.getPreferences`: `NotificationPreference.upsert` with `update: {}` (a read that creates the all-`true` default row on first call). Response `NotificationPreferencesDto { id, identityId, emailEnabled, pushEnabled, achievementEnabled, reportEnabled, systemEnabled, blogCommentEnabled, commentReplyEnabled, forumReplyEnabled, updatedAt }`.

### PATCH /api/v1/notifications/preferences

- **Access**: signed-in; `identityId: req.user.sub`.
- **Flow**:
  1. Gateway `UpdatePreferencesReqDto`: all eight switches optional booleans (`blogCommentEnabled` = comment on my blog post, `commentReplyEnabled` = reply to my blog comment or quote of my forum reply, `forumReplyEnabled` = reply in my thread) → `notification.NotificationPreferencesService/UpdatePreferences` (proto `optional BoolValue`, so omitted stays `undefined`).
  2. `updatePreferences`: `NotificationPreference.upsert` by `identity_id`; omitted fields are left unchanged (update) or take the schema default `true` (create).
  3. Response `NotificationPreferencesDto`.
- Only `achievement`, `report`, `blogComment`, `commentReply`, `forumReply` are ever consulted (`isEnabled`, by the consumers); `emailEnabled`, `pushEnabled`, `systemEnabled` are stored but nothing reads them.

### GET /api/v1/notifications

- **Access**: signed-in; `recipientId: req.user.sub`.
- **Flow**: gateway `ListNotificationsQueryDto { type?, isRead? (str2bool), page? ≥1, limit? 1..100 }` → `NotificationService/ListNotifications` → `listNotifications`: three parallel queries on `notifications` (page `orderBy createdAt desc`, `count` with the same filter, `count` of unread for the recipient ignoring the filters). Default page 1, limit 10. Response `NotificationListDto { notifications[], totalCount, unreadCount }`.

### GET /api/v1/notifications/:id

- **Flow**: `NotificationService/GetNotification { id, recipientId: sub }` → `findOwned`: `Notification.findFirst` where `{ id, recipientId }`; another user's id → 404. Response `NotificationDto`.

### PATCH /api/v1/notifications/:id/read

- **Flow**: `NotificationService/MarkAsRead { id, recipientId: sub }` → `findOwned` (404) → if already read, return it unchanged; else `update { isRead: true, readAt: now }`. Response `NotificationDto`.

### POST /api/v1/notifications/read-all

- **Flow**: `NotificationService/MarkAllAsRead { recipientId: sub }` → `Notification.updateMany` where `{ recipientId, isRead: false }` → `{ isRead: true, readAt: now }`. Response empty.

### DELETE /api/v1/notifications/:id

- **Flow**: `NotificationService/DeleteNotification { id, recipientId: sub }` → `findOwned` (404) → `Notification.delete` by id (hard delete, two statements, no transaction). Response empty.

## Background work

### live

- **Outbox relay**: `MessagingModule.forRoot({ serviceName: 'live', relay: true })` over the `pub` connection publishes `outbox_events` (`live.room.created`, `live.room.deleted`); see [messaging.md §4](../messaging.md#4-the-relay-outboxrelay).
- **RabbitMQ consumers**: none. A `sub` connection (`apps/live/src/configs/rmq.sub.config.ts`) is opened with no subscribers.
- **BullMQ**: `BullModule.forRootAsync` (Redis) and `BullModule.registerQueue({ name: 'live' })` in `apps/live/src/live.module.ts`, but there is no producer (`@InjectQueue`) and no `@Processor`; no cron/interval jobs.
- **socket.io**: see [Chat socket](#chat-socket).

### notification

- **Outbox relay**: none (`relay: false`); notification publishes no events.
- **BullMQ / cron**: none.
- **SSE**: see [the stream](#get-apiv1notificationsstreamrecipientid-sse).
- **RabbitMQ consumers** (`apps/notification/src/app/events/handlers/`, sub connection `apps/notification/src/configs/rmq.sub.config.ts`, exchange `eventbus`, `defaultSubscribeErrorBehavior: NACK`, queues from `defineConsumerQueue` so retry/DLQ follow [messaging.md §6](../messaging.md#6-rabbitmq-topology)). Each handler is `@UseCls()` + `@RabbitSubscribe` + `@Transactional()`, runs `unwrapEvent` → `InboxService.claim(id, queue)` (skip if already processed) → `validatePayload` → work, so the inbox row and the notification rows commit together. They emit no events; every `createNotification` also pushes to SSE.

| Routing key                      | Queue                                       | Handler                            | What it does                                                                                                                                                                                                                                                                                                                                                                                                 | Tables                                                             |
| -------------------------------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `achievement.badge.earned`       | `notification.events.badge.earned`          | `achievement-earned.handler.ts`    | Payload `{ uid, badgeName }`. If `isEnabled(uid, 'achievement')`, one notification `type: 'achievement'` (Vietnamese title/message), `data { badgeName }`.                                                                                                                                                                                                                                                   | `inbox_events`, `notification_preferences` (read), `notifications` |
| `resource.report.created`        | `notification.events.report.created`        | `report-created.handler.ts`        | Payload `{ reportId, reportedBy, type, title, targetType?, targetId? }`. Calls `auth.AuthService/FindIdentityIdsByRole { role: Admin }` (gRPC, `AUTH_CLIENT` from `authService` config; an auth outage throws, so the message is retried). For each admin except the reporter with `report` enabled: notification `type: 'report'`, `data { reportId, targetType, targetId, action: '/report-management' }`. | same                                                               |
| `resource.report.status-changed` | `notification.events.report.status-changed` | `report-status-changed.handler.ts` | Payload `{ reportId, reportedBy, status, title }`. If the reporter has `report` enabled: notification `type: 'report'`, message built with `reportStatusText(status)` (Vietnamese phrase, raw status fallback), `data { reportId, status }`.                                                                                                                                                                 | same                                                               |

The other four consumers (`resource.blog-comment.created`, `resource.forum-reply.created`, `resource.flashcard-proposal.created`, `resource.flashcard-proposal.decided`) are documented in [resource-community.md](resource-community.md).

## Findings

- ~~`leave-room` accepted the uid room, so ban kicks could be dodged~~: fixed (S19; see [fixed-issues.md](../../fixed-issues.md)).
- `apps/gateway/src/live-gateway/dtos/req/ban-user-from-room.req.dto.ts:12` makes `reason` optional (proto `optional StringValue`), but live `apps/live/src/app/presentation/dtos/req/ban-user.req.dto.ts:6` requires `@IsString() reason`, so a ban without a reason appears to fail with 400 in live.
- `apps/live/src/app/services/chat.service.ts:124`: chat-log cursors are always encoded, even for an empty page (`id: undefined`), so following `nextCursor` past the end restarts from the first page instead of stopping (room list returns `''` instead).
- `apps/live/src/app/infra/repositories/chat-log.read.prisma.repository.ts:57`: logs are ordered `createdAt asc`, so the first page of `GET …/logs` is the oldest messages of the room, not the latest.
- `apps/gateway/src/live-gateway/live.router.controller.ts:68`: `GET …/logs` uses individual `@Query` params instead of a DTO (against AGENTS.md), with no upper bound on `limit` (live checks only `@IsPositive`), and has no membership or ban check, so any signed-in user, including one banned from the room, can read its full history.
- `apps/live/src/app/infra/repositories/room.prisma.repository.ts:60`: `removeRoom` updates by `id` without `isDeleted: false`, so deleting an already deleted room succeeds and emits another `live.room.deleted`, and an unknown id raises Prisma P2025, which reaches the client as 502 (same for `updateRoomSchedule` on a missing room); `NotFoundException` would give 404.
- `apps/live/src/app/services/chat.service.ts:178`: `closeRoom` runs inside the `@Transactional()` before the commit, so if the outbox insert or commit fails, sockets were already removed from a room that still exists.
- `apps/notification/src/app/services/notification.service.ts:65`: the SSE push happens before the surrounding consumer transaction commits; a later failure (e.g. one admin in the `report-created` loop) rolls the rows back but the pushes already went out, and the retry pushes them again.
- `apps/notification/src/app/services/notification-sse.service.ts`: fan-out is an in-process `EventEmitter2`/`Subject`, so with more than one notification replica, clients connected to another replica miss notifications; there is no heartbeat or `id`/`Last-Event-ID` replay either.
- `apps/gateway/src/live-ws-gateway/live-ws.router.controller.ts:20`: http-proxy-middleware only subscribes to the server's `upgrade` event after a first ordinary HTTP request reaches this route, so after a gateway restart a client using `transports: ['websocket']` only (no polling first) appears to get no WebSocket proxying until some polling request arrives (inferred from `node_modules/http-proxy-middleware/dist/http-proxy-middleware.js`, not tested).
- `apps/notification/src/bootstrap.ts:18`: `enableCors()` with no options (any origin) on the HTTP/SSE port, whose `stream/:recipientId` trusts the path; with the Envoy SSE port 8095 published (backlog S16), anyone reaching it can subscribe to any user's stream.
- Preferences `emailEnabled`, `pushEnabled`, `systemEnabled` are stored and exposed but never read anywhere in `apps/notification/src`.
- ~~Doc drift~~: the notification section of `services-and-data.md` now lists all preference columns and the seven consumed events.
