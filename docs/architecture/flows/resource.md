# Resource flows (blogs, comments, flash cards, lists, reports)

Routes served by `ResourceGatewayController` (`apps/gateway/src/resource-gateway/resource.router.controller.ts`), mounted under `/api/v1/resources` (global prefix `api` + URI version `1` in `apps/gateway/src/bootstrap.ts`, `RouterModule` path `/resources` in `apps/gateway/src/router.module.ts`). They call the `resource` app (`apps/resource`) over gRPC; it uses plain application services in `apps/resource/src/app/services/` with Prisma through `TransactionHost`, no CQRS. Tables: [apps/resource/README.md](../../../apps/resource/README.md). Forum routes are in [resource-community.md](resource-community.md); flash card copy/diff/pull and proposals (`FlashCardProposalGatewayController`) are in [resource-community.md](resource-community.md).

Common to every route below:

- Gateway global guards (`apps/gateway/src/gateway.module.ts`): `ThrottlerGuard` (throttler `default`: 100/min per route per IP+account, per IP when signed out; `apps/gateway/src/throttle.ts`; no route here overrides it), `JwtAuthGuard` (no route here is `@IsPublic`, so all need a valid JWT), `RolesGuard`, `PermissionsGuard`, `ResourceAccessGuard`.
- `requesterOf(req.user, roles)` (`apps/gateway/src/auth/functions/requester.ts`) adds `{ requesterId: sub, privileged }`; the service turns it into a `Requester` with `toRequester` (`apps/resource/src/presentation/dtos/req/requester.req.dto.ts`). See [authorization.md §6](../authorization.md#6-requester-pattern-authorization-in-the-owning-service).
- Pagination: `toSkipTake` (`apps/resource/src/app/types/pagination.ts`), defaults page 1, limit 10; gateway `PageQueryDto` bounds `page >= 1`, `1 <= limit <= 100`.
- Every service-side gRPC controller is in `apps/resource/src/presentation/controllers/` and only forwards to the service method named in each section.
- Events go through `ResourceEventsPublisher` (`apps/resource/src/app/events/resource-events.publisher.ts`) → `OutboxPublisher.add` (enveloped, written in the caller's transaction); the relay runs in the resource process (`MessagingModule.forRoot({ relay: true })`, `apps/resource/src/resource.module.ts`). See [messaging.md](../messaging.md).

## Contents

| Operation                                                                                   | Access                                  | Writes                         | Events                                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| [POST /blogs](#post-apiv1resourcesblogs)                                                    | any user                                | `Blog`                         | `resource.resource.created`                                   |
| [GET /blogs/tags](#get-apiv1resourcesblogstags)                                             | any user                                | -                              | -                                                             |
| [GET /blogs/:id](#get-apiv1resourcesblogsid)                                                | any user                                | -                              | -                                                             |
| [PATCH /blogs/:id](#patch-apiv1resourcesblogsid)                                            | `@ResourceAccess` blog                  | `Blog`                         | -                                                             |
| [DELETE /blogs/:id](#delete-apiv1resourcesblogsid)                                          | `@ResourceAccess` blog                  | `Blog` (cascade `BlogComment`) | `resource.resource.deleted`                                   |
| [GET /blogs](#get-apiv1resourcesblogs)                                                      | any user                                | -                              | -                                                             |
| [GET /blogs/:id/comments](#get-apiv1resourcesblogsidcomments)                               | any user                                | -                              | -                                                             |
| [POST /blogs/:id/comments](#post-apiv1resourcesblogsidcomments)                             | any user                                | `BlogComment`                  | `resource.blog-comment.created`                               |
| [PATCH /blog-comments/:commentId](#patch-apiv1resourcesblog-commentscommentid)              | author (service)                        | `BlogComment`                  | -                                                             |
| [DELETE /blog-comments/:commentId](#delete-apiv1resourcesblog-commentscommentid)            | author or mod/admin (service)           | `BlogComment`                  | -                                                             |
| [POST /flash-cards](#post-apiv1resourcesflash-cards)                                        | list owner (service) + uploader check   | `FlashCard`                    | `resource.resource.created`, `resource.file.added`            |
| [GET /flash-cards/:id](#get-apiv1resourcesflash-cardsid)                                    | visible list (service)                  | -                              | -                                                             |
| [PATCH /flash-cards/:id](#patch-apiv1resourcesflash-cardsid)                                | list owner or admin + uploader check    | `FlashCard`                    | `resource.file.added` / `.files.removed` (image)              |
| [DELETE /flash-cards/:id](#delete-apiv1resourcesflash-cardsid)                              | list owner or admin (service)           | `FlashCard`                    | `resource.resource.deleted`, `resource.files.removed`         |
| [GET /flash-cards](#get-apiv1resourcesflash-cards)                                          | visible lists (service)                 | -                              | -                                                             |
| [POST /flash-card-lists](#post-apiv1resourcesflash-card-lists)                              | any user                                | `FlashCardList`                | -                                                             |
| [GET /flash-card-lists/:id](#get-apiv1resourcesflash-card-listsid)                          | visible (service)                       | -                              | -                                                             |
| [PATCH /flash-card-lists/:id](#patch-apiv1resourcesflash-card-listsid)                      | owner or admin (service)                | `FlashCardList`                | -                                                             |
| [DELETE /flash-card-lists/:id](#delete-apiv1resourcesflash-card-listsid)                    | owner or admin (service)                | `FlashCard`, `FlashCardList`   | `resource.resource.deleted` x cards, `resource.files.removed` |
| [GET /flash-card-lists](#get-apiv1resourcesflash-card-lists)                                | visible (service)                       | -                              | -                                                             |
| [POST /flash-card-lists/:id/cards](#post-apiv1resourcesflash-card-listsidcards)             | owner or admin (service)                | `FlashCard.listId`             | -                                                             |
| [GET /flash-card-lists/:id/cards](#get-apiv1resourcesflash-card-listsidcards)               | visible (service)                       | -                              | -                                                             |
| [POST /reports](#post-apiv1resourcesreports)                                                | any user                                | `Report`, `ReportFile`         | `resource.report.created`                                     |
| [GET /reports/:id](#get-apiv1resourcesreportsid)                                            | reporter or mod/admin (service)         | -                              | -                                                             |
| [PATCH /reports/:id](#patch-apiv1resourcesreportsid)                                        | `@HasRoles(Mod, Admin)`; 409 once final | `Report`                       | `resource.report.status-changed` (if status changed)          |
| [DELETE /reports/:id](#delete-apiv1resourcesreportsid)                                      | `@HasRoles(Mod, Admin)`                 | `Report` (cascade files)       | -                                                             |
| [GET /reports](#get-apiv1resourcesreports)                                                  | own; mod/admin all (service)            | -                              | -                                                             |
| [POST /reports/:id/files](#post-apiv1resourcesreportsidfiles)                               | reporter or mod/admin + uploader check  | `ReportFile`                   | -                                                             |
| [DELETE /reports/:reportId/files/:fileId](#delete-apiv1resourcesreportsreportidfilesfileid) | reporter or mod/admin (service)         | `ReportFile`                   | -                                                             |

All paths in the table are relative to `/api/v1/resources`.

## How `@ResourceAccess` routes are checked

Used only by `PATCH`/`DELETE /blogs/:id` (`resourceType: 'blog'`). Both have the same rules: `{ roles: [Admin] }`, then `{ roles: [Mod, User, Student, Teacher], requireOwnership: true }`. (`PATCH`/`DELETE /flash-cards/:id` used it too until they moved to the requester pattern; see [below](#patch-apiv1resourcesflash-cardsid).)

1. `ResourceAccessGuard` (`apps/gateway/src/auth/guards/resource-access.guard.ts`) walks the rules in order. Admin matches rule 1 and is allowed without any call.
2. For rule 2 it calls `authorization.AuthorizationService/CheckOwnership { userId: sub, resourceType, resourceId: req.params.id }`; the authorization service reads `resource_ownership` by `(resource_type, resource_id)` and returns `isOwner`.
3. No rule allows → 403. This includes unknown ids (no ownership row), the creator before the `resource.resource.created` event has been consumed, and users whose only roles are outside the list (e.g. `parent`, `mentor`).
4. The ownership rows come from `resource.resource.created/deleted` (see [Background work](#background-work)) and from the authorization seed backfill.

The resource service does no ownership check of its own on these two routes. Full walkthrough: [authorization.md §5](../authorization.md#5-legacy-resourceaccess-and-the-authorization-service).

## Blogs

### POST /api/v1/resources/blogs

Create a blog post.

- **Access**: any authenticated user; `authorId = req.user.sub`.
- **Flow**:
  1. Gateway: `CreateBlogDto` (`title`, `content` strings; optional `tags: string[]`, defaulted to `[]`) → `resource.BlogService/CreateBlog`.
  2. `BlogController.createBlog` → `BlogService.createBlog` (`apps/resource/src/app/services/blog.service.ts:40`) → `insertBlog`, `@Transactional()`.
  3. Pick the slug: read the slugs starting with the title's base slug, take the first free one (`nextFreeSlug(title, taken, 'bai-viet')`, see [Slugs](#slugs)). Insert `Blog` with it; in the same transaction outbox `resource.resource.created` `{ resourceType: 'blog', resourceId, ownerId: authorId }`.
  4. A lost slug race (P2002 on `slug`) retries the whole transaction, up to 5 attempts (`withSlugRetry`).
  5. Response `BlogDto` (with `slug`).
- **Async**: `resource.resource.created` → `authorization.events.resource.created` → `ResourceCreatedHandler` registers ownership (inbox yes). Until then the author's own `PATCH`/`DELETE` returns 403.

### GET /api/v1/resources/blogs/tags

Every tag used by blogs with its count, most used first then by name. `BlogService.listBlogTags` runs one raw SQL query over `blogs, unnest(tags)`; response `ListBlogTagsDto { tags: [{ name, count }] }`. Declared before `blogs/:id` so `tags` is not taken as an id.

### GET /api/v1/resources/blogs/:id

`:id` is the id **or** the slug. `resource.BlogService/GetBlog` → `BlogService.getBlog` → `findBlog`: `Blog.findUnique` by id (same query as before), then by `slug` if that misses; 404 `Blog not found`. Response `BlogDto`. No visibility rules (all blogs are readable by any logged-in user).

### PATCH /api/v1/resources/blogs/:id

Update a blog post.

- **Access**: `@ResourceAccess` `blog` (see [above](#how-resourceaccess-routes-are-checked)).
- **Flow**:
  1. Gateway: `UpdateBlogDto` (all optional; `tags` defaulted to `[]`) → `resource.BlogService/UpdateBlog { ...body, id, replaceTags: tags was in the body }`.
  2. `BlogService.updateBlog`: `findUnique` (404), then `update` with `title ?? old` (the slug is never changed, so links keep working), `content ?? old`, `tags` replaced when `replaceTags` (so `[]` clears them) or non-empty, else kept. Not `@Transactional`; no version check.
  3. Response `BlogDto`.
- **Errors**: 403 from the guard; 404 if the row is gone.

### DELETE /api/v1/resources/blogs/:id

- **Access**: `@ResourceAccess` `blog`. `PATCH` and `DELETE` take the real id only (ownership is keyed by it), so the frontend uses `id`, not `slug`, for them.
- **Flow**: `resource.BlogService/DeleteBlog` → `BlogService.deleteBlog`, `@Transactional()`: `findUnique` (404) → `Blog.delete` (FK cascade removes its `BlogComment` rows) → outbox `resource.resource.deleted` `{ resourceType: 'blog', resourceId }`. Response empty.
- **Async**: `authorization.events.resource.deleted` → `ResourceDeletedHandler` removes the ownership row (inbox yes).

### GET /api/v1/resources/blogs

`ListBlogsQueryDto` (`authorId?`, `tags` via `ToStringArray`, page/limit) → `resource.BlogService/ListBlogs` → `BlogService.listBlogs`: `where authorId`, `tags hasSome` (any of the tags), order `createdAt desc`, `findMany` + `count` in parallel. Response `ListBlogsDto { blogs, totalCount }`.

## Slugs

Blog posts (and forum threads, see [community flows](resource-community.md#forum)) have a readable, unique `slug` (`Blog.slug`, `ForumThread.slug`, `String? @unique`) from their title, e.g. `Làm thế nào để viết email` → `lam-the-nao-de-viet-email`. Rules (`apps/resource/src/app/slugs/slugs.ts`, `slugify` / `nextFreeSlug` from `@server/utils`): accents dropped and `đ` → `d`, at most 80 characters; `bai-viet` (blog) or `chu-de` (thread) when nothing usable is left; on a clash the first free `-2`, `-3`, … (one `startsWith` query reads the taken ones). The slug is set once on create and never changes when the title is edited, so links do not break. Responses (`BlogDto`, `ForumThreadSummaryDto`, `ForumThreadDto`) include `slug`; the frontend links with `slug ?? id`, and every read route that takes the post/thread from the URL accepts either.

**Backfill.** The column is nullable so rows from before slugs stay valid. `SlugBackfillService` (`apps/resource/src/app/services/slug-backfill.service.ts`) runs `backfillSlugs` (`apps/resource/src/app/slugs/slug-backfill.ts`) on every start (`onApplicationBootstrap`, in the background: startup does not wait, a failure is logged and retried on the next start). It fills `slug IS NULL` rows in batches of 200, oldest first (so the oldest post of a title keeps the plain slug), with the create-time rule. Each row is one `updateMany ... where { id, slug: null }` outside any transaction, so it is idempotent and safe on several instances at once: a row filled elsewhere is left alone, a slug taken elsewhere (P2002) is recomputed (5 attempts, then the row is left for the next run). The seed inserts posts and threads without slugs; the next service start fills them.

## Blog comments

Comments are a materialized-path tree (`BlogComment`, table `blog_comments`; schema `apps/resource/prisma/schema/blog-comment.prisma`): `rootId` (top-level ancestor), `path` (fixed-width 4-char base36 segment per level, empty for top level), `depth`, `childSeq` (per-parent counter, only grows), soft-delete `deletedAt`. Rationale and helpers: `apps/resource/src/domain/comments/comment-path.ts` (`MAX_COMMENT_DEPTH = 8`, 36^4 children per comment), tree building and pruning in `comment-tree.ts`. Service: `BlogCommentService` (`apps/resource/src/app/services/blog-comment.service.ts`). Comments are "moderated" only by deletion: `Mod`/`Admin` are `privileged` and may delete anyone's comment; there is no hide/approve state.

### GET /api/v1/resources/blogs/:id/comments

Top-level comments paged (newest first), each with its full reply tree.

- **Flow**:
  1. Gateway: `ListBlogCommentsQueryDto` (`page >= 1`, `1 <= limit <= 50`) → `resource.BlogCommentService/ListBlogComments { ...query, blogId }`. No requester is sent.
  2. `BlogCommentService.listComments`: `:id` may be the blog's id or slug (`assertBlogExists` tries the id, then the slug; 404 `Blog not found`), and everything after uses the real id; then in parallel: page of root ids (`parentId null`, order `createdAt desc, id desc`), count of roots (`totalThreads`, includes placeholders), count of live comments (`totalComments`).
  3. One query `blogComment.findMany({ rootId in rootIds })`, then `buildCommentTree` sorts by `path` (siblings oldest first), drops orphans and prunes deleted comments with no remaining replies.
  4. Placeholders are returned with `deleted: true`, empty `authorId`/`content`, no `editedAt`. Response `ListBlogCommentsDto { comments, totalThreads, totalComments }`.

### POST /api/v1/resources/blogs/:id/comments

Comment on a post or reply to a comment.

- **Access**: any user; `requesterOf(req.user, [Mod, Admin])` (only `requesterId` matters here; it becomes `authorId`).
- **Flow**:
  1. Gateway: `CreateBlogCommentDto` (`content` non-empty, max 5000; optional `parentId`) → `resource.BlogCommentService/CreateBlogComment`.
  2. `BlogCommentService.createComment`, `@Transactional()`: load blog by id or slug (404), the comment is stored under the real id; trim content (400 `content must not be empty` if blank); new id from `randomUUID()`.
  3. Top-level: insert with `rootId = id`, `path = ''`, `depth 0`.
  4. Reply: load parent, must be live and on the same blog (else 404 `Comment not found`). Remember `repliedTo = parent.authorId`. The reply is stored under that parent at any depth (no limit). `update parent set childSeq = childSeq + 1` (row lock, hands out the segment) → `path = parent.path + segment`, `depth = path.length / 4`, insert.
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
  1. `SELECT id FROM blog_comments WHERE id = $1 FOR UPDATE` (`lockComment`), then load live comment (404); 404 if not author and not privileged. If it is a reply, lock its parent row the same way.
  2. Has direct replies → soft delete: set `deletedAt = now`, `content = ''` (`authorId` is kept in the row, hidden in responses).
  3. No replies → hard delete, then walk up the parents: delete each ancestor that is a placeholder and now has no replies (locking that ancestor's parent before deleting it); stop at the first live or still-populated one.
  4. Locks are always taken deepest first, so concurrent deletes on one chain wait for each other rather than deadlock. That closes the race where deleting the last reply and its parent at the same time left a reply-less `[deleted]` placeholder (each transaction had counted the other's row): whichever runs second sees the first one's commit.
- **Errors**: 404 for missing, already deleted, or not yours.

## Flash cards

Service: `FlashcardService` (`apps/resource/src/app/services/flashcard.service.ts`). Visibility helper `visibleListsWhere` (`apps/resource/src/app/mappers/flash-card.mapper.ts:44`): privileged sees all; others see cards in public lists or in their own lists. Privileged here means `Admin` only (`FLASH_CARD_ADMIN_ROLES`).

**Card images** are file-service files. The client uploads with `POST /files` (`isPublicFile: true`, like avatars and exam media, so the URL never expires) and sends the returned id as `imageFileId`; free image URLs are no longer accepted (the request field `image` is gone, its proto numbers reserved). `flash_cards.image_file_id` holds the id; the old `flash_cards.image` column keeps the URL of cards from before, still returned, and is cleared when an image is set or removed.

- **References**: every card row holding an `imageFileId` is one reference in file-service's `ref_count`. `CardImageRefsService` (`apps/resource/src/app/services/card-image-refs.service.ts`) writes `resource.file.added { fileId }` (one per new holder) and `resource.files.removed { files: [{ id, count }] }` (repeats grouped) to the outbox in the same transaction as the card change. Cards are deleted with `DELETE FROM flash_cards … RETURNING id, image_file_id`, so only rows this statement removed are released (a card deleted concurrently is never released twice). Copies share the file id and hold their own reference (see [resource-community.md](resource-community.md#card-images-in-copies-and-proposals)).
- **URLs**: responses carry `imageFileId` and `image`, the URL to show. `CardImageUrlService` (`card-image-url.service.ts`) resolves all ids of one response with a single `file.FileService/GetUrls` call, outside any transaction, and sets `image` to the file's public URL; a card without a file keeps its legacy URL. An id file-service doesn't know (or file-service down: logged, the read still succeeds) leaves `image` absent.

### POST /api/v1/resources/flash-cards

- **Access**: any user; the service requires the target list to be theirs.
- **Flow**:
  1. Gateway: `CreateFlashCardDto` (`word`, `definition`, `listId` required; `imageFileId`, `partOfSpeech`, `pronunciation`, `notes` optional; `examples`, `tags` default `[]`) + `authorId = sub` + `mayAttachAnyFile = hasAnyRole(user, [Admin])` → `resource.FlashCardService/CreateFlashCard`.
  2. `FlashcardService.createFlashCard`: if `imageFileId` is set and the caller is not an admin, `CheckFilesOwnedBy([imageFileId], authorId)` (403 `You can only attach files you uploaded: <id>`), before any transaction opens.
  3. `@Transactional()` `insertCard`: load list (404 `FlashCardList not found`); 403 `Cards can only be added to your own lists` if `list.authorId !== authorId` (admins included); insert `FlashCard` (`imageFileId`); outbox `resource.file.added { fileId }` if it has an image; outbox `resource.resource.created` `{ resourceType: 'flashcard', resourceId, ownerId }`.
  4. Image URL resolved (`GetUrls`); response `FlashCardDto` (`image` = URL, `imageFileId`).
- **Async**: authorization registers ownership (as for blogs), but no route reads `flashcard` ownership any more: the author can update or delete the new card at once. file-service raises the image's `ref_count`.

### GET /api/v1/resources/flash-cards/:id

`requesterOf(user, [Admin])` → `resource.FlashCardService/GetFlashCard` → `FlashcardService.getFlashCard`: `findFirst({ id, list: visibleListsWhere })`; 404 `FlashCard not found` if missing or in a private list that is not yours. Image URL resolved. Response `FlashCardDto`.

### PATCH /api/v1/resources/flash-cards/:id

- **Access**: owner of the card's list, or admin, checked in the service (requester pattern). The gateway adds `requesterOf(user, [Admin])`; no `@ResourceAccess`.
- **Flow**: `UpdateFlashCardDto` (all optional; `examples`, `tags` default `[]`; the gateway sets `replaceExamples`/`replaceTags` when the body has the list) → `resource.FlashCardService/UpdateFlashCard { ...body, id, requesterId, privileged, mayAttachAnyFile }` → `FlashcardService.updateFlashCard`:
  1. `findOwnedCard` = `findFirst({ id, list: { authorId: requesterId } })` (no list filter when privileged), 404 `FlashCard not found` if nothing matches.
  2. `imageFileId`: absent keeps the image; `''` removes it; an id replaces it. A new id that is not the card's current image is checked with `CheckFilesOwnedBy([id], requesterId)` (403) unless admin, before the transaction. Re-sending the current id is no change (so the owner of a copy can save a card whose image someone else uploaded).
  3. `@Transactional()` `writeCard`: `SELECT id FROM flash_cards WHERE id = $1 FOR UPDATE`, `findOwnedCard` again; 409 `The card changed while saving; please try again` if the image changed meanwhile so that the sent id was never checked. `update`: undefined fields are left unchanged, `examples`/`tags` replaced when their `replace*` flag is set (so `[]` clears them) or non-empty; setting or removing an image writes `imageFileId` and clears the legacy `image`. If the image changed: outbox `resource.files.removed` for the old file and `resource.file.added` for the new one.
  4. Image URL resolved; response `FlashCardDto`.
- **Errors**: 404 for a missing card and for someone else's card (public list or not), so ids don't leak. Walkthrough: [authorization.md §7(e)](../authorization.md#33-requester-pattern-patch-apiv1examsmanagementid).

### DELETE /api/v1/resources/flash-cards/:id

- **Access**: owner of the card's list, or admin (service), as for `PATCH`.
- **Flow**: `resource.FlashCardService/DeleteFlashCard { id, requesterId, privileged }` → `FlashcardService.deleteFlashCard`, `@Transactional()`: `findOwnedCard` (404) → `DELETE … RETURNING` (404 if a concurrent delete got there first) → outbox `resource.files.removed` for its image, if any → outbox `resource.resource.deleted` `{ resourceType: 'flashcard', resourceId }`.
- **Async**: authorization removes the ownership row.

### GET /api/v1/resources/flash-cards

`ListFlashCardsQueryDto` (`authorId?`, `tags`, page/limit) + `requesterOf(user, [Admin])` → `resource.FlashCardService/ListFlashCards` → `FlashcardService.listFlashCards`: `where { list: visibleListsWhere, authorId?, tags hasSome }`, order `createdAt desc`, `findMany` + `count`. Image URLs resolved (one `GetUrls` for the page). Response `ListFlashCardsDto { flashCards, totalCount }`.

## Flash card lists

Service: `FlashcardListService` (`apps/resource/src/app/services/flashcard-list.service.ts`). Mutations go through `findOwnedList` (line 36): 404 if the list is missing or private and not yours (non-admin); 403 `You do not own this flash card list` if it is public but not yours. Privileged = `Admin`. Copy (`/fork`), `/diff`, `/pull` and proposals are in [resource-community.md](resource-community.md).

### POST /api/v1/resources/flash-card-lists

`CreateFlashCardListDto` (`name`; optional `description`, `isPublic`, `tags` default `[]`) + `authorId = sub` → `resource.FlashCardListService/CreateFlashCardList` → `FlashcardListService.createFlashCardList`: insert `FlashCardList` (`isPublic` default false). No event (lists are not registered in authorization; nothing uses `@ResourceAccess` on lists). Response `FlashCardListDto`.

### GET /api/v1/resources/flash-card-lists/:id

- **Flow**: `resource.FlashCardListService/GetFlashCardList` → `FlashcardListService.getFlashCardList`:
  1. `findFirst({ id, ...visibleListsWhere })` including all `cards` (in `CARD_ORDER`, see [add a card](#post-apiv1resourcesflash-card-listsidcards)) and the fork count (`_count.forks`); 404 if not visible.
  2. In parallel: if owner or admin, count `FlashCardListProposal` with `targetListId = id` and status `OPEN` (else 0); if the list is a copy, check the upstream list is still visible to the requester.
  3. Image URLs of the cards resolved (one `GetUrls`). Response `FlashCardListDetailDto` (list fields + `flashCards` (all, unpaged), `totalCards`, `openProposalCount`, `upstreamAvailable`).

### PATCH /api/v1/resources/flash-card-lists/:id

`UpdateFlashCardListDto` (all optional; `tags` default `[]`, `replaceTags` set when the body has them) + `requesterOf(user, [Admin])` → `resource.FlashCardListService/UpdateFlashCardList` → `findOwnedList` (404/403) → `update` (`tags` replaced when `replaceTags`, so `[]` clears them, or non-empty). Not `@Transactional`. Response `FlashCardListDto`.

### DELETE /api/v1/resources/flash-card-lists/:id

- **Access**: owner or admin (service).
- **Flow**: `resource.FlashCardListService/DeleteFlashCardList` → `FlashcardListService.deleteFlashCardList`, `@Transactional()`: `SELECT id FROM flash_card_lists WHERE id = $1 FOR UPDATE` (a card being created in the list meanwhile either commits first and is deleted here, or fails its foreign key after) → `findOwnedList` → `DELETE FROM flash_cards WHERE list_id = $1 RETURNING id, image_file_id` → one outbox `resource.files.removed` releasing their images (one entry per file, `count` = cards that held it) → delete the list (FK cascade deletes proposals targeting it; copies of it keep existing with `forkedFromId` set null, and keep their own image references) → one outbox `resource.resource.deleted` `{ resourceType: 'flashcard', resourceId }` per card, written sequentially.
- **Async**: authorization removes each card's ownership row; file-service lowers the images' `ref_count` (a file no card holds any more is deleted by the orphan cleanup 24 h after its last change).

### GET /api/v1/resources/flash-card-lists

`ListFlashCardListsQueryDto` (`authorId?`, `isPublic?` via `str2bool`, `tags`, `name?` max 100, page/limit) → `resource.FlashCardListService/ListFlashCardLists` → `FlashcardListService.listFlashCardLists`: `AND[filters, visibleListsWhere]`, `name` is a case-insensitive `contains`, `tags hasSome`, includes fork count, order `createdAt desc`. Response `ListFlashCardListsDto { lists, totalCount }`.

### POST /api/v1/resources/flash-card-lists/:id/cards

Move an existing card into this list.

- **Access**: owner or admin (service).
- **Flow**: `AddCardToListDto` (`flashCardId`; `position?` int >= 0) → `resource.FlashCardListService/AddCardToList` → `FlashcardListService.addCardToList`, `@Transactional()`:
  1. `SELECT id FROM flash_card_lists WHERE id = $1 FOR UPDATE` (concurrent moves into one list wait for each other), `findOwnedList` (404/403) → load card (404 `FlashCard not found`) → 403 `Only cards by the list author can be moved into it` unless `card.authorId === list.authorId`.
  2. Read the list's other cards in display order (`CARD_ORDER`, below). `index = min(position ?? n, n)`: no `position` appends; past the end means last; a card already in this list is moved.
  3. `update FlashCard set listId, position = index`; then one raw `UPDATE flash_cards … FROM unnest(ids, positions)` numbers the other cards `0..n` around it, writing only the rows whose position changes (raw, so their `updatedAt` is untouched). Response empty.
- **Card order** (`CARD_ORDER`, `apps/resource/src/app/mappers/flash-card.mapper.ts`): `position asc nulls first, createdAt desc, id asc`. `flash_cards.position` (nullable, added by `db push`) is null for every card from before the column and for cards created since (`POST /flash-cards`, accepted proposals, pulled cards): those come first, newest first, which is exactly the old order, so lists nobody reorders look as before. The first add/move into a list numbers all its cards, so `position` is then the card's 0-based index; a card created afterwards shows at the top until the next add/move. Moving a card out of a list leaves a gap in the old list's numbers (harmless: only the order counts). Used by `GET /flash-card-lists/:id` (its `flashCards`) and `GET /flash-card-lists/:id/cards`; `GET /flash-cards` (across lists) stays `createdAt desc`. `FlashCardDto.position` is returned when set.

### GET /api/v1/resources/flash-card-lists/:id/cards

`PageQueryDto` → `resource.FlashCardListService/ListCardsInList` → `FlashcardListService.listCardsInList`: 404 unless the list is visible; then cards `where listId`, order `CARD_ORDER` (see above), paged, plus count. Image URLs resolved. Response `ListFlashCardsDto`.

## Reports

Service: `ReportService` (`apps/resource/src/app/services/report.service.ts`). Privileged = `Mod`/`Admin` (`REPORT_STAFF_ROLES`). `findVisibleReport` (line 50): 404 `Report not found` unless privileged or the reporter. File checks use `FileOwnershipService.assertOwnedBy` (`apps/resource/src/app/services/file-ownership.service.ts`), which calls `file.FileService/CheckFilesOwnedBy { fileIds, userId }` on file-service over gRPC; any id not uploaded by `userId` (other uploader, no recorded uploader, or unknown id) gives 403 `You can only attach files you uploaded: <ids>`. Attachments are reference-counted through `resource.file.added` / `resource.files.removed` (see the routes below).

### POST /api/v1/resources/reports

- **Access**: any user; `reportedBy = sub`; uploader check skipped only when `mayAttachAnyFile = hasAnyRole(user, [Admin])`.
- **Flow**:
  1. Gateway: `CreateReportDto` (`type`, `title`, `description`; optional `targetType`, `targetId`, `fileIds` default `[]`; all free strings) → `resource.ReportService/CreateReport`.
  2. `ReportService.createReport`: dedupe `fileIds`; if any and not admin, `CheckFilesOwnedBy(fileIds, reportedBy)` (403), before any transaction opens. Then `@Transactional()` `insertReport`: insert `Report` (status default `pending`) with nested `ReportFile` rows; outbox `resource.file.added { fileId }` per attachment (file-service raises `ref_count`, so the orphan cleanup keeps it); outbox `resource.report.created` `{ reportId, reportedBy, type, title, targetType, targetId }`.
  3. Response `ReportDto` (with `fileIds`).
- **Async**: `notification.events.report.created` → `ReportCreatedHandler` (`apps/notification/src/app/events/handlers/report-created.handler.ts`, inbox yes): calls `auth.AuthService/FindIdentityIdsByRole { role: Admin }` (an auth outage throws, so the message is retried), notifies every admin except the reporter whose `report` preference is on (`action: '/report-management'`). Mods are not notified.
- **Errors**: 403 foreign files (non-admins).

### GET /api/v1/resources/reports/:id

`requesterOf(user, [Mod, Admin])` → `resource.ReportService/GetReport` → `findVisibleReport`; 404 for missing or someone else's report. Response `ReportDto`. Worked example: [authorization.md §7(b)](../authorization.md#33-requester-pattern-patch-apiv1examsmanagementid).

### PATCH /api/v1/resources/reports/:id

Triage a report.

- **Access**: `@HasRoles(Mod, Admin)` (403 in the gateway otherwise); `resolvedBy = sub`.
- **Flow**:
  1. Gateway: `UpdateReportDto` (`status?`: one of `pending`, `reviewing`, `in_progress`, `resolved`, `rejected`, `dismissed`, `closed`, the `ReportStatus` enum, else 400, checked again by resource's DTO; `adminResponse?` free string) → `resource.ReportService/UpdateReport { ...body, id, resolvedBy }`.
  2. `ReportService.updateReport`, `@Transactional()`: `SELECT id FROM reports WHERE id = $1 FOR UPDATE` → `findUnique` (404) → 409 `This report is already <status> and can no longer be changed` if the report is in a final status (`isFinalReportStatus`, `apps/resource/src/enums/report-status.enum.ts`: `resolved`, `rejected`, `dismissed`, `closed`, all treated the same), for everyone including admins → update `status ?? old`, `adminResponse ?? old`, and `resolvedBy` = the caller if the new status is final, else `null`.
  3. If the status changed: outbox `resource.report.status-changed` `{ reportId, reportedBy, status, title }`.
  4. Response `ReportDto`. `resolvedBy` means "who resolved it": it is returned only for reports in a final status (rows from before this rule that name someone on an open report are returned without it, and the next update clears the column).
- **Concurrency**: the row lock makes resolution single-winner: when two staff members resolve at once, the second waits for the first's commit, then sees the final status and gets 409.
- **Errors**: 404 missing; 409 already final; 400 unknown status.
- **Async**: `notification.events.report.status-changed` → `ReportStatusChangedHandler` (inbox yes): notifies the reporter if their `report` preference is on, with a Vietnamese phrase for known statuses (`pending`, `reviewing`, `in_progress`, `resolved`, `rejected`, `dismissed`, `closed`) or the raw value.

### DELETE /api/v1/resources/reports/:id

`@HasRoles(Mod, Admin)` → `resource.ReportService/DeleteReport` → `ReportService.deleteReport`, `@Transactional()`: read the report's `ReportFile` ids, `deleteMany({ id })` (404 if count is 0; `ReportFile` rows go by cascade), then outbox `resource.files.removed { files: [{ id, count: 1 }] }` for the attachments (file-service lowers `ref_count`). Staff may still delete a report in a final status (deleting removes the record; it does not change the resolution). Reporters cannot delete reports at all.

### GET /api/v1/resources/reports

`ListReportsQueryDto` (`reportedBy?`, `type?`, `status?`, `targetType?`, `targetId?`, page/limit) + `requesterOf(user, [Mod, Admin])` → `resource.ReportService/ListReports` → `ReportService.listReports`: non-privileged callers are forced to `reportedBy = requesterId` whatever they send; exact-match filters, order `createdAt desc`, paged + count. Response `ListReportsDto { reports, totalCount }`.

### POST /api/v1/resources/reports/:id/files

- **Access**: reporter or mod/admin (`findVisibleReport`); uploader check skipped only when `mayAttachAnyFile = hasAnyRole(user, [Admin])`.
- **Flow**: `AddFileToReportDto` (`fileId`) → `resource.ReportService/AddFileToReport` → `ReportService.addFileToReport`: `findVisibleReport` (404), 409 if the report is in a final status → unless admin, `CheckFilesOwnedBy([fileId], requesterId)` (403), both outside any transaction → `@Transactional()` `attachFile`: lock the report row (`FOR UPDATE`), `findVisibleReport` and the final-status check again (it may have been resolved during the gRPC call), `ReportFile.createMany(skipDuplicates)`; only a new row writes outbox `resource.file.added { fileId }` (re-attaching is a no-op). Response empty. Worked example: [authorization.md §7(c)](../authorization.md#34-file-attach-patch-apiv1examsmanagementsectionsid-with-addfiles).

### DELETE /api/v1/resources/reports/:reportId/files/:fileId

`requesterOf(user, [Mod, Admin])` → `resource.ReportService/RemoveFileFromReport`, `@Transactional()`: lock the report row (`FOR UPDATE`) → `findVisibleReport` (404) → 409 if the report is in a final status (for staff too) → `ReportFile.deleteMany({ reportId, fileId })`; 404 `File is not attached to this report` if nothing was deleted, else (same transaction) outbox `resource.files.removed { files: [{ id: fileId, count: 1 }] }`. Response empty.

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
| `resource.file.added`            | `file.events.file.added`                    | `FileAddedHandler`, `apps/file-service/src/app/events/handlers/file-added.handler.ts`                      | yes   | `ref_count + 1` (report attachment, card image)                                                       |
| `resource.files.removed`         | `file.events.files.removed`                 | `FileRemovedHandler`, `apps/file-service/src/app/events/handlers/files-removed.handler.ts`                 | yes   | `ref_count - count`, floored at 0                                                                     |

None of these consumers emits further events.

## Findings

- ~~`addCardToList` ignores `position` from `AddCardToListDto`~~: fixed (see fixed-issues.md; `flash_cards.position`, `CARD_ORDER`).
- ~~An empty `tags`/`examples` array meant "keep the old value", so a client could not clear them~~: fixed (see fixed-issues.md; `replaceTags`/`replaceExamples` on blogs, cards and lists).
- ~~Report `status` is any string~~: fixed (see fixed-issues.md; `ReportStatus` checked in both DTOs, existing rows untouched).
- ~~`resolvedBy` is overwritten by any update~~: fixed (see fixed-issues.md): a report is resolved once; `resolvedBy` is set by the move into a final status and the report is frozen (409) after it.
- ~~`createReport` checks file ownership for admins too~~: fixed (see fixed-issues.md; `CreateReportRequest.may_attach_any_file`).
- ~~The `CheckFilesOwnedBy` gRPC call runs inside the open DB transaction~~: fixed (see fixed-issues.md; create and attach both ask before the transaction).
- ~~Soft delete keeps `authorId` while the class comment says it is cleared~~: comment corrected (keeping `authorId` is intended: the column is required and responses blank it).
- ~~`totalThreads` counts placeholders that `buildCommentTree` may prune~~: not a bug in consistent data (`deleteComment` keeps a placeholder only while it has replies, so a root is never pruned); two concurrent deletes could leave an empty placeholder: fixed (see fixed-issues.md; `deleteComment` row-locks the comment and its parent before counting replies).
- ~~`updateFlashCard`/`deleteFlashCard` rely on `@ResourceAccess` alone~~: fixed (see fixed-issues.md; requester pattern, owner check via the card's list).
- ~~Card images are free URL strings (no upload, no uploader check, no cleanup)~~: fixed (see fixed-issues.md, "Flash card images in file-service"; `image_file_id`, reference counted).
- ~~Doc drift~~: `messaging.md` §7 and the service docs (now `apps/resource/README.md`) list `resource.report.created` and `resource.blog-comment.created`.
