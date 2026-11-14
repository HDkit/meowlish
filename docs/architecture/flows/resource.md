# Resource flows (blogs, comments, flash cards, lists, reports)

Routes served by `ResourceGatewayController` (`apps/gateway/src/resource-gateway/resource.router.controller.ts`), mounted under `/api/v1/resources` (global prefix `api` + URI version `1` in `apps/gateway/src/bootstrap.ts`, `RouterModule` path `/resources` in `apps/gateway/src/router.module.ts`). They call the `resource` app (`apps/resource`) over gRPC; it uses plain application services in `apps/resource/src/app/services/` with Prisma through `TransactionHost`, no CQRS. Tables: [services-and-data.md, resource](../services-and-data.md#resource-appsresource). Forum routes are in [resource-community.md](resource-community.md); flash card copy/diff/pull and proposals (`FlashCardProposalGatewayController`) are in [resource-community.md](resource-community.md).

Common to every route below:

- Gateway global guards (`apps/gateway/src/gateway.module.ts`): `ThrottlerGuard` (throttler `default`: 100/min per route per IP+account, per IP when signed out; `apps/gateway/src/throttle.ts`; no route here overrides it), `JwtAuthGuard` (no route here is `@IsPublic`, so all need a valid JWT), `RolesGuard`, `PermissionsGuard`, `ResourceAccessGuard`.
- `requesterOf(req.user, roles)` (`apps/gateway/src/auth/functions/requester.ts`) adds `{ requesterId: sub, privileged }`; the service turns it into a `Requester` with `toRequester` (`apps/resource/src/presentation/dtos/req/requester.req.dto.ts`). See [authorization.md §6](../authorization.md#6-requester-pattern-authorization-in-the-owning-service).
- Pagination: `toSkipTake` (`apps/resource/src/app/types/pagination.ts`), defaults page 1, limit 10; gateway `PageQueryDto` bounds `page >= 1`, `1 <= limit <= 100`.
- Every service-side gRPC controller is in `apps/resource/src/presentation/controllers/` and only forwards to the service method named in each section.
- Events go through `ResourceEventsPublisher` (`apps/resource/src/app/events/resource-events.publisher.ts`) → `OutboxPublisher.add` (enveloped, written in the caller's transaction); the relay runs in the resource process (`MessagingModule.forRoot({ relay: true })`, `apps/resource/src/resource.module.ts`). See [messaging.md](../messaging.md).

## Contents

| Operation                                                                                   | Access                                 | Writes                          | Events                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| [POST /blogs](#post-apiv1resourcesblogs)                                                    | any user                               | `Blog`                          | `resource.resource.created`                          |
| [GET /blogs/tags](#get-apiv1resourcesblogstags)                                             | any user                               | -                               | -                                                    |
| [GET /blogs/:id](#get-apiv1resourcesblogsid)                                                | any user                               | -                               | -                                                    |
| [PATCH /blogs/:id](#patch-apiv1resourcesblogsid)                                            | `@ResourceAccess` blog                 | `Blog`                          | -                                                    |
| [DELETE /blogs/:id](#delete-apiv1resourcesblogsid)                                          | `@ResourceAccess` blog                 | `Blog` (cascade `BlogComment`)  | `resource.resource.deleted`                          |
| [GET /blogs](#get-apiv1resourcesblogs)                                                      | any user                               | -                               | -                                                    |
| [GET /blogs/:id/comments](#get-apiv1resourcesblogsidcomments)                               | any user                               | -                               | -                                                    |
| [POST /blogs/:id/comments](#post-apiv1resourcesblogsidcomments)                             | any user                               | `BlogComment`                   | `resource.blog-comment.created`                      |
| [PATCH /blog-comments/:commentId](#patch-apiv1resourcesblog-commentscommentid)              | author (service)                       | `BlogComment`                   | -                                                    |
| [DELETE /blog-comments/:commentId](#delete-apiv1resourcesblog-commentscommentid)            | author or mod/admin (service)          | `BlogComment`                   | -                                                    |
| [POST /flash-cards](#post-apiv1resourcesflash-cards)                                        | list owner (service)                   | `FlashCard`                     | `resource.resource.created`                          |
| [GET /flash-cards/:id](#get-apiv1resourcesflash-cardsid)                                    | visible list (service)                 | -                               | -                                                    |
| [PATCH /flash-cards/:id](#patch-apiv1resourcesflash-cardsid)                                | `@ResourceAccess` flashcard            | `FlashCard`                     | -                                                    |
| [DELETE /flash-cards/:id](#delete-apiv1resourcesflash-cardsid)                              | `@ResourceAccess` flashcard            | `FlashCard`                     | `resource.resource.deleted`                          |
| [GET /flash-cards](#get-apiv1resourcesflash-cards)                                          | visible lists (service)                | -                               | -                                                    |
| [POST /flash-card-lists](#post-apiv1resourcesflash-card-lists)                              | any user                               | `FlashCardList`                 | -                                                    |
| [GET /flash-card-lists/:id](#get-apiv1resourcesflash-card-listsid)                          | visible (service)                      | -                               | -                                                    |
| [PATCH /flash-card-lists/:id](#patch-apiv1resourcesflash-card-listsid)                      | owner or admin (service)               | `FlashCardList`                 | -                                                    |
| [DELETE /flash-card-lists/:id](#delete-apiv1resourcesflash-card-listsid)                    | owner or admin (service)               | `FlashCardList` (cascade cards) | `resource.resource.deleted` x cards                  |
| [GET /flash-card-lists](#get-apiv1resourcesflash-card-lists)                                | visible (service)                      | -                               | -                                                    |
| [POST /flash-card-lists/:id/cards](#post-apiv1resourcesflash-card-listsidcards)             | owner or admin (service)               | `FlashCard.listId`              | -                                                    |
| [GET /flash-card-lists/:id/cards](#get-apiv1resourcesflash-card-listsidcards)               | visible (service)                      | -                               | -                                                    |
| [POST /reports](#post-apiv1resourcesreports)                                                | any user                               | `Report`, `ReportFile`          | `resource.report.created`                            |
| [GET /reports/:id](#get-apiv1resourcesreportsid)                                            | reporter or mod/admin (service)        | -                               | -                                                    |
| [PATCH /reports/:id](#patch-apiv1resourcesreportsid)                                        | `@HasRoles(Mod, Admin)`                | `Report`                        | `resource.report.status-changed` (if status changed) |
| [DELETE /reports/:id](#delete-apiv1resourcesreportsid)                                      | `@HasRoles(Mod, Admin)`                | `Report` (cascade files)        | -                                                    |
| [GET /reports](#get-apiv1resourcesreports)                                                  | own; mod/admin all (service)           | -                               | -                                                    |
| [POST /reports/:id/files](#post-apiv1resourcesreportsidfiles)                               | reporter or mod/admin + uploader check | `ReportFile`                    | -                                                    |
| [DELETE /reports/:reportId/files/:fileId](#delete-apiv1resourcesreportsreportidfilesfileid) | reporter or mod/admin (service)        | `ReportFile`                    | -                                                    |

All paths in the table are relative to `/api/v1/resources`.

## How `@ResourceAccess` routes are checked

Used only by `PATCH`/`DELETE /blogs/:id` (`resourceType: 'blog'`) and `PATCH`/`DELETE /flash-cards/:id` (`resourceType: 'flashcard'`). All four have the same rules: `{ roles: [Admin] }`, then `{ roles: [Mod, User, Student, Teacher], requireOwnership: true }`.

1. `ResourceAccessGuard` (`apps/gateway/src/auth/guards/resource-access.guard.ts`) walks the rules in order. Admin matches rule 1 and is allowed without any call.
2. For rule 2 it calls `authorization.AuthorizationService/CheckOwnership { userId: sub, resourceType, resourceId: req.params.id }`; the authorization service reads `resource_ownership` by `(resource_type, resource_id)` and returns `isOwner`.
3. No rule allows → 403. This includes unknown ids (no ownership row), the creator before the `resource.resource.created` event has been consumed, and users whose only roles are outside the list (e.g. `parent`, `mentor`).
4. The ownership rows come from `resource.resource.created/deleted` (see [Background work](#background-work)) and from the authorization seed backfill.

The resource service does no ownership check of its own on these four routes. Full walkthrough: [authorization.md §5](../authorization.md#5-legacy-resourceaccess-and-the-authorization-service) and [§7(e)](../authorization.md#e-updating-a-flash-card-patch-apiv1resourcesflash-cardsid-via-resourceaccess).

## Blogs

### POST /api/v1/resources/blogs

Create a blog post.

- **Access**: any authenticated user; `authorId = req.user.sub`.
- **Flow**:
  1. Gateway: `CreateBlogDto` (`title`, `content` strings; optional `tags: string[]`, defaulted to `[]`) → `resource.BlogService/CreateBlog`.
  2. `BlogController.createBlog` → `BlogService.createBlog` (`apps/resource/src/app/services/blog.service.ts:38`), `@Transactional()`.
  3. Insert `Blog`; in the same transaction outbox `resource.resource.created` `{ resourceType: 'blog', resourceId, ownerId: authorId }`.
  4. Response `BlogDto`.
- **Async**: `resource.resource.created` → `authorization.events.resource.created` → `ResourceCreatedHandler` registers ownership (inbox yes). Until then the author's own `PATCH`/`DELETE` returns 403.

### GET /api/v1/resources/blogs/tags

Every tag used by blogs with its count, most used first then by name. `BlogService.listBlogTags` runs one raw SQL query over `blogs, unnest(tags)`; response `ListBlogTagsDto { tags: [{ name, count }] }`. Declared before `blogs/:id` so `tags` is not taken as an id.

### GET /api/v1/resources/blogs/:id

`resource.BlogService/GetBlog` → `BlogService.getBlog`: `Blog.findUnique`; 404 `Blog not found`. Response `BlogDto`. No visibility rules (all blogs are readable by any logged-in user).

### PATCH /api/v1/resources/blogs/:id

Update a blog post.

- **Access**: `@ResourceAccess` `blog` (see [above](#how-resourceaccess-routes-are-checked)).
- **Flow**:
  1. Gateway: `UpdateBlogDto` (all optional; `tags` defaulted to `[]`) → `resource.BlogService/UpdateBlog { ...body, id }`.
  2. `BlogService.updateBlog`: `findUnique` (404), then `update` with `title ?? old`, `content ?? old`, `tags` only if non-empty. Not `@Transactional`; no version check.
  3. Response `BlogDto`.
- **Errors**: 403 from the guard; 404 if the row is gone.

### DELETE /api/v1/resources/blogs/:id

- **Access**: `@ResourceAccess` `blog`.
- **Flow**: `resource.BlogService/DeleteBlog` → `BlogService.deleteBlog`, `@Transactional()`: `findUnique` (404) → `Blog.delete` (FK cascade removes its `BlogComment` rows) → outbox `resource.resource.deleted` `{ resourceType: 'blog', resourceId }`. Response empty.
- **Async**: `authorization.events.resource.deleted` → `ResourceDeletedHandler` removes the ownership row (inbox yes).

### GET /api/v1/resources/blogs

`ListBlogsQueryDto` (`authorId?`, `tags` via `ToStringArray`, page/limit) → `resource.BlogService/ListBlogs` → `BlogService.listBlogs`: `where authorId`, `tags hasSome` (any of the tags), order `createdAt desc`, `findMany` + `count` in parallel. Response `ListBlogsDto { blogs, totalCount }`.

## Blog comments

Comments are a materialized-path tree (`BlogComment`, table `blog_comments`; schema `apps/resource/prisma/schema/blog-comment.prisma`): `rootId` (top-level ancestor), `path` (fixed-width 4-char base36 segment per level, empty for top level), `depth`, `childSeq` (per-parent counter, only grows), soft-delete `deletedAt`. Rationale and helpers: `apps/resource/src/domain/comments/comment-path.ts` (`MAX_COMMENT_DEPTH = 8`, 36^4 children per comment), tree building and pruning in `comment-tree.ts`. Service: `BlogCommentService` (`apps/resource/src/app/services/blog-comment.service.ts`). Comments are "moderated" only by deletion: `Mod`/`Admin` are `privileged` and may delete anyone's comment; there is no hide/approve state.

### GET /api/v1/resources/blogs/:id/comments

Top-level comments paged (newest first), each with its full reply tree.

- **Flow**:
  1. Gateway: `ListBlogCommentsQueryDto` (`page >= 1`, `1 <= limit <= 50`) → `resource.BlogCommentService/ListBlogComments { ...query, blogId }`. No requester is sent.
  2. `BlogCommentService.listComments`: 404 `Blog not found` if the blog is missing; then in parallel: page of root ids (`parentId null`, order `createdAt desc, id desc`), count of roots (`totalThreads`, includes placeholders), count of live comments (`totalComments`).
  3. One query `blogComment.findMany({ rootId in rootIds })`, then `buildCommentTree` sorts by `path` (siblings oldest first), drops orphans and prunes deleted comments with no remaining replies.
  4. Placeholders are returned with `deleted: true`, empty `authorId`/`content`, no `editedAt`. Response `ListBlogCommentsDto { comments, totalThreads, totalComments }`.

### POST /api/v1/resources/blogs/:id/comments

Comment on a post or reply to a comment.

- **Access**: any user; `requesterOf(req.user, [Mod, Admin])` (only `requesterId` matters here; it becomes `authorId`).
- **Flow**:
  1. Gateway: `CreateBlogCommentDto` (`content` non-empty, max 5000; optional `parentId`) → `resource.BlogCommentService/CreateBlogComment`.
  2. `BlogCommentService.createComment`, `@Transactional()`: load blog (404); trim content (400 `content must not be empty` if blank); new id from `randomUUID()`.
  3. Top-level: insert with `rootId = id`, `path = ''`, `depth 0`.
  4. Reply: load parent, must be live and on the same blog (else 404 `Comment not found`). Remember `repliedTo = parent.authorId`. If the parent is at depth >= 8, attach to the parent's parent instead (same thread, same depth as the clicked comment). `update parent set childSeq = childSeq + 1` (row lock, hands out the segment) → `path = parent.path + segment`, `depth = path.length / 4`, insert.
  5. Same transaction: outbox `resource.blog-comment.created` `{ commentId, blogId, blogTitle, blogAuthorId, authorId, parentAuthorId (repliedTo or null), excerpt (120 chars) }`.
  6. Response `BlogCommentDto` (no replies).
- **Async**: `resource.blog-comment.created` → `notification.events.blog-comment.created` → `BlogCommentCreatedHandler` (`apps/notification/src/app/events/handlers/blog-comment-created.handler.ts`, inbox yes): notifies the replied-to author (`comment_reply`, preference `commentReply`) and the post author (`blog_comment`, preference `blogComment`), never the commenter, one notification if both are the same person; `action` = `/blog/<blogId>#comment-<commentId>`. Each notification is also pushed over SSE.
- **Errors**: 404 blog or parent; 400 blank content.

### PATCH /api/v1/resources/blog-comments/:commentId

Edit your own comment.

- **Access**: author only, checked in the service; `privileged` is ignored for edits.
- **Flow**: `UpdateBlogCommentDto` (`content` non-empty, max 5000) → `resource.BlogCommentService/UpdateBlogComment` → `BlogCommentService.updateComment`: load live comment (404 if missing or soft-deleted), 404 if `authorId !== requesterId`, update `content` (trimmed, 400 if blank) and `editedAt = now`. Not `@Transactional`. Response `BlogCommentDto`.
- **Errors**: 404 for "not yours" (not 403).

### DELETE /api/v1/resources/blog-comments/:commentId

Delete a comment; kept as a placeholder if it has replies.

- **Access**: author, or `privileged` (`Mod`/`Admin` via `requesterOf`), checked in the service.
- **Flow**: `resource.BlogCommentService/DeleteBlogComment` → `BlogCommentService.deleteComment`, `@Transactional()`:
  1. Load live comment (404); 404 if not author and not privileged.
  2. Has direct replies → soft delete: set `deletedAt = now`, `content = ''` (`authorId` is kept in the row, hidden in responses).
  3. No replies → hard delete, then walk up the parents: delete each ancestor that is a placeholder and now has no replies; stop at the first live or still-populated one.
- **Errors**: 404 for missing, already deleted, or not yours.

## Flash cards

Service: `FlashcardService` (`apps/resource/src/app/services/flashcard.service.ts`). Visibility helper `visibleListsWhere` (`apps/resource/src/app/mappers/flash-card.mapper.ts:44`): privileged sees all; others see cards in public lists or in their own lists. Privileged here means `Admin` only (`FLASH_CARD_ADMIN_ROLES`).

### POST /api/v1/resources/flash-cards

- **Access**: any user; the service requires the target list to be theirs.
- **Flow**:
  1. Gateway: `CreateFlashCardDto` (`word`, `definition`, `listId` required; `image`, `partOfSpeech`, `pronunciation`, `notes` optional; `examples`, `tags` default `[]`) + `authorId = sub` → `resource.FlashCardService/CreateFlashCard`.
  2. `FlashcardService.createFlashCard`, `@Transactional()`: load list (404 `FlashCardList not found`); 403 `Cards can only be added to your own lists` if `list.authorId !== authorId` (admins included); insert `FlashCard`; outbox `resource.resource.created` `{ resourceType: 'flashcard', resourceId, ownerId }`.
  3. Response `FlashCardDto`.
- **Async**: authorization registers ownership (as for blogs).
- **Notes**: `image` is a plain string; no file-ownership check or `file.added` event.

### GET /api/v1/resources/flash-cards/:id

`requesterOf(user, [Admin])` → `resource.FlashCardService/GetFlashCard` → `FlashcardService.getFlashCard`: `findFirst({ id, list: visibleListsWhere })`; 404 `FlashCard not found` if missing or in a private list that is not yours. Response `FlashCardDto`.

### PATCH /api/v1/resources/flash-cards/:id

- **Access**: `@ResourceAccess` `flashcard` (see [above](#how-resourceaccess-routes-are-checked)).
- **Flow**: `UpdateFlashCardDto` (all optional; `examples`, `tags` default `[]`) → `resource.FlashCardService/UpdateFlashCard` → `FlashcardService.updateFlashCard`: `findUnique` (404) then `update`; undefined fields are left unchanged, `examples`/`tags` only replaced when non-empty. No service-side ownership or list check; not `@Transactional`. Response `FlashCardDto`.

### DELETE /api/v1/resources/flash-cards/:id

- **Access**: `@ResourceAccess` `flashcard`.
- **Flow**: `resource.FlashCardService/DeleteFlashCard` → `FlashcardService.deleteFlashCard`, `@Transactional()`: `findUnique` (404) → delete → outbox `resource.resource.deleted` `{ resourceType: 'flashcard', resourceId }`.
- **Async**: authorization removes the ownership row.

### GET /api/v1/resources/flash-cards

`ListFlashCardsQueryDto` (`authorId?`, `tags`, page/limit) + `requesterOf(user, [Admin])` → `resource.FlashCardService/ListFlashCards` → `FlashcardService.listFlashCards`: `where { list: visibleListsWhere, authorId?, tags hasSome }`, order `createdAt desc`, `findMany` + `count`. Response `ListFlashCardsDto { flashCards, totalCount }`.

## Flash card lists

Service: `FlashcardListService` (`apps/resource/src/app/services/flashcard-list.service.ts`). Mutations go through `findOwnedList` (line 36): 404 if the list is missing or private and not yours (non-admin); 403 `You do not own this flash card list` if it is public but not yours. Privileged = `Admin`. Copy (`/fork`), `/diff`, `/pull` and proposals are in [resource-community.md](resource-community.md).

### POST /api/v1/resources/flash-card-lists

`CreateFlashCardListDto` (`name`; optional `description`, `isPublic`, `tags` default `[]`) + `authorId = sub` → `resource.FlashCardListService/CreateFlashCardList` → `FlashcardListService.createFlashCardList`: insert `FlashCardList` (`isPublic` default false). No event (lists are not registered in authorization; nothing uses `@ResourceAccess` on lists). Response `FlashCardListDto`.

### GET /api/v1/resources/flash-card-lists/:id

- **Flow**: `resource.FlashCardListService/GetFlashCardList` → `FlashcardListService.getFlashCardList`:
  1. `findFirst({ id, ...visibleListsWhere })` including all `cards` and the fork count (`_count.forks`); 404 if not visible.
  2. In parallel: if owner or admin, count `FlashCardListProposal` with `targetListId = id` and status `OPEN` (else 0); if the list is a copy, check the upstream list is still visible to the requester.
  3. Response `FlashCardListDetailDto` (list fields + `flashCards` (all, unpaged), `totalCards`, `openProposalCount`, `upstreamAvailable`).

### PATCH /api/v1/resources/flash-card-lists/:id

`UpdateFlashCardListDto` (all optional; `tags` default `[]`) + `requesterOf(user, [Admin])` → `resource.FlashCardListService/UpdateFlashCardList` → `findOwnedList` (404/403) → `update` (`tags` only if non-empty). Not `@Transactional`. Response `FlashCardListDto`.

### DELETE /api/v1/resources/flash-card-lists/:id

- **Access**: owner or admin (service).
- **Flow**: `resource.FlashCardListService/DeleteFlashCardList` → `FlashcardListService.deleteFlashCardList`, `@Transactional()`: `findOwnedList` → read the list's card ids → delete the list (FK cascade deletes `FlashCard` rows and proposals targeting the list; copies of it keep existing with `forkedFromId` set null) → one outbox `resource.resource.deleted` `{ resourceType: 'flashcard', resourceId }` per card, written sequentially.
- **Async**: authorization removes each card's ownership row.

### GET /api/v1/resources/flash-card-lists

`ListFlashCardListsQueryDto` (`authorId?`, `isPublic?` via `str2bool`, `tags`, `name?` max 100, page/limit) → `resource.FlashCardListService/ListFlashCardLists` → `FlashcardListService.listFlashCardLists`: `AND[filters, visibleListsWhere]`, `name` is a case-insensitive `contains`, `tags hasSome`, includes fork count, order `createdAt desc`. Response `ListFlashCardListsDto { lists, totalCount }`.

### POST /api/v1/resources/flash-card-lists/:id/cards

Move an existing card into this list.

- **Access**: owner or admin (service).
- **Flow**: `AddCardToListDto` (`flashCardId`; `position?` int >= 0) → `resource.FlashCardListService/AddCardToList` → `FlashcardListService.addCardToList`: `findOwnedList` (404/403) → load card (404 `FlashCard not found`) → 403 `Only cards by the list author can be moved into it` unless `card.authorId === list.authorId` → `update FlashCard set listId`. `position` is ignored. Response empty.

### GET /api/v1/resources/flash-card-lists/:id/cards

`PageQueryDto` → `resource.FlashCardListService/ListCardsInList` → `FlashcardListService.listCardsInList`: 404 unless the list is visible; then cards `where listId`, order `createdAt desc`, paged, plus count. Response `ListFlashCardsDto`.

## Reports

Service: `ReportService` (`apps/resource/src/app/services/report.service.ts`). Privileged = `Mod`/`Admin` (`REPORT_STAFF_ROLES`). `findVisibleReport` (line 50): 404 `Report not found` unless privileged or the reporter. File checks use `FileOwnershipService.assertOwnedBy` (`apps/resource/src/app/services/file-ownership.service.ts`), which calls `file.FileService/CheckFilesOwnedBy { fileIds, userId }` on file-service over gRPC; any id not uploaded by `userId` (other uploader, no recorded uploader, or unknown id) gives 403 `You can only attach files you uploaded: <ids>`. Attachments are reference-counted through `resource.file.added` / `resource.files.removed` (see the routes below).

### POST /api/v1/resources/reports

- **Access**: any user; `reportedBy = sub`.
- **Flow**:
  1. Gateway: `CreateReportDto` (`type`, `title`, `description`; optional `targetType`, `targetId`, `fileIds` default `[]`; all free strings) → `resource.ReportService/CreateReport`.
  2. `ReportService.createReport`, `@Transactional()`: dedupe `fileIds`; if any, `CheckFilesOwnedBy(fileIds, reportedBy)` (403; no admin bypass on create); insert `Report` (status default `pending`) with nested `ReportFile` rows; outbox `resource.file.added { fileId }` per attachment (file-service raises `ref_count`, so the orphan cleanup keeps it); outbox `resource.report.created` `{ reportId, reportedBy, type, title, targetType, targetId }`.
  3. Response `ReportDto` (with `fileIds`).
- **Async**: `notification.events.report.created` → `ReportCreatedHandler` (`apps/notification/src/app/events/handlers/report-created.handler.ts`, inbox yes): calls `auth.AuthService/FindIdentityIdsByRole { role: Admin }` (an auth outage throws, so the message is retried), notifies every admin except the reporter whose `report` preference is on (`action: '/report-management'`). Mods are not notified.
- **Errors**: 403 foreign files; the gRPC call to file-service runs inside the open DB transaction.

### GET /api/v1/resources/reports/:id

`requesterOf(user, [Mod, Admin])` → `resource.ReportService/GetReport` → `findVisibleReport`; 404 for missing or someone else's report. Response `ReportDto`. Worked example: [authorization.md §7(b)](../authorization.md#b-reading-someone-elses-report-get-apiv1resourcesreportsid).

### PATCH /api/v1/resources/reports/:id

Triage a report.

- **Access**: `@HasRoles(Mod, Admin)` (403 in the gateway otherwise); `resolvedBy = sub`.
- **Flow**:
  1. Gateway: `UpdateReportDto` (`status?`, `adminResponse?`, free strings) → `resource.ReportService/UpdateReport { ...body, id, resolvedBy }`.
  2. `ReportService.updateReport`, `@Transactional()`: `findUnique` (404) → update `status ?? old`, `resolvedBy` (always the caller), `adminResponse ?? old`.
  3. If the status changed: outbox `resource.report.status-changed` `{ reportId, reportedBy, status, title }`.
  4. Response `ReportDto`.
- **Async**: `notification.events.report.status-changed` → `ReportStatusChangedHandler` (inbox yes): notifies the reporter if their `report` preference is on, with a Vietnamese phrase for known statuses (`pending`, `reviewing`, `in_progress`, `resolved`, `rejected`, `dismissed`, `closed`) or the raw value.

### DELETE /api/v1/resources/reports/:id

`@HasRoles(Mod, Admin)` → `resource.ReportService/DeleteReport` → `ReportService.deleteReport`, `@Transactional()`: read the report's `ReportFile` ids, `deleteMany({ id })` (404 if count is 0; `ReportFile` rows go by cascade), then outbox `resource.files.removed { files: [{ id, count: 1 }] }` for the attachments (file-service lowers `ref_count`).

### GET /api/v1/resources/reports

`ListReportsQueryDto` (`reportedBy?`, `type?`, `status?`, `targetType?`, `targetId?`, page/limit) + `requesterOf(user, [Mod, Admin])` → `resource.ReportService/ListReports` → `ReportService.listReports`: non-privileged callers are forced to `reportedBy = requesterId` whatever they send; exact-match filters, order `createdAt desc`, paged + count. Response `ListReportsDto { reports, totalCount }`.

### POST /api/v1/resources/reports/:id/files

- **Access**: reporter or mod/admin (`findVisibleReport`); uploader check skipped only when `mayAttachAnyFile = hasAnyRole(user, [Admin])`.
- **Flow**: `AddFileToReportDto` (`fileId`) → `resource.ReportService/AddFileToReport` → `ReportService.addFileToReport`: `findVisibleReport` (404) → unless admin, `CheckFilesOwnedBy([fileId], requesterId)` (403) → in one transaction, `ReportFile.createMany(skipDuplicates)`; only a new row writes outbox `resource.file.added { fileId }` (re-attaching is a no-op). Not `@Transactional`. Response empty. Worked example: [authorization.md §7(c)](../authorization.md#c-attaching-a-file-someone-else-uploaded).

### DELETE /api/v1/resources/reports/:reportId/files/:fileId

`requesterOf(user, [Mod, Admin])` → `resource.ReportService/RemoveFileFromReport` → `findVisibleReport` (404) → `ReportFile.deleteMany({ reportId, fileId })`; 404 `File is not attached to this report` if nothing was deleted, else (same transaction) outbox `resource.files.removed { files: [{ id: fileId, count: 1 }] }`. The reporter may remove files from their own report regardless of status. Response empty.

## Background work

- **Consumers in `apps/resource`**: none (no `@RabbitSubscribe` in `apps/resource/src`). The resource app only publishes.
- **BullMQ / cron / interval jobs**: none in `apps/resource/src`.
- **Outbox relay**: runs in the resource process (`MessagingModule.forRoot({ serviceName: 'resource', relay: true })` in `apps/resource/src/resource.module.ts`), polling `outbox` and publishing on `eventbus`; see [messaging.md §4](../messaging.md#4-the-relay-outboxrelay).
- **Sockets / SSE**: none in this service. Notifications created by the consumers below are pushed by notification's SSE (`sseService.emit` in `apps/notification/src/app/services/notification.service.ts`).

Consumers (in other apps) of the events emitted by the operations above; every queue is built with `defineConsumerQueue`, so it has `<q>.retry.1..5` and `<q>.dlq`:

| Routing key                      | Queue                                       | Handler                                                                                                    | Inbox | Effect                                                                                                |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `resource.resource.created`      | `authorization.events.resource.created`     | `ResourceCreatedHandler`, `apps/authorization/src/app/events/handlers/resource-ownership.handler.ts`       | yes   | upsert `resource_ownership` (first owner wins)                                                        |
| `resource.resource.deleted`      | `authorization.events.resource.deleted`     | `ResourceDeletedHandler`, same file                                                                        | yes   | delete `resource_ownership` row                                                                       |
| `resource.blog-comment.created`  | `notification.events.blog-comment.created`  | `BlogCommentCreatedHandler`, `apps/notification/src/app/events/handlers/blog-comment-created.handler.ts`   | yes   | notify replied-to author and post author (preferences `commentReply`, `blogComment`)                  |
| `resource.report.created`        | `notification.events.report.created`        | `ReportCreatedHandler`, `apps/notification/src/app/events/handlers/report-created.handler.ts`              | yes   | gRPC `auth.FindIdentityIdsByRole(Admin)`, notify each admin except the reporter (preference `report`) |
| `resource.report.status-changed` | `notification.events.report.status-changed` | `ReportStatusChangedHandler`, `apps/notification/src/app/events/handlers/report-status-changed.handler.ts` | yes   | notify the reporter (preference `report`)                                                             |

None of these consumers emits further events.

## Findings

- `apps/resource/src/app/services/flashcard-list.service.ts:154`: `addCardToList` ignores `position` from `AddCardToListDto`, although the gateway validates and forwards it.
- `apps/resource/src/app/services/blog.service.ts:66` (and `flashcard.service.ts:72-74`, `flashcard-list.service.ts:104`): an empty `tags`/`examples` array means "keep the old value", and the gateway turns a missing field into `[]`, so a client cannot clear the tags or examples of a blog, card or list.
- `apps/resource/src/app/services/report.service.ts:101`: `status` is any string (no enum check in either `UpdateReportDto`), so typos create new statuses; the notification falls back to the raw value.
- `apps/resource/src/app/services/report.service.ts:102`: `resolvedBy` is overwritten with whoever made any update, including a status change back to `pending` or an edit of `adminResponse` only.
- `apps/resource/src/app/services/report.service.ts:64`: `createReport` checks file ownership for admins too, while `addFileToReport` lets admins attach any file; AGENTS.md says admins skip the check "on exam and report attaches".
- `apps/resource/src/app/services/report.service.ts:64`: the `CheckFilesOwnedBy` gRPC call runs inside the open `@Transactional()` DB transaction, holding it open for a network round trip.
- `apps/resource/src/app/services/blog-comment.service.ts:205-208`: soft delete clears `content` but keeps `authorId` in the row, while the class comment (line 33) says "content and author cleared"; the author is only hidden in responses.
- `apps/resource/src/app/services/blog-comment.service.ts:92`: `totalThreads` counts top-level placeholders that `buildCommentTree` may prune from the page, so a page can hold fewer roots than `limit` while the total still counts them.
- `apps/resource/src/app/services/flashcard.service.ts:60`: `updateFlashCard` and `deleteFlashCard` rely on `@ResourceAccess` alone (no service-side owner check), so a new card is 403 for its author until the ownership event is consumed (already noted in authorization.md §7(e)).
- ~~Doc drift~~: `messaging.md` §7 and `services-and-data.md` now list `resource.report.created` and `resource.blog-comment.created`.
