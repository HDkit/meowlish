# Achievement, file and authorization flows

Internal flows of `apps/achievement`, `apps/file-service` and `apps/authorization`, reached through `apps/gateway/src/achievement-gateway/achievement.router.controller.ts`, `apps/gateway/src/file-gateway/file.router.controller.ts` and the gateway's `ResourceAccessGuard` (`apps/gateway/src/auth/guards/resource-access.guard.ts`). Tables and RPCs are listed in [../services-and-data.md](../services-and-data.md#achievement-appsachievement) (also its file-service and authorization sections); terms such as envelope, outbox, inbox and `defineConsumerQueue` are defined in [../messaging.md](../messaging.md). Paths are given from the repo root.

Route prefixes: global prefix `api` plus URI version `v1` (`apps/gateway/src/bootstrap.ts`), then the `RouterModule` path (`apps/gateway/src/router.module.ts`: `/achievements`, `/files`), then the `@Controller` path (`badges`, empty). None of these routes has a throttle decorator, so the global `default` throttler applies: 100/min per IP and access-token subject (`apps/gateway/src/throttle.ts`). The global guard chain is `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard` → `ResourceAccessGuard` (`apps/gateway/src/gateway.module.ts`).

## Contents

| Operation                                                                                                                 | Access                          | Writes                                             | Events                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- | -------------------------- |
| [`GET /api/v1/achievements/badges`](#get-apiv1achievementsbadges)                                                         | public                          | -                                                  | -                          |
| [`GET /api/v1/achievements/badges/my`](#get-apiv1achievementsbadgesmy)                                                    | JWT                             | -                                                  | -                          |
| [`GET /api/v1/achievements/badges/my/progress`](#get-apiv1achievementsbadgesmyprogress)                                   | JWT                             | -                                                  | -                          |
| [`GET /api/v1/achievements/badges/:uid`](#get-apiv1achievementsbadgesuid)                                                 | public                          | -                                                  | -                          |
| [`POST /api/v1/files`](#post-apiv1files)                                                                                  | JWT                             | `files`                                            | -                          |
| [gRPC `FileService/CheckFilesOwnedBy`](#grpc-fileservicecheckfilesownedby)                                                | internal (auth, exam, resource) | -                                                  | -                          |
| [gRPC `FileService/GetUrls`](#grpc-fileservicegeturls)                                                                    | internal (auth, exam)           | -                                                  | -                          |
| [`ResourceAccessGuard` → `AuthorizationService/CheckOwnership`](#resourceaccessguard--authorizationservicecheckownership) | gateway guard                   | -                                                  | -                          |
| [Consumer `auth.user.login`](#authuserlogin--achievementeventsuserlogin)                                                  | RabbitMQ                        | `login_criteria`, `user_badges`, `outbox_events`   | `achievement.badge.earned` |
| [Consumer `exam.attempt.submitted`](#examattemptsubmitted--achievementeventsattemptsubmitted)                             | RabbitMQ                        | `attempt_criteria`, `user_badges`, `outbox_events` | `achievement.badge.earned` |
| [Consumer `exam.attempt.scored`](#examattemptscored--achievementeventsattemptscored)                                      | RabbitMQ                        | `attempt_criteria`, `user_badges`, `outbox_events` | `achievement.badge.earned` |
| [Consumer `*.file.added`](#filefileadded--fileeventsfileadded)                                                            | RabbitMQ                        | `files.ref_count`                                  | -                          |
| [Consumer `*.file.removed`, `*.files.removed`](#fileremoved-filesremoved--fileeventsfilesremoved)                         | RabbitMQ                        | `files.ref_count`                                  | -                          |
| [Job `cleanup-orphaned-files`](#bullmq-cleanup-orphaned-files-every-5-min)                                                | BullMQ, every 5 min             | `files` delete, MinIO objects                      | -                          |
| [Consumers `exam.exam.*`, `live.room.*`, `resource.resource.*`](#ownership-consumers)                                     | RabbitMQ                        | `resource_ownership`                               | -                          |
| [Seed backfill](#seed-backfill-appsauthorizationprismaseedts)                                                             | `prisma:seed`                   | `resource_ownership`, `live.rooms.created_by`      | -                          |

## Achievements (`AchievementGatewayController`, `@Controller('badges')`)

All four routes call `achievement.AchievementService` over gRPC (`ErrorHandlingGrpcProxy`, `apps/gateway/src/achievement-gateway/achievement.router.module.ts`). Service side: `apps/achievement/src/presentation/controllers/badge.controller.ts` dispatches to CQRS query handlers in `apps/achievement/src/app/queries/handlers/`, which read through `BadgeReadPrismaRepositoryImpl` (`apps/achievement/src/infra/repositories/badge.read.prisma.repository.impl.ts`). No transaction, no side effects.

### GET /api/v1/achievements/badges

- **Access**: `@IsPublic()`.
- **Flow**: `AchievementService/GetAll` → `GetBadgesQueryHandler` → `badge.findMany` ordered by `name desc` (`Badge` / `badges`). Response `FoundBadgesDto { badges: { name, displayName, description }[] }`. The catalogue is filled only by `apps/achievement/prisma/seed.ts` (`createMany` over every `Badge` enum value, `skipDuplicates`).

### GET /api/v1/achievements/badges/my

- **Access**: JWT; `userId` is `req.user.sub`.
- **Flow**:
  1. Gateway DTO `GetUsersBadgesDto` (`apps/gateway/src/achievement-gateway/dtos/req/get-users-badges.req.dto.ts`): optional `cursor` string, optional positive int `limit`, at most 100 (`@Max`, also enforced by the service DTO). Calls `AchievementService/GetUsersBadges({ cursor, limit, userId: sub })`.
  2. `GetUsersBadgesQueryHandler` (`apps/achievement/src/app/queries/handlers/get-users-badges.handler.ts`): decodes the opaque cursor (`CursorPaginationFactory.create('GetBadges')`, `@server/utils`); a cursor whose `userId` differs from the request's is discarded. `limit` = request, else cursor, else 10; `direction` from the cursor (default 1).
  3. `getUsersBadges`: `userBadge.findMany where uid`, order `updatedAt desc, id desc`, `take: direction * limit`, Prisma cursor on `lastId` with `skip: 1`; joins `badge` for names.
  4. Response `FoundUsersBadgesDto { badges: { id, name, displayName, description, date }[], nextCursor, prevCursor }`. Both cursors are always returned, even for an empty page.
- **Errors**: unclear: what an undecodable cursor produces (depends on `CursorPaginationHelper.decodeCursor`).

### GET /api/v1/achievements/badges/my/progress

- **Access**: JWT; `userId` is `req.user.sub`.
- **Flow**: `AchievementService/GetUsersProgess` (sic) → `GetUsersProgressQueryHandler` → `loginCriteria.findUnique` and `attemptCriteria.findUnique` by `uid`. Response `ProgressDto { loginProgress?: { longestStreak, streak, total }, submissionProgress?: { goodScore, perfectScore, total } }`; each part is absent when the user has no row yet. `streak` is `currentLoginStreakDays(startedAt, lastLogin, now)` (`apps/achievement/src/domain/entities/login-badge-manager.entity.ts`): the streak length while the last login was today or yesterday (UTC days, as in `updateProgress`), 0 once a whole UTC day has been missed. `longestStreak` is returned as stored.

### GET /api/v1/achievements/badges/:uid

- **Access**: `@IsPublic()`; any user's badge list is readable by anyone.
- **Flow**: same as `/my` with `userId: uid` from the path.

## Files (`FileGatewayController`, `@Controller()` under `/files`)

### POST /api/v1/files

Creates a `files` row and returns a presigned POST policy for direct browser upload to MinIO.

- **Access**: JWT. `uploadedBy` is set from `req.user.sub`; the body cannot supply it.
- **Flow**:
  1. Gateway DTO `GetPresignedUrlDto` (`apps/gateway/src/file-gateway/dtos/req/get-presigned-url.req.dto.ts`): `isPublicFile` boolean, `fileName` string, `fileSize` positive int, `contentType` `@IsMimeType()`; it `implements Omit<file.GetPresignedUrlDto, 'uploadedBy'>`. Calls `FileService/GetPresignedUrl({ ...body, uploadedBy: sub })`.
  2. `FileController.getPresignedUrl` (`apps/file-service/src/presentation/controllers/file.controller.ts`) → `FileService.getPresignedUrl` (`apps/file-service/src/app/services/file.service.ts`).
  3. Checks that `fileSize` is a whole number from 1 byte to 10 MiB and `contentType` is one of `image/jpeg, image/png, application/pdf, video/mp4, audio/mpeg`; each violation is a `BadRequestException` with the reason.
  4. `FilePrismaRepositoryImpl.create` inserts `File` (`files`): server-generated uuid `id`, `name`, `size`, `mime_type`, `isPublic`, `uploaded_by`; `ref_count` 0, `is_system` false. Not in a `@Transactional()` (single statement).
  5. Builds a MinIO `PostPolicy`: bucket `public` or `private`, key = the new row id, expiry 15 min (`UPLOAD_URL_EXPIRY_SECONDS`), content length 1..`fileSize` (`file.service.ts:142`), `Content-Type` equal to the declared type (header only; the object body is not inspected). Signed with `signingClient`, a MinIO client pointed at `MINIO_PUBLIC_URL` when set, so the signature matches the host the browser uses. Signing is local (fixed region `us-east-1`).
  6. Response `PresignedUrlResponseDto { id, fileName, uploadUrl, formData }` (`strategy: 'exposeAll'`). The browser then POSTs the file to `uploadUrl` with `formData`; that upload never passes through the gateway.
- **Async**: none. The row stays at `ref_count` 0 until an attaching service publishes `<svc>.file.added`; if that never happens it is deleted by [the orphan cleanup](#bullmq-cleanup-orphaned-files-every-5-min) once untouched for 1 h.
- **Errors**: 400 for a non-integer, zero or negative `fileSize` (gateway DTO), and for a file over 10 MiB or a disallowed type (file-service, message names the limit or the allowed types). Bucket creation and the public-read policy on `public` are set up in `FileService.onModuleInit`.

### gRPC FileService/CheckFilesOwnedBy

No HTTP route. Called by `FileOwnershipService.assertOwnedBy` in `apps/auth/src/app/services/file-ownership.service.ts` (avatar, from `update-identity.handler.ts`), `apps/exam/src/app/services/file-ownership.service.ts` (`ExamManagementController` `addFiles`, admins skip it) and `apps/resource/src/app/services/file-ownership.service.ts` (`report.service.ts`). See [../authorization.md §7(c)](../authorization.md#c-attaching-a-file-someone-else-uploaded).

- **Flow**: `CheckFilesOwnedByDto { fileIds: string[], userId }` → `FileService.checkFilesOwnedBy`: dedupes ids, returns `{ ok: true, foreignIds: [] }` for an empty list, else `findIdsUploadedBy` (`files where id in ids and uploaded_by = userId`). Every id not returned is foreign: other users' uploads, rows with `uploaded_by NULL` (legacy/seeded/system) and unknown ids. Response `FilesOwnershipDto { ok, foreignIds }`.
- **Errors**: the callers turn `ok: false` into 403 `You can only attach files you uploaded: <ids>`.

### gRPC FileService/GetUrls

No HTTP route. Called by auth (avatar hydration) and exam (question/section/attempt files) query handlers.

- **Flow**: `GetUrlsDto { ids }` → `FileService.getFilesUrls`: `files.findMany` for `id, isPublic`; public files get `<MINIO_PUBLIC_URL or scheme://host:port>/public/<id>`, private files a presigned GET valid **5 min** (`file.service.ts:200`). Unknown ids are omitted. Response `UrlsDto { urls: Record<id, url> }`. No ownership check (viewing is unrestricted).

## Authorization (ownership store)

The service exposes `AuthorizationService` with the single RPC `CheckOwnership` (`apps/authorization/src/app/services/authorization.grpc.controller.ts`) backed by `OwnershipPrismaRepositoryImpl` (`apps/authorization/src/app/infra/repositories/ownership.prisma.repository.ts`) on table `resource_ownership` (`ResourceOwnership`, unique `(resource_type, resource_id)`). Background and the list of `@ResourceAccess` routes: [../authorization.md §5](../authorization.md#5-legacy-resourceaccess-and-the-authorization-service). Of the gateway guards in `apps/gateway/src/auth/guards/`, only `ResourceAccessGuard` calls this service; `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` and `CookieIssuanceGuard` are local checks (see ../authorization.md §2-4).

### ResourceAccessGuard → AuthorizationService/CheckOwnership

Used by `PATCH`/`DELETE /api/v1/resources/blogs/:id` (`blog`), `PATCH`/`DELETE /api/v1/resources/flash-cards/:id` (`flashcard`), `DELETE /api/v1/chat/rooms/:roomId` and `PATCH /api/v1/chat/rooms/:roomId/schedule` (`room`).

- **Flow**:
  1. Global guard, runs after `JwtAuthGuard`/`RolesGuard`/`PermissionsGuard`. Returns true for `@IsPublic()` routes and routes without `@ResourceAccess` metadata.
  2. Reads `{ resourceType, resourceIdParam, rules }`, takes `req.params[resourceIdParam]`. For each rule in order: skip if the user has none of `rule.roles`; allow if `requireOwnership` is unset; skip if the path param is empty; else `CheckOwnership({ userId: sub, resourceType, resourceId })` (`lastValueFrom`) and allow if `isOwner`.
  3. Service side: `checkOwnership` = `resourceOwnership.findUnique` on `(resourceType, resourceId)`, `isOwner = record?.ownerId === userId`. A missing row is "not owner". Response `CheckOwnershipResponseDto { isOwner }`.
- **Errors**: no matching rule → 403 `Access denied. You do not have the required role or ownership for this resource.` (raised before the owning service is called, so ids of others' blogs/cards get 403, not 404). Authorization service down → gRPC `UNAVAILABLE` → 503 via the gateway's gRPC filter. The ownership row is written asynchronously from the owning service's outbox, so a resource edited within ~1 s of creation (relay poll) can be refused.

## Background work

### Achievement consumers

Shared shape (`apps/achievement/src/app/events/handlers/*.handler.ts`): `@UseCls()` + `@RabbitSubscribe({ connection: 'sub', exchange: 'eventbus', ... })`, `prefetchCount: 1` (`apps/achievement/src/configs/rmq.sub.config.ts`). The handler unwraps the envelope, then runs `inTransactionRetryingConflicts` (`apps/achievement/src/app/events/handlers/version-conflict.ts`): `retryOnConflict(() => txHost.withTransaction(work), { attempts: 3, isConflict: P2025 })` from `libs/messaging/src/lib/retry-on-conflict.ts`, no delay between attempts. Each attempt is a fresh transaction containing the inbox claim (`InboxService.claim(id, <queue name>)`), payload validation (`validatePayload`), load, domain update and save, so a rolled-back attempt also rolls back its claim. After the third conflict, or on any other error, the error propagates to the broker retry/DLQ chain ([../messaging.md §6](../messaging.md#6-rabbitmq-topology)).

Repository (`apps/achievement/src/infra/repositories/badge-manager.prisma.repository.impl.ts`):

- **Load**: `upsert` the criteria row by `uid` (create defaults; `login_criteria` gets `started_at = last_login = now()`), then `userBadge.findMany` filtered to the manager's `BadgeType` (`LOGIN`, `ATTEMPT_COUNT`, `ATTEMPT_SCORE`; `apps/achievement/src/enums/badge.enum.ts`).
- **Save**: `update where { uid, version }` with `version + 1` (`:132`, `:146`, `:160`); a stale version raises P2025, which triggers the retry. Then for each `BadgeAddedEvent` raised by the aggregate: `userBadge.createMany(..., skipDuplicates)` (conflicts on the unique `(uid, badge)` index) and, if a row was inserted, `outbox.add('achievement.badge.earned', { uid, badgeName: <display name> })` (enveloped) in the same transaction (`:179-187`).
- `AttemptCounterBadgeManager` and `AttemptScoreBadgeManager` share the `attempt_criteria` row and its `version`, so the submitted and scored queues conflict with each other; the conflict retry absorbs it.

`achievement.badge.earned` → `notification.events.badge.earned` → `apps/notification/src/app/events/handlers/achievement-earned.handler.ts` (inbox yes): if the user's `achievement` preference is enabled, creates an `achievement` notification for `uid`.

#### `auth.user.login` → `achievement.events.user.login`

Published by `apps/auth/src/app/events/publisher/logged-in.publisher.ts` as `{ uid, date: ISO string }`. `LoginHandler` validates `uid` string, `date` as `Date`, loads `LoginBadgeManager`, calls `updateProgress(date)`, saves (`login_criteria`, `user_badges`, `outbox_events`).

Streak computation (`apps/achievement/src/domain/entities/login-badge-manager.entity.ts`, days are UTC calendar dates via `utcCalendarDaysBetween` in `apps/achievement/src/domain/utc-calendar-days.ts`):

1. `total === 0` (first login): `total = 1`, `startedAt = lastLogin = loginTime`.
2. Else `diff = utcDays(loginTime) - utcDays(lastLogin)`: `diff < 0` (late, out-of-order event) returns without changes or badges; `diff >= 1` increments `total` (distinct login days); `diff >= 2` restarts the streak (`startedAt = loginTime`); `lastLogin = loginTime`.
3. `longestStreak = max(longestStreak, utcDays(lastLogin) - utcDays(startedAt) + 1)`.
4. Catch-up: every login checks **all** thresholds, total days 7/14/30/365 → `LOGIN_SEVEN_DAYS`/`LOGIN_TWO_WEEKS`/`LOGIN_ONE_MONTH`/`LOGIN_ONE_YEAR`, longest streak 7/14/30/365 → the `*_STREAK` badges. `addBadge` skips badges already in the loaded set, so a badge whose threshold was passed earlier (e.g. the 14-day ones, which were previously unmapped) is awarded on the next login.

#### `exam.attempt.submitted` → `achievement.events.attempt.submitted`

Published by `apps/exam/src/app/events/publishers/attempt-submitted.publisher.ts` as `{ attemptId, attemptedBy }`. `AttemptSubmittedHandler` loads `AttemptCounterBadgeManager` for `attemptedBy`, `updateProgress(1)`: `total + 1`; thresholds 1/10/100 → `FIRST_`/`TENTH_`/`HUNDREDTH_COMPLETE_ATTEMPT`. Writes `attempt_criteria.total`.

#### `exam.attempt.scored` → `achievement.events.attempt.scored`

Published by `apps/exam/src/app/events/publishers/attempt-scored.publisher.ts` as `{ attemptId, attemptedBy, score, totalPoints }`, once per attempt from `AttemptEvaluator.evaluateScore` (`apps/exam/src/domain/entities/attempt-evaluator.entity.ts`); the re-score after AI writing feedback raises no event, so writing points never count here. `AttemptScoredHandler` computes `rank = score / totalPoints` (0 when `totalPoints` is 0): `0.8 <= rank < 1` → `good + 1`, thresholds 1/10/100 → `*_GOOD_SCORE`; `rank === 1` → `perfect + 1`, thresholds → `*_PERFECT_SCORE`. Writes `attempt_criteria.good/perfect`.

### File-service consumers

`relay: false` (`apps/file-service/src/file.module.ts`): file-service writes no outbox events. Both handlers: `@UseCls()` + `@Transactional()`, inbox claim yes, `connection: 'sub'`, default prefetch.

#### `*.file.added` → `file.events.file.added`

`apps/file-service/src/app/events/handlers/file-added.handler.ts`. Publishers: `auth.file.added` (`apps/auth/src/app/events/publisher/file-added.publisher.ts`, avatar) and `exam.file.added` (`apps/exam/src/app/events/publishers/file-added.publisher.ts`, question/section files). Payload `{ fileId }`. `incrementRef([fileId])`: `updateMany files set ref_count + 1` (also bumps `updatedAt`). An unknown or already-deleted id updates 0 rows silently. `resource.file.added` (report attachments, `apps/resource/src/app/services/report.service.ts`).

#### `*.file.removed`, `*.files.removed` → `file.events.files.removed`

`apps/file-service/src/app/events/handlers/files-removed.handler.ts`, bound to both keys. Payload `{ file?: { id, count } }` or `{ files: { id, count }[] }`. `decrementRef`: one `updateMany ref_count - count` per file, sequential in the transaction, then one `updateMany ref_count = 0 where ref_count < 0` over those ids, so a count never goes below 0; unknown ids are skipped. Publishers on this branch: `auth.files.removed` and `exam.files.removed`, both from BullMQ jobs that drain the publisher's `deleted_files` table (`apps/exam/src/app/events/publishers/files-removed.publisher.ts`: `publish-deleted-files` every 60 s; auth's `files-removed.publisher.ts` likewise). No app publishes the singular `*.file.removed`.

#### BullMQ `cleanup-orphaned-files` (every 5 min)

`apps/file-service/src/infra/jobs/orphan-cleanup.job.ts`. `OrphanCleanupScheduler.onModuleInit` adds a repeatable job (`jobId: 'cleanup-orphaned-files'`, `repeat.every: 300 000 ms`) to queue `file` (Redis from `bullmq.config.ts`). `OrphanCleanupWorker.process`:

1. One transaction, timeout 60 s.
2. `lockOrphanedFiles`: raw `SELECT id, "isPublic" FROM files WHERE ref_count <= 0 AND is_system = false AND "updatedAt" < now - 1 h ORDER BY "updatedAt" LIMIT 500 FOR UPDATE SKIP LOCKED`.
3. `FileService.removeObjects`: MinIO `removeObjects` per bucket (`public`, `private`); keys the storage reports as failed are kept.
4. `removeOrphaned(removedIds)`: `deleteMany where id in ids and ref_count <= 0 and is_system = false`.
5. Errors are caught and logged, so the job never fails in BullMQ; a failed MinIO request rolls the transaction back and the rows are retried next run. A concurrent `incrementRef` blocks on the row lock and then updates 0 rows.

### Ownership consumers

`apps/authorization/src/app/events/handlers/{exam,live,resource}-ownership.handler.ts`, queues in `ownership-queues.ts` (each queue name is also the inbox consumer). All: `@UseCls()` + `@Transactional()`, inbox claim yes, then the payload is validated with `validatePayload` against the classes in `apps/authorization/src/app/events/integration-events.ts` (non-empty string `resourceId`, plus `ownerId` on `created` and `resourceType` on `resource.resource.*`); a malformed payload fails with `BadRequestException` before any write and goes through the retry/DLQ chain. `connection: 'sub'`.

| Routing key                 | Queue                                   | Publisher                                                                                                                    | Action                                           |
| --------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `exam.exam.created`         | `authorization.events.exam.created`     | `apps/exam/src/app/commands/handlers/management/create-exam.handler.ts`                                                      | `registerOwnership('exam', resourceId, ownerId)` |
| `exam.exam.deleted`         | `authorization.events.exam.deleted`     | `delete-exam.handler.ts`                                                                                                     | `removeOwnership('exam', resourceId)`            |
| `live.room.created`         | `authorization.events.room.created`     | `apps/live/src/app/services/chat.service.ts` `createRoom` (only when `createdBy` is set)                                     | `registerOwnership('room', ...)`                 |
| `live.room.deleted`         | `authorization.events.room.deleted`     | `chat.service.ts` `removeRoom`                                                                                               | `removeOwnership('room', ...)`                   |
| `resource.resource.created` | `authorization.events.resource.created` | `apps/resource/src/app/events/resource-events.publisher.ts` (`blog`, `flashcard`; also fork and proposal-accept card copies) | `registerOwnership(payload.resourceType, ...)`   |
| `resource.resource.deleted` | `authorization.events.resource.deleted` | same publisher; list deletion emits one per card                                                                             | `removeOwnership(payload.resourceType, ...)`     |

`registerOwnership` is `createMany(..., skipDuplicates)`: first owner wins. `removeOwnership` ignores a missing row. Exam ownership rows are still kept, but no route reads them.

### Seed backfill (`apps/authorization/prisma/seed.ts`)

Run by `prisma:seed` / `pnpm db:setup`. Connects directly to `exam_db`, `resource_db` and `live_db` (`EXAM_DB_URL` etc. or built from `POSTGRES_*`). Upserts ownership for every `exams.created_by` (`exam`), `blogs.author_id` (`blog`) and `flash_cards.author_id` (`flashcard`), with `update: { ownerId }`, so the seed overwrites existing owners from the source of truth. It deletes the `flashcard-list` rows earlier versions seeded (nothing reads them). For rooms it first copies `resource_ownership` `room` owners into `live.rooms.created_by` where that is `NULL`, then upserts a `room` ownership row for every room with a `created_by`, so a room whose `live.room.created` was lost still gets one. Row-by-row, not transactional, re-runnable.

### Outbox relay and inbox (`libs/messaging`)

Producers write enveloped rows to `outbox_events` with `OutboxPublisher.add` inside the business transaction; consumers claim `(event id, consumer)` in `inbox_events` with `InboxService.claim` inside the handler transaction. `OutboxRelay` (`libs/messaging/src/lib/outbox.relay.ts`) polls every **1000 ms** (batch of 100, `FOR UPDATE SKIP LOCKED`, back-off up to 300 s) and prunes outbox/inbox rows older than 7 days 60 s after boot and then every 24 h. In this scope: achievement runs the relay (`relay: true`, `pub` connection) and publishes `achievement.badge.earned`; authorization runs it on its `sub` connection but writes no outbox rows (it serves only the cleanup); file-service has `relay: false`, so nothing prunes its `inbox_events`. Details: [../messaging.md §4-5](../messaging.md#4-the-relay-outboxrelay).

## Findings

1. ~~`user_badges` has no unique constraint on `(uid, badge)`, so `skipDuplicates` never conflicts~~: fixed (see fixed-issues.md).
2. ~~Progress `streak` shows an old streak as current~~: fixed (see fixed-issues.md).
3. ~~`GetUsersBadgesDto.limit` has no `@Max`~~: fixed (see fixed-issues.md).
4. ~~Oversized or disallowed uploads surface as 502; `fileSize` accepts 0, negatives and fractions~~: fixed (see fixed-issues.md).
5. ~~Gateway `GetPresignedUrlDto` does not implement the generated message~~: fixed (see fixed-issues.md).
6. ~~Orphan cleanup can delete a file presigned more than 1 h before its late `file.added`~~: backlog X1.
7. ~~`ref_count` can go negative~~: fixed (see fixed-issues.md).
8. ~~Ownership event payloads are never validated~~: fixed (see fixed-issues.md).
9. ~~Rooms are never backfilled into `resource_ownership` from `live.rooms.created_by`~~: fixed (see fixed-issues.md).
10. ~~Dead `flashcard-list` ownership rows are seeded~~: fixed (see fixed-issues.md).
11. ~~`RegisterOwnership` / `RemoveOwnership` are unused and unchecked~~: fixed, removed from the proto (see fixed-issues.md).
