# Resource community flows (forum, flash card copies and proposals)

The forum and the flash card copy / proposal ("fork / pull request") features of `apps/resource`, reached through `apps/gateway/src/resource-gateway/forum.router.controller.ts` and `apps/gateway/src/resource-gateway/flash-card-proposal.router.controller.ts`, plus the `apps/notification` consumers of the events they emit. Tables and the service overview are in [services-and-data.md, resource](../services-and-data.md#resource-appsresource) and [notification](../services-and-data.md#notification-appsnotification). Outbox, inbox and retry queues are described once in [messaging.md](../messaging.md); the requester pattern in [authorization.md section 6](../authorization.md#6-requester-pattern-authorization-in-the-owning-service).

Common to every route below:

- Path prefix: global `api` (`apps/gateway/src/bootstrap.ts:23`) + URI version `v1` + `/resources` (`apps/gateway/src/router.module.ts:44`) + controller path (`forum` or none).
- No route is `@IsPublic()`: reading the forum also needs a valid JWT. The global `ThrottlerGuard` applies its default per-route budget (`default` 100/min per IP + account, `apps/gateway/src/throttle.ts`); no route here overrides it.
- The gRPC client is the `RESOURCE_CLIENT` `ErrorHandlingGrpcProxy` (`apps/gateway/src/resource-gateway/resource.router.module.ts`); service errors come back as the matching HTTP status through the shared filters.
- `requesterOf(req.user, ROLES)` (`apps/gateway/src/auth/functions/requester.ts`) adds `requesterId = sub` and `privileged`. Forum: `FORUM_MODERATOR_ROLES = [Mod, Admin]`. Copies and proposals: `FLASH_CARD_ADMIN_ROLES = [Admin]`. On the service side `toRequester` (`apps/resource/src/presentation/dtos/req/requester.req.dto.ts`) turns it into `{ id, privileged }`.
- Pagination (`page`, `limit`) uses `PageQueryDto` in the gateway (`page >= 1`, `1 <= limit <= 100`) and `toSkipTake` in the service (default `limit` 10, `apps/resource/src/app/types/pagination.ts`).
- Responses are serialized with `@SerializeOptions({ type: X, strategy: 'exposeAll' })` in both the gateway and the service.

## Contents

| Operation                                                                                                     | Access                                              | Writes                                                    | Events                                                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [GET /forum/categories](#get-apiv1resourcesforumcategories)                                                   | authenticated                                       | -                                                         | -                                                                               |
| [GET /forum/categories/:categoryId](#get-apiv1resourcesforumcategoriescategoryid)                             | authenticated                                       | -                                                         | -                                                                               |
| [GET /forum/categories/:categoryId/threads](#get-apiv1resourcesforumcategoriescategoryidthreads)              | authenticated                                       | -                                                         | -                                                                               |
| [POST /forum/categories/:categoryId/threads](#post-apiv1resourcesforumcategoriescategoryidthreads)            | requester; mods only in `moderatorsOnly` categories | `ForumThread`                                             | -                                                                               |
| [GET /forum/threads/:threadId](#get-apiv1resourcesforumthreadsthreadid)                                       | authenticated                                       | `ForumThread.viewCount`                                   | -                                                                               |
| [PATCH /forum/threads/:threadId](#patch-apiv1resourcesforumthreadsthreadid)                                   | requester; author only                              | `ForumThread`                                             | -                                                                               |
| [PATCH /forum/threads/:threadId/moderation](#patch-apiv1resourcesforumthreadsthreadidmoderation)              | `@HasRoles(Mod, Admin)` + requester                 | `ForumThread.isPinned/isLocked`                           | -                                                                               |
| [DELETE /forum/threads/:threadId](#delete-apiv1resourcesforumthreadsthreadid)                                 | requester; author or mod                            | `ForumThread` (cascade `ForumReply`)                      | -                                                                               |
| [GET /forum/threads/:threadId/replies](#get-apiv1resourcesforumthreadsthreadidreplies)                        | authenticated                                       | -                                                         | -                                                                               |
| [POST /forum/threads/:threadId/replies](#post-apiv1resourcesforumthreadsthreadidreplies)                      | requester; mods only if locked                      | `ForumReply`, `ForumThread` counters, outbox              | `resource.forum-reply.created`                                                  |
| [PATCH /forum/replies/:replyId](#patch-apiv1resourcesforumrepliesreplyid)                                     | requester; author only, mods if locked              | `ForumReply`                                              | -                                                                               |
| [DELETE /forum/replies/:replyId](#delete-apiv1resourcesforumrepliesreplyid)                                   | requester; author or mod                            | `ForumReply`, `ForumThread` counters                      | -                                                                               |
| [POST /flash-card-lists/:id/fork](#post-apiv1resourcesflash-card-listsidfork)                                 | requester (admin)                                   | `FlashCardList`, `FlashCard`, outbox                      | `resource.resource.created` per card                                            |
| [GET /flash-card-lists/:id/diff](#get-apiv1resourcesflash-card-listsiddiff)                                   | requester; copy owner                               | -                                                         | -                                                                               |
| [POST /flash-card-lists/:id/pull](#post-apiv1resourcesflash-card-listsidpull)                                 | requester; copy owner                               | `FlashCardList.forkSyncedAt`, `FlashCard`, outbox         | `resource.resource.created` / `.deleted` per card                               |
| [POST /flash-card-lists/:id/proposals](#post-apiv1resourcesflash-card-listsidproposals)                       | requester; copy owner                               | `FlashCardListProposal`, outbox                           | `resource.flashcard-proposal.created`                                           |
| [GET /flash-card-proposals](#get-apiv1resourcesflash-card-proposals)                                          | requester; own / received, admin all                | -                                                         | -                                                                               |
| [GET /flash-card-proposals/:proposalId](#get-apiv1resourcesflash-card-proposalsproposalid)                    | requester; proposer, target owner, admin            | -                                                         | -                                                                               |
| [POST /flash-card-proposals/:proposalId/accept](#post-apiv1resourcesflash-card-proposalsproposalidaccept)     | requester; target owner or admin                    | `FlashCardListProposal`, `FlashCard` (both lists), outbox | `resource.flashcard-proposal.decided`, `resource.resource.created` / `.deleted` |
| [POST /flash-card-proposals/:proposalId/reject](#post-apiv1resourcesflash-card-proposalsproposalidreject)     | requester; target owner or admin                    | `FlashCardListProposal`, outbox                           | `resource.flashcard-proposal.decided`                                           |
| [POST /flash-card-proposals/:proposalId/withdraw](#post-apiv1resourcesflash-card-proposalsproposalidwithdraw) | requester; proposer only                            | `FlashCardListProposal`                                   | -                                                                               |

All paths in the table are relative to `/api/v1/resources`.

## Forum

Service: `ForumService` (`apps/resource/src/app/services/forum.service.ts`), called one-to-one from `ForumController` (`apps/resource/src/presentation/controllers/forum.controller.ts`, gRPC `resource.ForumService`). Models (`apps/resource/prisma/schema/forum.prisma`): `ForumCategory` (`forum_categories`, string id, `moderatorsOnly`), `ForumThread` (`forum_threads`, denormalised `replyCount`, `viewCount`, `lastActivityAt`, `lastReplyAuthorId`, `editedAt`; category `onDelete: Restrict`), `ForumReply` (`forum_replies`, flat, optional `quotedReplyId` → same table `onDelete: SetNull`; thread `onDelete: Cascade`).

Rules decided in the service: only the author edits a thread or reply; the author or a moderator deletes; anyone else gets **404**. Only moderators pin/lock, open threads in `moderatorsOnly` categories, and write in a locked thread (`assertWritable`, `forum.service.ts:178`, **403** `This thread is locked`). Moderators cannot edit other people's posts. Text fields are trimmed and an all-whitespace value is **400** (`requireText`, `forum.service.ts:61`).

Categories have no write API: they come from the seed (`apps/resource/prisma/seed.ts` `seedForum`, data in `apps/resource/prisma/seed/forum.ts`; `thong-bao` is `moderatorsOnly`).

Read-model mapping: `toSummary` (list rows, `excerpt` = `toExcerpt(body)` 160 chars, `apps/resource/src/domain/text/excerpt.ts`), `toThread` (full body + `categoryName`), `toReply` (with `position` and `quotedReply { id, authorId, excerpt(200) }`). Replies are ordered `createdAt asc, id asc`; a reply's `position` is 1-based in that order (`positionOf`, `forum.service.ts:143`, a `count` of earlier replies).

### GET /api/v1/resources/forum/categories

Lists categories ordered `position, name`, each with `threadCount`, `replyCount` (one `groupBy` on `ForumThread` summing `replyCount`) and `latestThread` (one `findFirst` per category by `lastActivityAt desc`). `ForumService.listCategories` / `withStats` (`forum.service.ts:186-235`). gRPC `ForumService/ListForumCategories`; response `ListForumCategoriesDto`.

### GET /api/v1/resources/forum/categories/:categoryId

Same shape for one category (`getCategory`, `forum.service.ts:193`); **404** `Category not found`. Response `ForumCategoryDto`.

### GET /api/v1/resources/forum/categories/:categoryId/threads

Query `ListForumThreadsQueryDto`: `page`, `limit`, `search` (max 200, case-insensitive `contains` on `title`). `listThreads` (`forum.service.ts:239`): 404 if the category does not exist, then `findMany` ordered `isPinned desc, lastActivityAt desc, id desc` (matches the `(categoryId, isPinned, lastActivityAt)` index) plus `count`. Response `ListForumThreadsDto { threads: summary[], totalCount }`.

### POST /api/v1/resources/forum/categories/:categoryId/threads

- **Access**: `requesterOf(user, [Mod, Admin])`; `privileged` required in a `moderatorsOnly` category.
- **Flow**:
  1. Gateway `CreateForumThreadDto`: `title` (non-empty, max 200), `body` (Markdown, non-empty, max 20000). gRPC `ForumService/CreateForumThread` with `categoryId` from the path.
  2. `createThread` (`forum.service.ts:261`): load category (404), check `moderatorsOnly` (403), create `ForumThread` with `authorId = requesterId`, trimmed title/body. Single insert, no `@Transactional`.
- **Async**: none (thread creation publishes nothing; no ownership row in authorization).
- **Errors**: 404 category, 403 moderators-only category, 400 empty text. Response `ForumThreadDto`.

### GET /api/v1/resources/forum/threads/:threadId

`getThread` (`forum.service.ts:286`): `updateMany { where: { id }, viewCount: increment 1 }` (count 0 → 404), then reload the thread with its category (gone by then → 404). Every GET counts, including the author's and repeated reads; no per-user dedupe. Response `ForumThreadDto`.

### PATCH /api/v1/resources/forum/threads/:threadId

- **Access**: requester; author only.
- **Flow**:
  1. Gateway `UpdateForumThreadDto`: optional `title` (max 200), `body` (max 20000), each non-empty if present.
  2. `updateThread` (`forum.service.ts:296`): `findOwnThread` (404 if missing or not the author's), `assertWritable` (403 if locked and not a moderator), 400 `Nothing to update` if both fields absent, then update with `editedAt = now()`.
- **Errors**: 404 (not yours), 403 locked, 400. Response `ForumThreadDto`.

### PATCH /api/v1/resources/forum/threads/:threadId/moderation

- **Access**: `@HasRoles(Mod, Admin)` in the gateway (403 before any gRPC call), and the service re-checks `privileged` (403 `Only moderators can do this`).
- **Flow**: `ModerateForumThreadDto { isPinned?, isLocked? }` (booleans). `moderateThread` (`forum.service.ts:318`): `findThread` (404), update the two flags (an absent field is left unchanged; both absent is 400 `Nothing to update`, checked before the lookup).
- Response `ForumThreadDto`. No event, no notification to the thread author.

### DELETE /api/v1/resources/forum/threads/:threadId

`deleteThread` (`forum.service.ts:333`): `findThread` (404), 404 unless author or moderator, then `delete` (DB cascade removes its replies). Allowed on locked threads. Response `data: null` (`@ApiEmptyResponseEntity`). No event.

### GET /api/v1/resources/forum/threads/:threadId/replies

Query `PageQueryDto`. `listReplies` (`forum.service.ts:343`): 404 if the thread is missing, then `findMany` (oldest first, `include quotedReply`) and `count`. Positions are computed as `skip + i + 1`, so they match `positionOf`. Response `ListForumRepliesDto { replies, totalCount }`. Does not count a view.

### POST /api/v1/resources/forum/threads/:threadId/replies

- **Access**: requester; anyone signed in, moderators only if the thread is locked.
- **Flow**:
  1. Gateway `CreateForumReplyDto`: `body` (non-empty, max 20000), optional `quotedReplyId`. gRPC `ForumService/CreateForumReply`.
  2. `createReply` (`forum.service.ts:364`), `@Transactional()`:
     1. `findThread` (404), `assertWritable` (403 locked).
     2. If `quotedReplyId`: `findFirst` reply with that id **in the same thread** (404 `Quoted reply not found` otherwise); remember its `authorId`.
     3. Insert `ForumReply` (trimmed body, `quotedReplyId`).
     4. Update the thread: `replyCount + 1`, `lastActivityAt = reply.createdAt`, `lastReplyAuthorId = requester`.
     5. `positionOf(created)`.
     6. `ResourceEventsPublisher.forumReplyCreated` (`apps/resource/src/app/events/resource-events.publisher.ts:123`) → `outbox.add('resource.forum-reply.created', …)`, enveloped, same transaction. Payload `{ replyId, threadId, threadTitle, threadAuthorId, authorId, quotedAuthorId | null, excerpt (120 chars), position }`.
- **Async**: `resource.forum-reply.created` → queue `notification.events.forum-reply.created` → [ForumReplyCreatedHandler](#resourceforum-replycreated) (inbox yes): notifies the quoted author and the thread author, subject to preferences.
- **Errors**: 404 thread / quoted reply, 403 locked, 400 empty body. Response `ForumReplyDto` (with `position`).

### PATCH /api/v1/resources/forum/replies/:replyId

`UpdateForumReplyDto { body }` (non-empty, max 20000). `updateReply` (`forum.service.ts:412`): `findReply` (with thread; 404), 404 unless author, `assertWritable(thread)` (403 locked), update `body` + `editedAt`, return with recomputed `position`. No `@Transactional`, no event. Response `ForumReplyDto`.

### DELETE /api/v1/resources/forum/replies/:replyId

- **Flow**: `deleteReply` (`forum.service.ts:430`), `@Transactional()`: `findReply` (404), 404 unless author or moderator; delete the reply (replies quoting it get `quotedReplyId = null` by the FK); recount the thread's replies and reload the latest one, then set `replyCount = count`, `lastActivityAt = latest.createdAt ?? thread.createdAt`, `lastReplyAuthorId = latest.authorId ?? null`.
- Allowed on locked threads. Response `data: null`. No event; a notification already sent for the reply stays and its link points at a missing anchor.

## Flash card copies

These three routes live on the proposal controller but call `resource.FlashCardListService` (`apps/resource/src/presentation/controllers/flashcard-list.controller.ts:73-90`) → `FlashcardForkService` (`apps/resource/src/app/services/flashcard-fork.service.ts`). Diff logic is pure domain code in `apps/resource/src/domain/flash-card-fork/list-diff.ts` (fields compared: `CARD_DIFF_FIELDS` = word, definition, partOfSpeech, pronunciation, examples, notes, tags; pulling also syncs `image`, `card-content.ts`). Empty string and null compare equal.

### POST /api/v1/resources/flash-card-lists/:id/fork

- **Access**: requester (`privileged` = Admin, unused by this method); the source must be public or the caller's own.
- **Flow** (`forkFlashCardList`, `flashcard-fork.service.ts:70`, `@Transactional()`):
  1. Load source list with cards (`createdAt asc`). 404 if missing or private and not yours; 400 `You cannot save a copy of your own list`.
  2. Pick a free name via `copyName` (`domain/flash-card-fork/copy-name.ts`) among the caller's lists starting with the source name.
  3. Create `FlashCardList` (private, same description/tags, `forkedFromId/Name/AuthorId`, `forkSyncedAt = now`).
  4. `copyCards`: `createMany` `FlashCard` rows owned by the caller with `originCardId` and `originSnapshot` (the merge base), `createdAt` spaced by 1 ms to keep order.
  5. One `resource.resource.created` (`resourceType: 'flashcard'`) outbox row per copied card. The list itself publishes nothing.
- **Async**: `resource.resource.created` → authorization ownership copy (see messaging.md section 7; not in this document's scope).
- Response `FlashCardListDto`.

### GET /api/v1/resources/flash-card-lists/:id/diff

`getFlashCardListDiff` (`flashcard-fork.service.ts:134`): `findForkWithOriginal` (404 unless the copy is yours; 400 `This list is not a copy of another list`; 404 `Original list not found` if the original was deleted or is no longer visible to you), `computeListDiff(forkCards, originalCards, forkSyncedAt)` → `added` (cards with no `originCardId`), `modified` (fields changed in the copy relative to its snapshot and still different from the original), `removed` (original cards that existed at the last sync and are missing from the copy). Also returns `openProposalId` if an `OPEN` proposal from this copy exists. Response `FlashCardListDiffDto`. Read only.

### POST /api/v1/resources/flash-card-lists/:id/pull

- **Flow** (`pullFlashCardListUpstream`, `flashcard-fork.service.ts:159`, `@Transactional()`, HTTP 200):
  1. `findForkWithOriginal` (as above); keep the old `forkSyncedAt`.
  2. Update `forkSyncedAt = now` first; the row lock serialises concurrent pulls of the same copy.
  3. Reload both lists and run `planUpstreamSync`: copied cards changed only upstream are overwritten (snapshot moves too), cards changed on both sides are skipped, original cards created since the old sync are copied in (`copyCards`, emits `resource.resource.created` each), unchanged copies of cards the original deleted are removed (`deleteMany` + one `resource.resource.deleted` each).
- Response `PullFlashCardListUpstreamDto { updated, added, removed, skipped }`.

## Flash card proposals

Service: `FlashcardProposalService` (`apps/resource/src/app/services/flashcard-proposal.service.ts`) behind `FlashcardProposalController` (`apps/resource/src/presentation/controllers/flashcard-proposal.controller.ts`, gRPC `resource.FlashCardProposalService`). Model `FlashCardListProposal` (`flash_card_list_proposals`): `sourceListId?` (copy, set null on delete), `targetListId` (original, cascade), `status` `OPEN | ACCEPTED | REJECTED | WITHDRAWN` (`FlashCardProposalStatus` in `@server/typing`), `changes` JSON snapshot validated on read by zod (`parseListChanges`, `domain/flash-card-fork/proposal-changes.ts`; a malformed row makes the read throw).

Visibility (`visibleProposalsWhere`, `flashcard-proposal.service.ts:56`): the proposer, the target list's owner, or `privileged` (Admin). Anything else is **404**. Deciding (`canDecide`): target owner or admin; withdrawing: proposer only; a visible proposal you cannot act on is **403**. Closing goes through `close()` (`flashcard-proposal.service.ts:108`): `updateMany where { id, status: OPEN }`; `count = 0` → **409** `This proposal is no longer open`. That conditional update is the concurrency guard (no version column), so two concurrent decisions cannot both win.

### POST /api/v1/resources/flash-card-lists/:id/proposals

- **Access**: requester; `:id` must be the caller's copy.
- **Flow**:
  1. Gateway `CreateFlashCardProposalDto`: `title` (non-empty, max 200), optional `message` (max 5000). `sourceListId = :id`. gRPC `FlashCardProposalService/CreateFlashCardProposal`.
  2. `createFlashCardProposal` (`flashcard-proposal.service.ts:147`), `@Transactional()`:
     1. `forks.findForkWithOriginal` (404 / 400 as in the diff route).
     2. 400 if the original is the caller's own list; 400 `title must not be empty` if the trimmed title is empty.
     3. `SELECT … FROM flash_card_lists WHERE id = <copy> FOR UPDATE` locks the copy's row until commit, so concurrent creates for one copy run one after the other; then 409 `An open proposal already exists for this list` if an `OPEN` proposal with the same source and target exists.
     4. `diffOf` the pair; 400 `There are no changes to propose` if empty.
     5. Insert the proposal with `status OPEN`, trimmed title/message, `changes = toChangesJson(diff)` (modified/removed entries carry the original's `base` values for later conflict detection).
     6. `outbox.add('resource.flashcard-proposal.created', { proposalId, targetListId, targetListName, targetOwnerId, authorId, title })`, enveloped.
- **Async**: → queue `notification.events.flashcard-proposal.created` → [FlashCardProposalCreatedHandler](#resourceflashcard-proposalcreated) (inbox yes): notifies the list owner.
- Response `FlashCardProposalDto` (summary with `addedCount/modifiedCount/removedCount`).

### GET /api/v1/resources/flash-card-proposals

Query `ListFlashCardProposalsQueryDto`: `page`, `limit`, `targetListId`, `sourceListId`, `mine` (string → bool via `str2bool`; restricts to `authorId = requester`), `status` (enum). `listFlashCardProposals` (`flashcard-proposal.service.ts:193`): `AND [filters, visibility]`, ordered `createdAt desc`, plus `count`. Response `ListFlashCardProposalsDto { proposals, totalCount }`.

### GET /api/v1/resources/flash-card-proposals/:proposalId

`getFlashCardProposal` (`flashcard-proposal.service.ts:218`): `findVisible` (404). While `OPEN`, loads the target's current versions of the modified/removed cards (`currentCards`, restricted to `listId = targetListId`) and runs `evaluateChanges`: a modification conflicts when the owner changed one of its fields since the snapshot to something other than the proposed value; a removal conflicts when the card was edited at all; a card already deleted is flagged `targetMissing`. Closed proposals are returned without evaluation. Adds `conflictCount`, `canDecide`, `canWithdraw`. Response `FlashCardProposalDetailDto`.

### POST /api/v1/resources/flash-card-proposals/:proposalId/accept

- **Access**: requester; target owner or admin (403 `Only the list owner can accept this proposal` for the proposer).
- **Flow**:
  1. Gateway `AcceptFlashCardProposalDto`: optional `resolutions[] { targetCardId, apply: boolean }` (nested validation; gateway sends `[]` when absent), optional `decisionNote` (max 2000). HTTP 200.
  2. `acceptFlashCardProposal` (`flashcard-proposal.service.ts:246`), `@Transactional()`:
     1. `findVisible` (404), `canDecide` (403).
     2. `close(ACCEPTED)` (409 if not open); sets `decidedAt`, `decidedBy`, trimmed `decisionNote` or null.
     3. Re-evaluate the stored changes against the target's current cards. Any conflicting modified/removed card without a resolution → **409** `This proposal has unresolved conflicts` (the whole transaction, including the status change, rolls back). A change is applied when it does not conflict or its resolution is `apply: true`.
     4. Added cards: `FlashCard.create` in the target list owned by the **target owner** (content incl. `image` from the proposer's card); if the source copy still exists, link the proposer's card to the new one (`originCardId`, `originSnapshot`) so the copy no longer shows it as added. Then one `resource.resource.created` (`flashcard`, owner = target owner) per new card.
     5. Modified cards (skipped if the target card is gone): update the target card with only the proposal's changed `fields` merged over its current content (`withFields`); move the source card's `originSnapshot` to the merged content.
     6. Removed cards that still exist and should apply: `deleteMany` in the target list, then one `resource.resource.deleted` per id.
     7. `publishDecision` → `outbox.add('resource.flashcard-proposal.decided', { proposalId, targetListId, targetListName, authorId, title, status: 'ACCEPTED', decidedBy, decisionNote })`.
- **Async**: `resource.flashcard-proposal.decided` → [FlashCardProposalDecidedHandler](#resourceflashcard-proposaldecided) (inbox yes): notifies the proposer. `resource.resource.created/deleted` → authorization ownership (outside this scope).
- **Errors**: 404 not visible, 403 proposer, 409 not open / unresolved conflicts. Response `FlashCardProposalDto` (as closed).

### POST /api/v1/resources/flash-card-proposals/:proposalId/reject

`RejectFlashCardProposalDto { decisionNote? }` (max 2000), HTTP 200. `rejectFlashCardProposal` (`flashcard-proposal.service.ts:330`), `@Transactional()`: `findVisible` (404), `canDecide` (403), `close(REJECTED)` (409), then `resource.flashcard-proposal.decided` with `status: 'REJECTED'`. No card changes. Async: same consumer as accept. Response `FlashCardProposalDto`.

### POST /api/v1/resources/flash-card-proposals/:proposalId/withdraw

No body, HTTP 200. `withdrawFlashCardProposal` (`flashcard-proposal.service.ts:350`), `@Transactional()`: `findVisible` (404), 403 `Only the proposer can withdraw this proposal` (even for admins), `close(WITHDRAWN)` with no note (409 if not open; `decidedBy` = the proposer). **No event**: the owner's "proposal waiting for review" notification is not withdrawn or updated. Response `FlashCardProposalDto`.

## Background work

The resource service has no RabbitMQ consumers, BullMQ processors, cron or interval jobs of its own (no `@RabbitSubscribe`, `@Cron`, `@Interval` or `@Processor` in `apps/resource/src`). Its only background loop is the outbox relay (`MessagingModule.forRoot` with `relay: true` in `apps/resource/src/resource.module.ts`; 1 s poll, see [messaging.md section 4](../messaging.md#4-the-relay-outboxrelay)). The forum and proposal features have no socket.io or SSE endpoints; notifications created below are pushed over the notification SSE stream.

Notification consumers of the events above (all in `apps/notification/src/app/events/handlers/`, registered in `apps/notification/src/configs/rmq.sub.config.ts`). Each one uses `connection: 'sub'`, exchange `eventbus`, `@UseCls()` on `handle`, which calls a private `@Transactional()` `store`, `defineConsumerQueue` defaults (5 retries with 1-16 s back-off, then `<queue>.dlq`), `unwrapEvent`, `InboxService.claim(id, queue)` first, and `validatePayload` (class-validator) on the payload. Writes go to `notifications` (and `inbox_events`) through `NotificationService.createNotification` (`apps/notification/src/app/services/notification.service.ts`), which only stores; once `store` has returned (committed), `handle` calls `NotificationService.push` with the created notifications, which calls `NotificationSseService.emit` (in-process `EventEmitter2` event `notification.created`, delivered to open `GET /notifications/stream/:recipientId` SSE connections). The notification service publishes nothing.

### resource.forum-reply.created

- Queue `notification.events.forum-reply.created`; `ForumReplyCreatedHandler` (`forum-reply-created.handler.ts`); inbox yes.
- Recipients from `discussionRecipients(authorId, owner = { threadAuthorId, 'forumReply' }, replied = { quotedAuthorId, 'commentReply' })` (`discussion-recipients.ts`): the quoted author first (kind `replied`) unless they wrote the reply; then the thread author (kind `owner`) unless they wrote the reply or are the quoted author. So nobody is notified about their own reply, and a thread author quoted in their own thread gets one `replied` notification.
- Preference check per recipient: `NotificationPreferencesService.isEnabled(id, preference)` (`apps/notification/src/app/services/notification-preferences.service.ts:69`) reads `notification_preferences` by `identity_id`; no row = enabled. Thread author → `forumReplyEnabled`; quoted author → `commentReplyEnabled`.
- Notification: `type` `comment_reply` (quoted) or `forum_reply` (owner); Vietnamese title; message `Trong chủ đề "<threadTitle>": <excerpt>`; `data { threadId, replyId, action }` where `action = /forum/thread/<threadId>[?page=N]#reply-<replyId>` with `N = ceil(position / 20)` (`REPLIES_PER_PAGE = 20`, copied from the frontend).

### resource.flashcard-proposal.created

- Queue `notification.events.flashcard-proposal.created`; `FlashCardProposalCreatedHandler` (`flashcard-proposal-created.handler.ts`); inbox yes.
- Skips when `targetOwnerId === authorId`. No preference check (there is no flash card preference).
- Notification to `targetOwnerId`: `type: 'flashcard'`, title `Có đề xuất thay đổi cho bộ thẻ của bạn`, `data { proposalId, listId, action: /flashcards/<targetListId>/proposals/<proposalId> }`.

### resource.flashcard-proposal.decided

- Queue `notification.events.flashcard-proposal.decided`; `FlashCardProposalDecidedHandler` (`flashcard-proposal-decided.handler.ts`); inbox yes.
- `proposalDecisionText` builds accepted / rejected text (appends `Ghi chú: <note>` if a note was given); any other status returns null and the event is dropped. Also skipped when `decidedBy === authorId`. No preference check.
- Notification to the proposer (`authorId`): `type: 'flashcard'`, `data { proposalId, listId, status, action }` (same path as above).

## Findings

- `apps/notification/src/app/events/handlers/forum-reply-created.handler.ts:62`: a forum quote notification is gated by the `commentReply` preference and typed `comment_reply`, the same switch and type as blog comment replies, so users cannot mute forum quotes separately from blog replies (may be intentional): backlog X4 (Decision).
- `apps/notification/src/app/events/handlers/flashcard-proposal-created.handler.ts` and `flashcard-proposal-decided.handler.ts`: proposal notifications skip the preference check entirely; `OptionalNotificationType` (`apps/notification/src/app/types/notification.input.ts`) has no flash card entry, so they cannot be turned off: backlog X5 (needs a column, proto field and a frontend switch).
- ~~The SSE push happened inside the consumer's transaction, before the commit~~: fixed, pushed after the commit (see fixed-issues.md).
- `apps/notification/src/app/events/handlers/forum-reply-created.handler.ts:17`: the notification link's page number assumes 20 replies per page (a constant copied from the frontend), while the gateway's default `limit` is 10; a frontend change silently breaks the deep links: backlog X6 (the frontend does use 20 today, so the links are right for now).
- ~~A whitespace-only proposal title is stored as empty~~: fixed (see fixed-issues.md; 400).
- ~~Withdrawing publishes no event~~: backlog X5 (needs a notification consumer before resource may publish it).
- ~~"One open proposal per copy" is a read-then-insert check~~: fixed (see fixed-issues.md; the copy's row is locked first, no schema change).
- ~~Accepted added cards copy the proposer's `image`~~: not a bug (`image` is a free URL string the frontend shows only when it starts with `http(s)://`, not a file-service id; cards never reference-count it).
- ~~`getThread` throws P2025 when the thread is deleted mid-read~~: fixed (see fixed-issues.md; 404). The missing per-user view dedupe is backlog X6.
- ~~Moderation accepts an empty body~~: fixed (see fixed-issues.md; 400 `Nothing to update`).
