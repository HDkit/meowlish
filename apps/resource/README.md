# resource

The community content service: blog posts and their nested comments, the forum (categories, threads, replies, moderation), flash cards and flash card lists (public/private decks, copies of other users' lists, diffs, upstream pulls and change proposals), and user reports to moderators. Unlike the other services it uses plain application services (`src/app/services/*.service.ts`) rather than the CQRS layout.

## Tech used

| Technology                                                    | What for                                                                                                                           | Where                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| NestJS gRPC (`Transport.GRPC`)                                | Seven gRPC services on `HOST:PORT`; HTTP on `HEALTH_PORT` for health only                                                          | `src/bootstrap.ts`, `src/presentation/controllers/`                                        |
| Application services                                          | Business logic per feature (blog, blog comments, forum, flash cards, lists, forks, proposals, reports)                             | `src/app/services/`                                                                        |
| Prisma + Postgres `resource_db` (`db push`, no migrations)    | All resource data                                                                                                                  | `prisma/schema/{resource,blog-comment,forum}.prisma`                                       |
| `nestjs-cls` + `@nestjs-cls/transactional`                    | Transactions (`@Transactional()`, `TransactionHost`)                                                                               | `src/resource.module.ts`                                                                   |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging` | `OutboxPublisher` + `OutboxRelay` (`relay: true`, connection `pub`). No consumers                                                  | `src/configs/rmq.pub.config.ts`, `src/app/events/resource-events.publisher.ts`, services   |
| file-service gRPC client (`file.FileServiceClient`)           | `GetUrls` (flash card image URLs), `CheckFilesOwnedBy` (card images, report attachments; admins may attach any file to reports)    | `src/app/services/card-image-url.service.ts`, `src/app/services/file-ownership.service.ts` |
| File reference counting                                       | Card image and report attachment references, published as `resource.file.added` / `resource.files.removed` in the same transaction | `src/app/services/card-image-refs.service.ts`, `src/app/services/report.service.ts`        |
| Slugs                                                         | Readable URL keys for blog posts and forum threads, from the title on create; `SlugBackfillService` fills missing ones at start-up | `src/app/services/slug-backfill.service.ts`                                                |
| OpenTelemetry + health (`@server/telemetry`)                  | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                      | `src/main.ts`, `src/resource.module.ts`                                                    |

No Redis and no BullMQ (Docker Compose lists `redis` in its `depends_on` but not `rabbit-mq`, which it does use).

## Talks to

- **Called by**: the gateway (`/api/v1/resources/*`). Private lists, "own reports only" and similar rules are enforced here from the `requesterId` + `privileged` the gateway sends; "not yours" answers 404. Blog and flash card mutations are also guarded by the gateway's legacy `@ResourceAccess`.
- **Calls**: file-service gRPC (`GetUrls`, `CheckFilesOwnedBy`).
- **gRPC** (`proto/resource.proto`):
  - `BlogService`: `CreateBlog`, `GetBlog` (id or slug), `UpdateBlog`, `DeleteBlog`, `ListBlogs`, `ListBlogTags` (every tag with its post count).
  - `BlogCommentService`: `ListBlogComments` (as a tree), `CreateBlogComment`, `UpdateBlogComment`, `DeleteBlogComment`.
  - `ForumService`: `ListForumCategories`, `GetForumCategory`, `ListForumThreads`, `CreateForumThread`, `GetForumThread` (id or slug), `UpdateForumThread`, `ModerateForumThread`, `DeleteForumThread`, `ListForumReplies`, `CreateForumReply`, `UpdateForumReply`, `DeleteForumReply`.
  - `FlashCardService`: `CreateFlashCard`, `GetFlashCard`, `UpdateFlashCard`, `DeleteFlashCard`, `ListFlashCards`.
  - `FlashCardListService`: `CreateFlashCardList`, `GetFlashCardList`, `UpdateFlashCardList`, `DeleteFlashCardList`, `ListFlashCardLists`, `AddCardToList`, `ListCardsInList`, `ForkFlashCardList`, `GetFlashCardListDiff`, `PullFlashCardListUpstream`.
  - `FlashCardProposalService`: `CreateFlashCardProposal`, `ListFlashCardProposals`, `GetFlashCardProposal`, `AcceptFlashCardProposal`, `RejectFlashCardProposal`, `WithdrawFlashCardProposal`.
  - `ReportService`: `CreateReport`, `GetReport`, `UpdateReport`, `DeleteReport`, `ListReports`, `AddFileToReport`, `RemoveFileFromReport`.

Events published (outbox, envelope); consumes nothing:

| Routing key                             | When                                                                                               | Consumer queue → service                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `resource.resource.created`             | Blog or flash card created (`resourceType` `blog` / `flashcard`)                                   | `authorization.events.resource.created` → authorization           |
| `resource.resource.deleted`             | Blog or card deleted; deleting a list emits one per card                                           | `authorization.events.resource.deleted` → authorization           |
| `resource.file.added`                   | Report created with files or file attached; card image set; card copied with its image             | `file.events.file.added` → file-service                           |
| `resource.files.removed`                | Report file detached or report deleted; card image replaced/removed; cards (or their list) deleted | `file.events.files.removed` → file-service                        |
| `resource.report.created`               | `createReport`                                                                                     | `notification.events.report.created` → notification (all admins)  |
| `resource.report.status-changed`        | `updateReport`, only when the status changes                                                       | `notification.events.report.status-changed` → notification        |
| `resource.flashcard-proposal.created`   | Proposal created                                                                                   | `notification.events.flashcard-proposal.created` → notification   |
| `resource.flashcard-proposal.decided`   | Proposal accepted or rejected                                                                      | `notification.events.flashcard-proposal.decided` → notification   |
| `resource.flashcard-proposal.withdrawn` | Proposal withdrawn                                                                                 | `notification.events.flashcard-proposal.withdrawn` → notification |
| `resource.blog-comment.created`         | Comment created (carries the post author and the author replied to)                                | `notification.events.blog-comment.created` → notification         |
| `resource.forum-reply.created`          | Reply created (carries the thread author, the quoted author and the reply's position)              | `notification.events.forum-reply.created` → notification          |

## Data

Postgres `resource_db`:

| Table                       | Key columns                                                                                                                                                                                                                                                                                               | Purpose                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `blogs`                     | `id`, `slug?` (unique, never changes), `title`, `content`, `author_id`, `tags[]`, timestamps                                                                                                                                                                                                              | Blog posts                                                                                         |
| `blog_comments`             | `id`, `blog_id`, `parent_id?`, `root_id`, `path` (materialized path), `depth`, `child_seq`, `author_id`, `content`, `edited_at?`, `deleted_at?` (soft delete)                                                                                                                                             | Nested comments, any depth                                                                         |
| `forum_categories`          | `id` (slug), `name`, `description`, `position`, `moderators_only`                                                                                                                                                                                                                                         | Forum sections; `moderators_only` = announcements                                                  |
| `forum_threads`             | `id`, `slug?` (unique), `category_id` (restrict), `author_id`, `title`, `body` (Markdown), `is_pinned`, `is_locked`, `reply_count`, `view_count`, `last_activity_at`, `last_reply_author_id?`, `edited_at?`                                                                                               | A thread; counters denormalised for list pages                                                     |
| `forum_replies`             | `id`, `thread_id` (cascade), `author_id`, `body`, `quoted_reply_id?` (set null), `edited_at?`; index `(thread_id, created_at)`                                                                                                                                                                            | Replies, numbered by position in the thread                                                        |
| `flash_card_lists`          | `id`, `name`, `description?`, `author_id`, `is_public`, `tags[]`, `forked_from_id?` (→ self, set null), `forked_from_name?`, `forked_from_author_id?`, `fork_synced_at?`                                                                                                                                  | A deck; private unless `is_public`; copies record where they came from                             |
| `flash_cards`               | `id`, `word`, `definition`, `image?` (legacy free URL), `image_file_id?` (file-service id, one reference per row), `part_of_speech?`, `pronunciation?`, `examples[]`, `notes?`, `author_id`, `tags[]`, `list_id` (cascade, indexed), `origin_card_id?`, `origin_snapshot?` (JSON merge base), `position?` | A card, always in a list by the same author                                                        |
| `flash_card_list_proposals` | `id`, `source_list_id?` (set null), `target_list_id` (cascade), `author_id`, `title`, `message`, `status` (`OPEN`/`ACCEPTED`/`REJECTED`/`WITHDRAWN`), `changes` (JSON diff with base values), `decided_at?`, `decided_by?`, `decision_note?`                                                              | Change proposals from a copy to its original; visible to the proposer, the target owner and admins |
| `reports`                   | `id`, `reported_by`, `type`, `status` (default `pending`), `title`, `description`, `target_type?`, `target_id?`, `resolved_by?`, `admin_response?`                                                                                                                                                        | User reports, visible to the reporter and moderators/admins; frozen (409) once in a final status   |
| `report_files`              | PK `(report_id, file_id)`                                                                                                                                                                                                                                                                                 | Files attached to a report                                                                         |
| `deleted_files`             | `file_id` PK, `count`                                                                                                                                                                                                                                                                                     | Same shape as in auth/exam, but unused: no code in `src/` reads or writes it                       |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)).

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT` (gRPC), `HEALTH_PORT`.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `FILE_SERVICE_HOST`, `FILE_SERVICE_PORT` (optional `FILE_SERVICE_URL`).
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run resource:prisma:generate
pnpm exec nx run resource:prisma:push     # no migrations folder: schema is pushed
pnpm exec nx run resource:prisma:seed     # blogs, forum, flash card catalogue and demo decks (prisma/seed/)
pnpm exec nx run resource:serve
pnpm exec nx run resource:test
```

Ports: gRPC 50055 locally (`.env.example`), 50050 in Docker; health 9104. Docker host access through `envoy-resource` on 8084. Needs Postgres, RabbitMQ and file-service.

## More

- Flows: [flows/resource.md](../../docs/architecture/flows/resource.md) (blogs, comments, flash cards, reports, slugs) and [flows/resource-community.md](../../docs/architecture/flows/resource-community.md) (forum, copies, diffs, proposals, discussion notifications).
- Events: [messaging.md](../../docs/architecture/messaging.md).
