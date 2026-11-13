# Services and data

Per service: what it owns, its Prisma models (from `apps/<svc>/prisma/schema/*.prisma`), its gRPC surface (`proto/*.proto`), and the events it publishes and consumes. Event details (payloads, queues, retry) are in [messaging.md](messaging.md); authorization rules in [authorization.md](authorization.md).

Every service with a database owns exactly one Postgres database (`docker/postgres/init-databases.sql` creates `auth_db`, `authorization_db`, `exam_db`, `achievement_db`, `resource_db`, `file_db`, `live_db`, `notification_db`) and its own generated Prisma client (`@prisma-client/<svc>`). No service reads another service's database at runtime; the only cross-database code is the authorization seed (`apps/authorization/prisma/seed.ts`).

Every database also has the two messaging tables, identical in all services (`apps/*/prisma/schema/messaging.prisma` = `libs/messaging/prisma/messaging.prisma`):

| Table           | Key columns                                                                                                                                                                    | Purpose                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `outbox_events` | `id uuid` PK, `routing_key`, `payload jsonb`, `created_at`, `published_at?`, `attempts`, `next_attempt_at`, `last_error?`; index `(published_at, next_attempt_at, created_at)` | Events written in the business transaction, published by the relay |
| `inbox_events`  | PK `(id, consumer)`, `processed_at` (indexed)                                                                                                                                  | Event ids a consumer queue already processed                       |

They are not repeated in the per-service tables below.

## Overview

| Service            | Ports (compose)                 | DB                 | Other infra                                   | gRPC services                                                               | Publishes                                                                                                                              | Consumes                                                              |
| ------------------ | ------------------------------- | ------------------ | --------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| gateway            | HTTP 3000                       | -                  | Redis                                         | client of all                                                               | -                                                                                                                                      | -                                                                     |
| auth               | gRPC 50050, health 9101         | `auth_db`          | Redis (revocation, BullMQ), file-service gRPC | `AuthService`                                                               | `auth.user.login`, `auth.user.locked`, `auth.file.added`, `auth.files.removed`                                                         | -                                                                     |
| authorization      | gRPC 50050, health 9108         | `authorization_db` | -                                             | `AuthorizationService`                                                      | - (relay runs, nothing written)                                                                                                        | `exam.exam.*`, `live.room.*`, `resource.resource.*` (created/deleted) |
| exam               | gRPC 50050, health 9102         | `exam_db`          | Redis (BullMQ), file-service gRPC             | `ExamManagementService`, `ExamPracticeService`, `TagService`, `GoalService` | `exam.exam.created/deleted`, `exam.attempt.submitted/scored`, `exam.writing.submitted` (bare), `exam.file.added`, `exam.files.removed` | `exam.writing.scored` (bare)                                          |
| achievement        | gRPC 50050, health 9103         | `achievement_db`   | -                                             | `AchievementService`                                                        | `achievement.badge.earned`                                                                                                             | `auth.user.login`, `exam.attempt.submitted`, `exam.attempt.scored`    |
| resource           | gRPC 50050, health 9104         | `resource_db`      | file-service gRPC                             | `BlogService`, `FlashCardService`, `FlashCardListService`, `ReportService`  | `resource.resource.created/deleted`, `resource.report.status-changed`                                                                  | -                                                                     |
| file-service       | gRPC 50050, health 9106         | `file_db`          | MinIO, Redis (BullMQ)                         | `FileService`                                                               | - (`relay: false`)                                                                                                                     | `*.file.added`, `*.file.removed`, `*.files.removed`                   |
| live               | gRPC 50050, socket.io/HTTP 1511 | `live_db`          | Redis (socket.io adapter, BullMQ)             | `ChatService`                                                               | `live.room.created/deleted`                                                                                                            | -                                                                     |
| notification       | gRPC 50060, HTTP/SSE 50061      | `notification_db`  | -                                             | `NotificationService`, `NotificationPreferencesService`                     | - (`relay: false`)                                                                                                                     | `achievement.badge.earned`, `resource.report.status-changed`          |
| mock-ai-scorer     | health 9110 (profile `mock-ai`) | -                  | -                                             | -                                                                           | `exam.writing.scored` (bare, direct)                                                                                                   | `exam.writing.submitted` (bare)                                       |
| external AI scorer | not in this repo                | ?                  | ?                                             | -                                                                           | `exam.writing.scored` (bare)                                                                                                           | `exam.writing.submitted` (bare)                                       |

Ports are from `docker/docker-compose.app.yaml`. Synchronous service-to-service gRPC: auth, exam and resource call file-service (`file.FileServiceClient`: `GetUrls` in query handlers, `CheckFilesOwnedBy` in each `app/services/file-ownership.service.ts`). No other service calls another service's gRPC API; the gateway calls all of them.

Migrations: auth, exam, achievement and file-service have `prisma/migrations/`; authorization, live, notification and resource have none on this branch and are applied with `prisma db push` (their `project.json` targets; `docs/operations/upgrade-notes.md` §4).

## gateway (`apps/gateway`)

No database. HTTP routes under `/api/v1` (global prefix `api`, URI versioning default `1`, `apps/gateway/src/bootstrap.ts`), grouped by `RouterModule` (`apps/gateway/src/router.module.ts`):

| Prefix                      | Module / controller                                      | Backend                                                                     |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/api/v1/auth`              | `auth-gateway/auth.router.controller.ts`                 | auth gRPC, Redis                                                            |
| `/api/v1/exams`             | `exam-gateway/*` (`management`, practice, tags, goals)   | exam gRPC                                                                   |
| `/api/v1/files`             | `file-gateway/file.router.controller.ts`                 | file-service gRPC                                                           |
| `/api/v1/achievements`      | `achievement-gateway/achievement.router.controller.ts`   | achievement gRPC                                                            |
| `/api/v1/chat`              | `live-gateway/live.router.controller.ts` (`rooms`)       | live gRPC                                                                   |
| `/api/v1/chat/ws/socket.io` | `live-ws-gateway/live-ws.router.controller.ts`           | HTTP/WebSocket proxy to live :1511                                          |
| `/api/v1/notifications`     | `notification-gateway/notification.router.controller.ts` | notification gRPC; `stream/:recipientId` proxied to notification HTTP (SSE) |
| `/api/v1/resources`         | `resource-gateway/resource.router.controller.ts`         | resource gRPC                                                               |

Also: `/reference` (Scalar API docs, built from the Swagger document in `bootstrap.ts`) and `/health/live`, `/health/ready` outside the prefix. Redis keys: `oauth2:google:loginToken:<uuid>` (60 s), `gateway:oauth2:state:<nonce>` (300 s). Rate limiting: `@nestjs/throttler` with in-memory storage (`apps/gateway/src/throttle.ts`; no storage option is configured), 100/min per IP on every route, strict auth routes 10/min per IP+account plus a 100/min per-IP ceiling.

## auth (`apps/auth`)

Identities, credentials, roles/permissions, token issuing and revocation, Google Calendar tokens. Schema `apps/auth/prisma/schema/auth.prisma`.

| Model                 | Table                    | Key columns                                                                                                                                              | Relations                                                 | Purpose                                                                                             |
| --------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Identity`            | `identities`             | `id`, `version`, `username` (unique), `full_name`, `bio`, `avatar_file_id`, `phone_number` (unique), `is_locked`, `locked_at`, `locked_by`, `deleted_at` | has `credentials`, `identityRoles`, `googleCalendarToken` | A user account                                                                                      |
| `Credential`          | `credentials`            | `id`, `identity_id`, `identifier`, `secret_hash?`, `login_type`; unique `(identifier, login_type)`, `(identity_id, login_type)`                          | → `Identity` (cascade)                                    | Login methods (mail + bcrypt hash, Google id); one per type per identity                            |
| `Role`                | `roles`                  | `id`, `name` (unique)                                                                                                                                    | `rolePermissions`, `identityRoles`                        | Role catalogue (seeded from `Role` enum)                                                            |
| `Permission`          | `permissions`            | `id`, `name` (unique)                                                                                                                                    | `rolePermissions`                                         | Permission catalogue (seeded from `Permission` enum)                                                |
| `RolePermission`      | `roles_permissions`      | PK `(role_id, permission_id)`                                                                                                                            | → `Role` (cascade), → `Permission`                        | Role → permission mapping (`apps/auth/prisma/seed.ts`)                                              |
| `IdentityRole`        | `identity_roles`         | PK `(identity_id, role_id)`                                                                                                                              | → `Role`, → `Identity` (cascade)                          | Role assignment                                                                                     |
| `DeletedFile`         | `deleted_files`          | `file_id` PK, `count`                                                                                                                                    | -                                                         | Staging for released file references; a BullMQ job (every 60 s) drains it into `auth.files.removed` |
| `GoogleCalendarToken` | `google_calendar_tokens` | `id`, `identity_id` (unique), `access_token`, `refresh_token`, `expires_at`, `scopes`                                                                    | → `Identity` (cascade)                                    | Google Calendar OAuth tokens, kept server-side (refresh token never returned)                       |

Not in Postgres: revocation timestamps in Redis (`jwt:blacklist:user:<id>`).

gRPC `AuthService` (`proto/auth.proto`): register/login mail, add mail credential, update password, register-or-login Google, add Google credential, get/remove credentials, `Refresh`, `ValidateRefresh`, `ValidateAccess`, `LogOutAll`, role/permission lists, assign/remove role, `UpdateIdentity`, lock/unlock, Google Calendar connect/disconnect/get/refresh token, find/hydrate identities.

Events: `auth.user.login` (mail login, Google login), `auth.user.locked` (no consumer in the repo), `auth.file.added` (avatar), `auth.files.removed` (BullMQ job).

## authorization (`apps/authorization`)

Ownership copy for `@ResourceAccess` (legacy; see [authorization.md §5](authorization.md#5-legacy-resourceaccess-and-the-authorization-service)). Schema `apps/authorization/prisma/schema/ownership.prisma`.

| Model               | Table                | Key columns                                                                                                                                                   | Purpose                                                                                                                      |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ResourceOwnership` | `resource_ownership` | `id` (cuid), `resource_type`, `resource_id`, `owner_id`, `created_at`; unique `(resource_type, resource_id)`; indexes `owner_id`, `(resource_type, owner_id)` | One owner per resource. Types written at runtime: `exam`, `room`, `blog`, `flashcard`; the seed also writes `flashcard-list` |

gRPC `AuthorizationService` (`proto/authorization.proto`): `CheckOwnership`, `RegisterOwnership`, `RemoveOwnership` (only `CheckOwnership` is called, by `ResourceAccessGuard`).

Consumes (queues `authorization.events.{exam,room,resource}.{created,deleted}`): `exam.exam.created/deleted`, `live.room.created/deleted`, `resource.resource.created/deleted`. Runs the relay on the `sub` connection but writes no outbox events.

## exam (`apps/exam`)

Exams and their content tree, practice attempts and scoring, tags, goals. Schemas `apps/exam/prisma/schema/{exam,exam-practice,file,goal,tag}.prisma`.

| Model                                    | Table                                          | Key columns                                                                                                                                                                                         | Relations                                                                   | Purpose                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Exam`                                   | `exams`                                        | `id`, `created_by`, `version`, `title`, `description?`, `status`, `duration` (s), timestamps; indexes `status`, `version`, `(updated_at, id)`                                                       | `sections`, `examAttempts`, `examTags`                                      | An exam; `created_by` drives the creator-or-admin rule                                                                                    |
| `Section`                                | `sections`                                     | `id`, `exam_id`, `parent_id?`, `name?`, `directive`, `order`, `content_type`                                                                                                                        | → `Exam` (cascade), self-parent (cascade), questions, closures, files, tags | Nested sections of an exam                                                                                                                |
| `SectionClosure`                         | `section_closures`                             | PK `(ancestor_id, descendant_id)`, `depth`                                                                                                                                                          | → `Section` ×2 (cascade)                                                    | Closure table for the section tree                                                                                                        |
| `Question`                               | `questions`                                    | `id`, `section_id`, `content`, `type` (default `MCQ`), `points`, `explanation`, `order`                                                                                                             | → `Section` (cascade), choices, responses, files, tags                      | A question                                                                                                                                |
| `Choice`                                 | `choices`                                      | `id`, `key`, `content?`, `is_correct`, `question_id`                                                                                                                                                | → `Question` (cascade)                                                      | Answer options                                                                                                                            |
| `Attempt`                                | `attempts`                                     | `id`, `attempted_by`, `exam_id`, `started_at`, `ended_at?`, `duration_limit`, `score?`, `total_points?`, `is_strict`, `version` (optimistic lock), `order`; unique `(exam_id, attempted_by, order)` | → `Exam` (cascade), responses, sections                                     | A practice attempt; `order` prevents two active attempts per user and exam                                                                |
| `AttemptSection`                         | `attempt_sections`                             | PK `(attempt_id, section_id)`                                                                                                                                                                       | → `Attempt`, → `Section` (cascade)                                          | Sections included in an attempt                                                                                                           |
| `AttemptResponse`                        | `attempt_responses`                            | `id`, `attempt_id`, `question_id`, `answers[]`, `is_correct?`, `is_flagged`, `note?`; unique `(attempt_id, question_id)`                                                                            | → `Attempt`, → `Question` (cascade), `scorerDatas`                          | The user's answer per question                                                                                                            |
| `ScorerData`                             | `scorer_data`                                  | `response_id` PK, `comment` (JSON)                                                                                                                                                                  | → `AttemptResponse` (cascade)                                               | AI writing feedback from `exam.writing.scored`                                                                                            |
| `SectionFile`                            | `section_files`                                | PK `(section_id, file_id)`, `updatedAt`                                                                                                                                                             | → `Section` (cascade)                                                       | Files attached to a section (ids from file-service)                                                                                       |
| `QuestionFile`                           | `question_files`                               | PK `(question_id, file_id)`, `updatedAt`                                                                                                                                                            | → `Question` (cascade)                                                      | Files attached to a question                                                                                                              |
| `DeletedFile`                            | `deleted_files`                                | `file_id` PK, `count`                                                                                                                                                                               | -                                                                           | Released file references; BullMQ job every 60 s → `exam.files.removed` (`apps/exam/src/app/events/publishers/files-removed.publisher.ts`) |
| `Goal`                                   | `goals`                                        | `uid` PK, `date`, `target`, `type`                                                                                                                                                                  | -                                                                           | A user's study goal (target score is sent to the AI scorer)                                                                               |
| `Tag`                                    | `tags`                                         | `id`, `name` (unique), `lft`, `rgt`; index `(lft, rgt)`                                                                                                                                             | `examTags`, `sectionTags`, `questionTags`                                   | Tag tree as a nested set                                                                                                                  |
| `TagTableLock`                           | `tags_table_lock`                              | `version` PK                                                                                                                                                                                        | -                                                                           | Row used to serialize tag-tree changes (name suggests a lock; usage not traced)                                                           |
| `ExamTag` / `SectionTag` / `QuestionTag` | `exam_tags` / `section_tags` / `question_tags` | composite PK `(…_id, tag_id)`                                                                                                                                                                       | → owner and `Tag` (cascade)                                                 | Tag assignments by tag id                                                                                                                 |

gRPC (`proto/exam.proto`):

- `ExamManagementService`: create/update/delete exam, section, question; move section/question; `ReviewExam`; `FindExams`, `GetExamDetails`, `GetSectionDetails`, `GetQuestionDetails`, `GetExamCounts`.
- `ExamPracticeService`: `Attempt`, `EndAttempt`, `Answer`, `RemoveAnswer`, `AddNote`, `ToggleFlag`, user stats/summary/history, `FindExams`, `GetExamDetails`, `GetExamStats`, `GetAttemptSavedData`, `GetAttemptReview`, `GetDetailedQuestionInfo`.
- `TagService`: add/delete/update/move tag, `GetTagTree`, `GetTagList`.
- `GoalService`: set/update/delete/get goal.

## achievement (`apps/achievement`)

Badges from login streaks and attempts. Schemas `apps/achievement/prisma/schema/{badge,exam-criteria,login-criteria}.prisma`.

| Model             | Table              | Key columns                                                                  | Relations                     | Purpose                                          |
| ----------------- | ------------------ | ---------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `Badge`           | `badges`           | `name` PK, `type`, `description`, `display_name`                             | `userBadges`                  | Badge catalogue                                  |
| `UserBadge`       | `user_badges`      | `id`, `uid`, `badge` (→ `badges.name`), `updatedAt`; index `(updatedAt, id)` | → `Badge` (on update cascade) | Badges a user earned                             |
| `AttemptCriteria` | `attempt_criteria` | `uid` PK, `version`, `total`, `perfect`, `good`                              | -                             | Per-user attempt counters (optimistic `version`) |
| `LoginCriteria`   | `login_criteria`   | `uid` PK, `version`, `longest_streak`, `total`, `started_at`, `last_login`   | -                             | Per-user login streak (UTC days)                 |

gRPC `AchievementService` (`proto/achievement.proto`): `GetAll`, `GetUsersBadges`, `GetUsersProgess` (sic).

Consumes `auth.user.login`, `exam.attempt.submitted`, `exam.attempt.scored` (prefetch 1, version-conflict retry); publishes `achievement.badge.earned` in the same transaction as the badge award.

## resource (`apps/resource`)

Blogs, flash cards and lists, user reports. This service uses plain application services (`apps/resource/src/app/services/*.service.ts`) rather than the CQRS layout. Schema `apps/resource/prisma/schema/resource.prisma`.

| Model           | Table              | Key columns                                                                                                                                        | Relations                   | Purpose                                                                                      |
| --------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `Blog`          | `blogs`            | `id`, `title`, `content`, `author_id`, `tags[]`, timestamps                                                                                        | -                           | Blog posts (ownership for edits via `@ResourceAccess`)                                       |
| `FlashCardList` | `flash_card_lists` | `id`, `name`, `description?`, `author_id`, `is_public`, `tags[]`                                                                                   | `cards`                     | A deck; private unless `is_public`                                                           |
| `FlashCard`     | `flash_cards`      | `id`, `word`, `definition`, `image?`, `part_of_speech?`, `pronunciation?`, `examples[]`, `notes?`, `author_id`, `tags[]`, `list_id` (indexed)      | → `FlashCardList` (cascade) | A card; always in a list by the same author                                                  |
| `Report`        | `reports`          | `id`, `reported_by`, `type`, `status` (default `pending`), `title`, `description`, `target_type?`, `target_id?`, `resolved_by?`, `admin_response?` | `files`                     | User reports, visible to the reporter and mods/admins                                        |
| `ReportFile`    | `report_files`     | PK `(report_id, file_id)`                                                                                                                          | → `Report` (cascade)        | Files attached to a report                                                                   |
| `DeletedFile`   | `deleted_files`    | `file_id` PK, `count`                                                                                                                              | -                           | Same shape as in auth/exam; no code in `apps/resource/src` reads or writes it on this branch |

gRPC (`proto/resource.proto`): `BlogService` (CRUD + list), `FlashCardService` (CRUD + list), `FlashCardListService` (CRUD + list, `AddCardToList`, `ListCardsInList`), `ReportService` (CRUD + list, `AddFileToReport`, `RemoveFileFromReport`).

Publishes `resource.resource.created/deleted` (`blog`, `flashcard`; list deletion emits one delete per card) and `resource.report.status-changed`. Report file attaches do not publish `file.added` (no such call anywhere in `apps/resource/src`). Since file-service's orphan cleanup deletes non-system files with `ref_count <= 0` untouched for 1 h (`MIN_ORPHAN_AGE_MS`, `lockOrphanedFiles` in `file.prisma.repository.impl.ts`), report attachments look eligible for deletion an hour after upload. Read from the code, not reproduced; tracked as backlog C20.

## file-service (`apps/file-service`)

File metadata, presigned uploads to MinIO, reference counting, orphan cleanup. Schema `apps/file-service/prisma/schema/file.prisma`.

| Model  | Table   | Key columns                                                                                                                                | Purpose                                                                                                                                                       |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `File` | `files` | `id` (uuid, also the object key), `name`, `size`, `mime_type`, `ref_count`, `updatedAt`, `isPublic`, `uploaded_by?` (indexed), `is_system` | One uploaded object. `uploaded_by` comes from the JWT at presign time; `NULL` for legacy/seeded/system files. `is_system` rows are exempt from orphan cleanup |

gRPC `FileService` (`proto/file.proto`): `GetPresignedUrl` (creates the row, returns a POST policy for the public or private bucket), `GetUrls`, `CheckFilesOwnedBy`.

Consumes `*.file.added` (`ref_count + 1`) and `*.file.removed` / `*.files.removed` (`decrementRef`). Publishes nothing (`relay: false`). BullMQ job `cleanup-orphaned-files` every 5 min (`apps/file-service/src/infra/jobs/orphan-cleanup.job.ts`): locks a batch of orphaned rows, deletes their bucket objects, then the rows.

## live (`apps/live`)

Chat rooms over socket.io, scheduled live streams, bans. Schema `apps/live/prisma/schema/live.prisma`.

| Model    | Table     | Key columns                                                                                  | Relations         | Purpose                                                                                           |
| -------- | --------- | -------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `Room`   | `rooms`   | `id`, `name` (unique), `scheduled_live_url?`, `scheduled_time?`, `is_deleted`, `created_by?` | `logs`, `banneds` | A room; soft-deleted (name rewritten to `<id>:deleted` to free it); `created_by` drives ban/unban |
| `Banned` | `banneds` | PK `(room_id, uid)`, `reason`                                                                | → `Room`          | Users banned from a room                                                                          |
| `Log`    | `logs`    | `id`, `roomId`, `created_at`, `from_id`, `message`                                           | → `Room`          | Chat history                                                                                      |

gRPC `ChatService` (`proto/live.proto`): `GetRoomList`, `GetChatLog`, `CreateRoom`, `RemoveRoom`, `UpdateRoomSchedule`, `BanUserFromRoom`, `UnbanUserFromRoom`. socket.io on `HTTP_PORT` 1511 with the Redis adapter (`apps/live/src/app/infra/adapter/redis-io.adapter.ts`); handshakes are origin-checked and JWT-verified in live.

Publishes `live.room.created` (only when `createdBy` is known) and `live.room.deleted`.

## notification (`apps/notification`)

In-app notifications, preferences, SSE push. Schema `apps/notification/prisma/schema/notification.prisma`.

| Model                    | Table                      | Key columns                                                                                                              | Purpose                                          |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `Notification`           | `notifications`            | `id`, `recipient_id` (indexed), `type`, `title`, `message`, `data?` (JSON), `is_read`, `read_at?`, `created_at`          | A notification for one user                      |
| `NotificationPreference` | `notification_preferences` | `id`, `identity_id` (unique), `email_enabled`, `push_enabled`, `achievement_enabled`, `report_enabled`, `system_enabled` | Per-user switches checked by the event consumers |

gRPC `NotificationService` (create, get, delete, list, mark read, mark all read) and `NotificationPreferencesService` (get/update) (`proto/notification.proto`). HTTP: `GET /notifications/stream/:recipientId` (SSE, `apps/notification/src/presentation/controllers/notification-sse.controller.ts`), reached only through the gateway proxy, which requires `recipientId === sub`.

Consumes `achievement.badge.earned` and `resource.report.status-changed`. Publishes nothing (`relay: false`).

## mock-ai-scorer (`apps/mock-ai-scorer`)

Dev/staging stand-in for the external AI writing scorer; Docker starts it only with `--profile mock-ai`. No database, no gRPC. `WritingSubmittedHandler` (`apps/mock-ai-scorer/src/app/writing-submitted.handler.ts`) consumes `exam.writing.submitted` from `mock-ai-scorer.writing.submitted`, waits a random `MOCK_SCORER_MIN_DELAY_MS`..`MOCK_SCORER_MAX_DELAY_MS` (defaults 2000-8000 ms) with the message unacked (prefetch 200), and publishes a random IELTS-style result (bands 4.0-8.5 in 0.5 steps, `apps/mock-ai-scorer/src/app/score-generator.ts`) on `exam.writing.scored`. Health on `HEALTH_PORT` (9110 in compose). It has no `ServiceMissing` alert rule in `docker/observability/alerting/platform.yaml` (the optional profile would otherwise fire it). Never run it next to the real scorer: both would score every submission.

The real AI scorer is not in this repo; only its contract is: input `exam.writing.submitted` (bare), output `exam.writing.scored` (bare, shape validated by `WritingScoredEvent` in `apps/exam/src/app/events/handlers/writing-scored.handler.ts`).
