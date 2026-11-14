# Fixed issues

What was fixed from [`backlog.md`](backlog.md), and how. Newest first. Each entry says what was wrong, what changed (files), what it means for running systems, and how it is tested. The backlog row is deleted in the same commit as the fix.

## Findings from the flow docs (November 2026)

The candidate issues listed under "Findings" in `docs/architecture/flows/` were re-checked one by one; the real ones are fixed below, the ones that need a decision are in the backlog (S21+, C23+), and each flows page marks what happened to every finding.

### Auth

#### Google login token exchange was GET then DEL

- **Problem:** `POST /auth/google/tokens` read `oauth2:google:loginToken:<t>` with `GET` and deleted it afterwards, so two concurrent exchanges of one token could both get session cookies.
- **Fix:** a single `GETDEL` is the single-use gate (`apps/gateway/src/auth-gateway/auth.router.controller.ts`). Redis 7.4 (redis-stack 7.4.0) supports it (needs >= 6.2).
- **Tests:** `apps/gateway/src/test/auth-gateway/google-oauth.spec.ts` ("login token exchange": a second exchange is 401; two concurrent exchanges, only one gets cookies), `apps/gateway/src/test/auth-gateway/auth-cookies.spec.ts` (switched to `getdel`).

#### Removing the last credential was 405, so HTTP 499

- **Problem:** `Identity.deleteCredential` threw `MethodNotAllowedException`, which the RPC filter maps to gRPC CANCELLED and the gateway to 499.
- **Fix:** `ConflictException` (409) (`apps/auth/src/domain/entities/identity.entity.ts`).
- **Tests:** `apps/auth/src/test/domain/entities/identity.entity.spec.ts` ("Identity.deleteCredential").

#### Optimistic-version miss and unknown roleId surfaced as 502

- **Problem:** `IdentityPrismaRepositoryImpl.save` let Prisma P2025 (the `version` filter matched no row: a concurrent save won) through as a raw error (502), and `POST /:id/roles` with an unknown `roleId` failed on the `identity_roles.role_id` FK (P2003, 502).
- **Fix:** P2025 on the identity update → 409 `Identity was changed concurrently, try again`; P2003 on the `IdentityRole` insert → 404 `Role not found` (`apps/auth/src/infra/repositories/identity.prisma.repository.impl.ts`). The malformed-cursor part of the finding is in the shared lib (backlog X3).
- **Tests:** `apps/auth/src/test/infra/repositories/identity.prisma.repository.impl.spec.ts`.

#### logout-all had no CookieIssuanceGuard

- **Problem:** `POST /auth/logout-all` clears the session cookies but, unlike the other cookie routes, was not behind `CookieIssuanceGuard` (forced-logout CSRF, limited by SameSite=Lax).
- **Fix:** `@UseGuards(CookieIssuanceGuard)` (`apps/gateway/src/auth-gateway/auth.router.controller.ts`).
- **Tests:** `apps/gateway/src/test/auth-gateway/auth.router.controller.spec.ts` (every cookie-setting/clearing route carries the guard).

#### Phone search took loose query params; no upper bound on search limits

- **Problem:** `GET /auth/identity/search/phone` used individual `@Query()` params: `limit` unbounded and unvalidated, and a missing `phoneNumber` arrived as `''`, which `contains` matched against every identity. `identity-ids`, `identities-public` and `identities` had no `@Max` on `limit`.
- **Fix:** new gateway `FindIdentitiesByPhoneDto` (`phoneNumber` required and non-empty, `limit` 1-100) (`apps/gateway/src/auth-gateway/dtos/req/find-identities-by-phone.req.dto.ts`); service DTO also rejects an empty `phoneNumber` and bounds `limit` (`apps/auth/src/presentation/dtos/req/find-identities-by-phone.req.dto.ts`); `@Max(100)` on `FindIdentitiesDto`, `FindIdentitiesLimitedDto`, `FindIdentityIdsDto` (gateway).
- **Tests:** covered by build/lint (DTO decorators only); repository filter test below.
- **Running systems:** a frontend asking for `limit` > 100 on these routes now gets 400.

#### Soft-deleted identities appeared in search

- **Problem:** `findIdentities`, `findIdentityIds` and `findIdentitiesByPhone` had no `deletedAt` filter, so soft-deleted identities showed up in public and admin search (they cannot be managed anyway: `findOneById` skips them).
- **Fix:** `deletedAt: null` in all three (`apps/auth/src/infra/repositories/identity.read.prisma.repository.impl.ts`). Hydration is unchanged (backlog X4).
- **Tests:** `apps/auth/src/test/infra/repositories/identity.read.prisma.repository.impl.spec.ts`.

#### Password change logged the caller out without telling the client

- **Problem:** `UpdatePasswordCommandHandler` revokes every token of the identity, including the caller's, but the gateway answered success and left the dead cookies, so the next call was a bare 401.
- **Fix:**
  - The gateway route (`apps/gateway/src/auth-gateway/auth.router.controller.ts`, `updateMailPassword`) waits for the change, then calls the existing `Refresh({ identityId })` RPC and sets fresh cookies, so the browser that changed the password stays signed in; every other session stays revoked. If issuing fails (e.g. account locked meanwhile), it clears the cookies instead. A refused change (wrong password, demo) touches no cookies. The route now carries `CookieIssuanceGuard`. No proto change.
  - `TokenService` (`apps/auth/src/app/services/token.service.ts`) dates new tokens at least 1 ms after the stored revocation (`issueTimeMs`), so a token issued in the same millisecond as the revoke (possible with a sub-ms gRPC round trip) is not caught by `iatMs <= revokedAt`. One extra Redis `GET` per token issuance.
- **Tests:** `apps/gateway/src/test/auth-gateway/auth.router.controller.spec.ts` (fresh cookies after the change; cleared when refresh fails; untouched on a refused change), `apps/auth/src/test/app/commands/handlers/token-issuance.spec.ts` ("a token issued in the same millisecond as the revoke outlives it", "dates tokens now when nothing was revoked").

#### Passwords were hashed with bcrypt.hashSync

- **Problem:** `Credential` hashed in its constructor/`update` with `bcrypt.hashSync` (cost 10), blocking auth's event loop for every register, add-mail-credential and password change.
- **Fix:** `Credential.hashSecret` (async `bcrypt.hash`, cost 10); the entity now only stores hashes (the `isHashed` flag is gone). `MailRegisterCommandHandler`, `AddMailCredCommandHandler` and `UpdatePasswordCommandHandler` hash first and pass the hash (`apps/auth/src/domain/entities/credential.entity.ts`, the three handlers, `identity.prisma.repository.impl.ts`). Existing hashes are unchanged.
- **Tests:** `apps/auth/src/test/domain/entities/credential.entity.spec.ts`, `apps/auth/src/test/app/commands/handlers/update-password.handler.spec.ts` (stores a bcrypt hash of the new password).

#### Username had no length or blank check

- **Problem:** `RegisterMailDto.username` and `UpdateIdentityDto.username` (gateway and service) were only `@IsString()`, so `''`, whitespace or very long usernames were accepted on register.
- **Fix:** register: not blank (`@Matches(/\S/)`), max 50. Update: max 50 and not whitespace-only; `''` is still accepted because `updateDetails` already treats it as "unchanged" and a frontend may send it. 50 covers every generated username (Google sign-up: max 30, or a 36-char UUID fallback). Files: `apps/gateway/src/auth-gateway/dtos/req/{register-mail,update-identity}.req.dto.ts`, `apps/auth/src/presentation/dtos/req/{register-mail,update-identity}.req.dto.ts`.
- **Tests:** DTO decorators only (lint/build).
- **Running systems:** an existing username longer than 50 characters, re-sent unchanged on a profile update, would now be 400 (none is generated that long; only a hand-chosen mail-register username could be).

#### oauth2_state cookie: no Secure in production, never cleared

- **Problem:** the linking-flow `oauth2_state` cookie set `secure` only from `req.secure`/`X-Forwarded-Proto`, ignoring `env === 'production'` (unlike the session cookies), and stayed until its 300 s expiry after the callback had consumed the nonce.
- **Fix:** `GoogleOAuth2BaseGuard.stateCookieOptions` uses the session-cookie rule; `GoogleOAuth2CallbackGuard` clears the cookie (same path/options) once the linking state is consumed (`apps/gateway/src/auth/guards/google-oauth2.guard.ts`). Not cleared when the cookie doesn't match (someone else's request must not affect it).
- **Tests:** `apps/gateway/src/test/auth-gateway/google-oauth.spec.ts` ("the state cookie is Secure in production", "linking with the matching cookie" now also checks the clearing Set-Cookie; the existing Google login/linking cases still pass).

### Exam

#### Exam: expected conflicts reached clients as 499 or 502 (findings 1 and 13)

- **Problem:** `MethodNotAllowedException` (starting an attempt on an unapproved exam, starting a second attempt while one is unfinished, moving a tag into its own subtree) is mapped to gRPC `CANCELLED` and reached clients as 499. Expected Prisma/PG errors are not `HttpException`s and reached clients as 502: a stale `exams.version` (P2025), a duplicate tag name (P2002), renaming an unknown tag (P2025), a second `POST goals/my` (P2002), `PATCH`/`DELETE goals/my` with no goal (P2025), and a section moved under its own descendant (closure trigger `RAISE EXCEPTION`). Starting an attempt read the last finished `order` outside its transaction, and the loser of two concurrent starts got 499.
- **Fix:**
  - New `apps/exam/src/infra/repositories/prisma-errors.ts`: `translatePrismaErrors(run, { P2002: …, P2025: … })` and `guardExamVersion` (P2025 on a versioned write → 409 `ExamVersionConflictException`), applied only around the write in question.
  - Stale exam version → 409 in `exam`, `section`, `question` `*.prisma.repository.impl.ts` (the versioned update and the versioned delete).
  - Tags (`tag.prisma.repository.impl.ts`): duplicate name → 409 (create and rename), unknown tag on rename → 404, tag into its own subtree → 400.
  - Goals (`goal.prisma.repository.impl.ts`): second goal → 409, update/delete of a missing goal → 404.
  - Unapproved exam on attempt start → 409 (`domain/entities/exam.entity.ts`).
  - Section cycle: `MoveSectionHandler` checks `ISectionRepository.isInSubtreeOf` (over `section_closures`) first and answers 400; the trigger stays as a backstop.
  - Attempt start (`attempt.prisma.repository.impl.ts`): the last-finished read and the insert run in one transaction; the insert is `createMany … skipDuplicates` (`ON CONFLICT DO NOTHING`, so the transaction is not aborted); on a collision the order is read once more (in case the attempt holding it was just submitted) and otherwise it throws `UnfinishedAttemptExistsException` (409 `Please submit the previous attempt`).
- **Tests:** `apps/exam/src/test/infra/repositories/prisma-errors.spec.ts` (helper, goals, tags, attempt start incl. concurrent loser and retry, stale exam version), `apps/exam/src/test/app/commands/handlers/management/move-section.handler.spec.ts`.
- **Running systems:** clients that matched 499/502 for these cases now see 409/404/400 (the frontend, a separate repo, may want to check its handling of "Please submit the previous attempt", now 409).

#### Exam: flags and notes skipped the attempt checks (finding 3)

- **Problem:** `Attempt.toggleFlag` and `Attempt.addNote` skipped the submitted, expiry and question-in-attempt checks that `answer` applies, so flags/notes changed after submit or after the time limit, and an unknown question id failed on the `attempt_responses.question_id` FK (502).
- **Fix:** both call `assertModifiable` and the new `assertQuestionIncluded` (`apps/exam/src/domain/entities/attempt.entity.ts`): 409 once submitted, 403 after the time limit, 409 for a question outside the attempt.
- **Tests:** `apps/exam/src/test/domain/entities/attempt.entity.spec.ts` ("Attempt flags and notes").

#### Exam: fractional goal targets failed with 502 (finding 2)

- **Problem:** `goals.target` is `Int` and the proto field is `Int32Value`, but both `SetGoalDto`/`UpdateGoalDto` (gateway and exam) accepted any number, so an IELTS target of 6.5 failed as 502.
- **Fix:** `target` is `@IsInt() @Min(0) @Max(990)` in `apps/gateway/src/exam-gateway/dtos/req/goal/{set,update}-goal.req.dto.ts` and `apps/exam/src/presentation/dtos/req/goal/{set,update}-goal.req.dto.ts` (400). No migration, no proto change. Half bands are backlog X1.
- **Tests:** validation decorators only (no new spec).

#### Exam: the writing scorer got a target from another test's goal (finding 6)

- **Problem:** `WritingSubmittedPublisher` sent `target_score = goals.target` whatever the goal's `type`, so a TOEIC 800 goal was sent as the target of an IELTS essay.
- **Fix:** `examMatchesGoalType` (`apps/exam/src/app/events/publishers/writing-submitted.ts`): the target is sent only when one of the exam's tags equals the goal type or starts with it plus a space (`IELTS`, `IELTS Writing T1-T2`), case-insensitively; otherwise 0. `exam_type`/`task_type` keep the comma-joined format the AI worker parses.
- **Tests:** `apps/exam/src/test/app/events/publishers/writing-submitted.spec.ts`.

#### Exam: unbounded list `limit` (finding 9)

- **Problem:** `limit` had no maximum on `GET /exams/management/exams`, `GET /exams/practice` and `GET /exams/practice/my/history` (and none was positive-checked on the management list), at the gateway or in exam.
- **Fix:** `@IsPositive() @Max(100)` on `limit` in the gateway DTOs (`apps/gateway/src/exam-gateway/dtos/req/management/find-exams.req.dto.ts`, `practice/find-exams.req.dto.ts`, `practice/get-users-attempt-history.req.dto.ts`, OpenAPI `minimum`/`maximum`) and the matching exam DTOs (`apps/exam/src/presentation/dtos/req/{management/find-exams,practice/find-exams,practice/get-users-attempt-history}.req.dto.ts`).
- **Tests:** validation decorators only.
- **Running systems:** a client asking for more than 100 rows now gets 400. Check that the frontend never sends `limit > 100` on these routes before deploying.

#### Exam: no-op in-process event publishing (finding 11)

- **Problem:** `UpdateExamHandler`, `AttemptHandler` and `EndAttemptHandler` called `EventBus.publishAll` with no CQRS event handler registered (scoring is a RabbitMQ consumer of the outbox's `exam.attempt.submitted`), which did nothing.
- **Fix:** the calls and the `EventBus` injections are removed (`apps/exam/src/app/commands/handlers/{management/update-exam,practice/attempt,practice/end-attempt}.handler.ts`).
- **Tests:** `apps/exam/src/test/app/commands/handlers/practice/end-attempt.handler.spec.ts` (updated).

### Resource

#### Blog and flash card list updates could not clear their tags

- **Problem:** an empty `tags` array meant "keep the old value", and the gateway turns a missing field into `[]`, so a client could never clear a blog's or a list's tags. Flash cards were already fixed in 2017ccb with `replace_examples`/`replace_tags`.
- **Fix:** the same pattern. `proto/resource.proto` adds `bool replace_tags` to `UpdateBlogRequest` (5) and `UpdateFlashCardListRequest` (8), regenerated `libs/generated/src/resource.ts`. The gateway (`apps/gateway/src/resource-gateway/resource.router.controller.ts`) sets it when the body has `tags`. `BlogService.updateBlog` and `FlashcardListService.updateFlashCardList` replace the tags when it is set, even with `[]`. Files: `apps/resource/src/app/services/{blog,flashcard-list}.service.ts`, `app/types/{blog,flash-card-list}.input.ts`, `presentation/dtos/req/update-{blog,flash-card-list}.req.dto.ts`.
- **Tests:** `apps/resource/src/test/app/services/blog.service.spec.ts` ("updateBlog tags"), `flashcard-list.service.spec.ts` ("clears the tags only when the request sets them").
- **Running systems:** proto change (additive). Deploy gateway and resource together. An old gateway sends `false`, which keeps the old behaviour.

#### Report status was any string

- **Problem:** both `UpdateReportDto`s took any string, so a typo created a new status and the notification fell back to the raw value.
- **Fix:** new enum `ReportStatus` with the lowercase values the frontend (`pending`, `reviewing`, `resolved`, `rejected`) and notification (`in_progress`, `dismissed`, `closed` as well) already use: `apps/resource/src/enums/report-status.enum.ts`, mirrored in `apps/gateway/src/enums/report-status.enum.ts` (same approach as the gateway's `ExamStatus` mirror). `@IsEnum` in both DTOs, so an unknown value is a 400, with `enum` in the OpenAPI schema. The values are lowercase, not UPPER_CASE as AGENTS.md prefers, because stored rows and the column default (`pending`) are lowercase. Only writes are checked. Existing rows and the `ListReports` `status` filter are unchanged. The enum could move to `@server/typing` later (out of this scope).
- **Tests:** `apps/resource/src/test/app/services/report.service.spec.ts` uses the enum. The validation itself is declarative (`@IsEnum`).

#### `resolvedBy` was overwritten by every report update

- **Problem:** every PATCH set `resolvedBy` to the caller, even one that changed nothing.
- **Fix:** `ReportService.updateReport` sets `resolvedBy` to the caller only when the status or `adminResponse` actually changes. Otherwise it keeps the stored value. The frontend shows `resolvedBy` as the author of the admin response ("Phản hồi của …"), so a response-only edit does still move it. Whether a move back to `pending` should clear it is backlog X2.
- **Tests:** `report.service.spec.ts` ("keeps resolvedBy when an update changes neither status nor response").

#### Admins could not attach other people's files when creating a report

- **Problem:** `createReport` always checked the uploader, while `addFileToReport` lets admins skip it, and AGENTS.md says admins skip it on report attaches.
- **Fix:** `CreateReportRequest.may_attach_any_file` (8, optional BoolValue), set by the gateway to `hasAnyRole(user, [Admin])`, as on `AddFileToReport`. `ReportService.createReport` skips `assertOwnedBy` when it is set. Files: `proto/resource.proto`, the gateway controller, `presentation/dtos/req/create-report.req.dto.ts`, `app/types/report.input.ts`, `report.service.ts`.
- **Tests:** `report.service.spec.ts` ("lets admins attach files they did not upload on create").

#### The file-service gRPC call ran inside the open DB transaction

- **Problem:** `createReport` and `addFileToReport` called `CheckFilesOwnedBy` inside `@Transactional()`, so the DB transaction stayed open for a network round trip.
- **Fix:** both methods now run the uploader check first, outside any transaction. The write moved to a `@Transactional()` private method (`insertReport` / `attachFile`). `attachFile` re-runs `findVisibleReport` inside the transaction. `addFileToReport` still checks visibility before ownership, so an invisible report is still 404 before 403.
- **Tests:** `report.service.spec.ts` ("asks file-service before the transaction opens"). The existing ownership and reference tests still pass.

#### Whitespace-only proposal title was stored as empty

- **Problem:** `@IsNotEmpty()` accepts `"   "`, and `title.trim()` then stored `""`.
- **Fix:** `FlashcardProposalService.createFlashCardProposal` returns 400 `title must not be empty` when the trimmed title is empty.
- **Tests:** `apps/resource/src/test/app/services/flashcard-proposal.service.spec.ts` ("refuses a whitespace-only title").

#### Two concurrent proposal creates could both pass "one open proposal per copy"

- **Problem:** a read-then-insert check with no unique index.
- **Fix:** no schema change. Inside the create transaction, `SELECT id FROM flash_card_lists WHERE id = <copy> FOR UPDATE` runs before the check. Concurrent creates for the same copy queue on that row lock. Under READ COMMITTED, the second create then sees the first one's committed OPEN proposal and gets 409. File: `flashcard-proposal.service.ts`.
- **Tests:** `flashcard-proposal.service.spec.ts` ("locks the copy before checking for an open proposal").

#### Forum `getThread` returned 502 (P2025) for a thread deleted mid-read

- **Problem:** `findThread`, then a separate `update`. If the thread was deleted in between, `update` threw Prisma P2025.
- **Fix:** `updateMany({ where: { id }, viewCount: increment })` returns 404 when the count is 0, then a `findUnique` with the category returns 404 if the thread is gone by then. File: `forum.service.ts`.
- **Tests:** `apps/resource/src/test/app/services/forum.service.spec.ts` ("counts a view…", "404s when the thread is missing or deleted while being read").

#### Forum moderation accepted an empty body

- **Problem:** with neither `isPinned` nor `isLocked`, the request still made a no-op update (200).
- **Fix:** 400 `Nothing to update`, like the author edit route (`forum.service.ts` `moderateThread`).
- **Tests:** `forum.service.spec.ts` ("refuses a moderation request that changes nothing (400)").

#### Blog comment soft delete: the class comment was wrong

- **Problem:** the class comment said a soft delete clears "content and author", but `authorId` is kept.
- **Fix:** comment corrected in `apps/resource/src/app/services/blog-comment.service.ts`. Keeping `authorId` is intended: the column is required, and responses blank it.
- **Tests:** none (comment only).

### Live/notification

#### A chat ban without a reason failed with 400

- **Problem:** the gateway's `BanUserFromRoomDto.reason` is optional (proto `optional StringValue`), but live's `BanUserDto` required `@IsString() reason`. The ts-proto codec does not encode an unset optional wrapper, and the decoder leaves the field `undefined` (not `''`), so `POST /chat/rooms/:roomId/ban` without a reason was a 400 from live.
- **Fix:** `apps/live/src/app/presentation/dtos/req/ban-user.req.dto.ts` (`@IsOptional()`, `reason?`); `apps/live/src/app/presentation/controllers/chat.controller.ts` stores a missing reason as `''` (the `banneds.reason` column is `NOT NULL`).
- **Tests:** `apps/live/src/test/app/presentation/dtos/req/ban-user.req.dto.spec.ts`.

#### Chat log: newest first, cursors end, query DTO with a bounded limit

- **Problem:** `GET /chat/rooms/:roomId/logs` returned the oldest messages first (`orderBy createdAt asc`), so the frontend's first call (limit 50) got the room's first 50 messages, not the latest. Both cursors were always encoded, even for an empty page (`id: undefined`), so following `nextCursor` past the end restarted from the first page. The gateway route took individual `@Query` params with no DTO and no upper bound on `limit`.
- **Fix:**
  - `apps/live/src/app/infra/repositories/chat-log.read.prisma.repository.ts`: `orderBy [createdAt desc, id desc]`.
  - `apps/live/src/app/services/chat.service.ts` `getChatLogsOf`: fetches `limit + 1` rows to know whether another page exists (same logic as the room list) and returns `''` for a cursor that has no page.
  - `apps/gateway/src/live-gateway/dtos/req/get-chat-log.query.dto.ts` (new `GetChatLogQueryDto { uid?, cursor?, limit? }`, `limit` `@Type(Number) @IsInt @Min(1) @Max(100)`), used in `apps/gateway/src/live-gateway/live.router.controller.ts`; live's `GetChatLogDto.limit` also gets `@Max(100)`.
- **Exact semantics now (for the frontend check):** response shape unchanged, `{ chats: [{ id, uid, message, createdAt }], nextCursor, prevCursor }`. `chats` is **newest first**. The first page (no cursor) is the **latest `limit` messages** (default 10, max 100). `nextCursor` goes to **older** messages, `prevCursor` back to **newer** ones; each is `''` when that page does not exist (first page: `prevCursor: ''`; oldest page: `nextCursor: ''`; empty room: both `''`). `limit` above 100 or below 1, or non-integer, is now 400 at the gateway. The frontend (`src/components/ChatPage.tsx`) calls `getChatLog(room.id, undefined, undefined, 50)`, dedupes by id and sorts by time itself, so it now shows the latest 50; it never follows the cursors.
- **Tests:** `apps/live/src/test/app/services/chat.service.chat-log.spec.ts` (latest page first, paging older and back, empty room has no cursors, one extra row fetched).
- **Running systems:** API clients that relied on oldest-first order or on `limit > 100` change behaviour; old cursors issued before the deploy still decode (same fields) but now walk the new order.

#### Room delete/schedule on a missing or deleted room: 404 instead of 502, no duplicate `live.room.deleted`

- **Problem:** `RoomPrismaRepositoryImpl.removeRoom` updated by `id` with no `isDeleted: false`, so deleting a deleted room succeeded again and emitted a second `live.room.deleted`; an unknown id raised Prisma P2025, which reached the client as 502. `updateRoomSchedule` on a missing/deleted room was also P2025 → 502.
- **Fix:** `apps/live/src/app/infra/repositories/room.prisma.repository.ts`: `removeRoom` updates where `{ id, isDeleted: false }`; both methods map P2025 to `NotFoundException('Room not found')` (`notFoundIfMissing`). The delete transaction rolls back, so no event is written.
- **Tests:** `apps/live/src/test/app/infra/repositories/room.prisma.repository.spec.ts`.

#### Room delete emptied the socket.io room before the commit

- **Problem:** `ChatService.removeRoom` was `@Transactional()` and called `ChatGateway.closeRoom` between the update and the outbox insert, so a failing outbox insert or commit left a live room with its sockets already removed.
- **Fix:** `apps/live/src/app/services/chat.service.ts`: the update and outbox insert run in a private `@Transactional()` `deleteRoom`; `removeRoom` calls `closeRoom` only after it has returned (committed). Same split as exam's `EndAttemptHandler`.
- **Tests:** `apps/live/src/test/app/services/chat.service.remove-room.spec.ts`.

#### Notification SSE push happened before the consumer transaction committed

- **Problem:** `NotificationService.createNotification` emitted to SSE right after the insert, inside the consumer's `@Transactional()`. If a later step failed (e.g. the second admin's insert in `report-created`), the rows rolled back but the pushes had gone out, and the redelivery pushed them again.
- **Fix:** `apps/notification/src/app/services/notification.service.ts`: `createNotification` only stores; new `push(notifications)` emits. All seven consumers (`apps/notification/src/app/events/handlers/{achievement-earned,blog-comment-created,flashcard-proposal-created,flashcard-proposal-decided,forum-reply-created,report-created,report-status-changed}.handler.ts`) now have `handle` (`@UseCls()` + `@RabbitSubscribe`) call a private `@Transactional()` `store` that returns the created notifications, and push them after it returns. `apps/notification/src/presentation/controllers/notification.controller.ts` (admin create, no surrounding transaction) pushes after the insert. `@nestjs-cls/transactional` 3.3.1 has no after-commit hook, hence the split.
- **Tests:** `apps/notification/src/test/app/events/handlers/report-created.handler.spec.ts` (push once after all inserts; nothing pushed when a later insert fails), `apps/notification/src/test/app/services/notification.service.spec.ts` (store does not push; push emits per recipient); handler mocks in `discussion-notifications.spec.ts` and `flashcard-proposal.handlers.spec.ts` updated.

#### Notification's HTTP/SSE port allowed any CORS origin

- **Problem:** `apps/notification/src/bootstrap.ts` called `enableCors()` with no options (any origin) on the port serving `stream/:recipientId`, which trusts its path. Browsers never call this port: the gateway proxies the stream server-side after checking `recipientId === sub`. The upstream `Access-Control-Allow-Origin: *` was also copied onto the gateway's proxied response, overriding the gateway's credentialed CORS headers.
- **Fix:** `enableCors()` removed from `apps/notification/src/bootstrap.ts`.
- **Tests:** none (bootstrap only). Checked that the frontend never contacts the notification port (it does not use the SSE stream at all today).
- **Running systems:** nothing to do. Anything that called notification's HTTP port from a browser directly (nothing known) would now be refused by CORS.

### Achievement/file/authorization

#### Badges were not unique per user

- **Problem:** `onBadgeAdded` relies on `userBadge.createMany({ skipDuplicates: true })` and its `count === 0` to skip a badge already held and to announce `achievement.badge.earned` only once, but `user_badges` had only the `id` primary key, so nothing could conflict. Duplicates were prevented only by the in-memory badge set and the optimistic `version` check.
- **Fix:** `@@unique([uid, badgeName])` in `apps/achievement/prisma/schema/badge.prisma`; migration `apps/achievement/prisma/migrations/20261114120000_unique_user_badge/migration.sql` first deletes duplicate `(uid, badge)` rows (keeps the earliest `updatedAt`, ties broken by smallest `id`), then creates `user_badges_uid_badge_key` (SQL for the index matches `prisma migrate diff`). The seed already checks before inserting.
- **Tests:** `apps/achievement/src/test/infra/repositories/badge-manager.prisma.repository.impl.spec.ts` (existing: skip without publishing when `count` is 0); the constraint itself needs a database.
- **Running systems:** run `nx run achievement:prisma:migrate` (deploy) before starting the new build. The dedupe step cannot fail and makes the index creation safe on existing data; any duplicate awards are deleted (the user keeps one row per badge). `CREATE UNIQUE INDEX` locks `user_badges` writes briefly (table is small).

#### Progress showed an old login streak as current

- **Problem:** `getUsersProgress` computed `streak` from `startedAt..lastLogin` only, so a user who stopped logging in days ago still saw their last streak as running.
- **Fix:** `currentLoginStreakDays(startedAt, lastLogin, now)` in `apps/achievement/src/domain/entities/login-badge-manager.entity.ts` returns 0 once the last login is two or more UTC calendar days ago (same rule as `updateProgress`, where a gap of 2 restarts the streak); used by `apps/achievement/src/infra/repositories/badge.read.prisma.repository.impl.ts`. `longestStreak` is unchanged.
- **Tests:** `apps/achievement/src/test/infra/repositories/badge.read.prisma.repository.impl.spec.ts` (fixed clock; yesterday still current, two days ago and weeks ago read 0).

#### Badge list page size was unbounded

- **Problem:** `GetUsersBadgesDto.limit` had no `@Max`, so anyone (the route `GET /badges/:uid` is public) could ask for an unbounded page.
- **Fix:** `@Max(100)` on `apps/gateway/src/achievement-gateway/dtos/req/get-users-badges.req.dto.ts` (also documented in OpenAPI; the DTO now `implements Omit<achievement.UserBadgesRequestDto, 'userId'>`) and on the service DTO `apps/achievement/src/presentation/dtos/req/get-users-badges.req.dto.ts`. Values over 100 now get 400.
- **Tests:** covered by the DTO validation; no dedicated spec.

#### Invalid uploads returned 502; `fileSize` accepted 0, negatives and fractions

- **Problem:** `FileService.getPresignedUrl` threw plain `Error` for a file over 10 MB or a disallowed MIME type, which reached the client as 502 "An internal error occurred". `fileSize` was `@IsNumber()` in both DTOs. The gateway DTO also did not implement the generated message.
- **Fix:** `apps/file-service/src/app/services/file.service.ts` throws `BadRequestException` (with the reason) for a non-positive or non-integer size, a size over 10 MB and a disallowed type. `fileSize` is `@IsInt() @IsPositive()` in `apps/file-service/src/presentation/dtos/req/get-presigned-url.req.dto.ts` and `apps/gateway/src/file-gateway/dtos/req/get-presigned-url.req.dto.ts`; the gateway DTO now `implements Omit<file.GetPresignedUrlDto, 'uploadedBy'>` and documents the limits in OpenAPI.
- **Tests:** `apps/file-service/src/test/app/services/file.service.spec.ts` ("rejects a ... file with 400 before inserting a row": too large, disallowed type, zero, negative, fractional).

#### `ref_count` could go negative

- **Problem:** `decrementRef` decremented without a floor, e.g. on a duplicate legacy un-enveloped `files.removed`; a negative count would swallow the next reference and let the cleanup delete a file still in use.
- **Fix:** `apps/file-service/src/infra/repositories/file.prisma.repository.impl.ts`: after the decrements, one `updateMany set ref_count = 0 where id in (...) and ref_count < 0` in the same transaction.
- **Tests:** `apps/file-service/src/test/infra/repositories/file.prisma.repository.impl.spec.ts` (clamp call, empty list).
- **Running systems:** rows that are already negative stay negative until their next decrement; optionally run `UPDATE files SET ref_count = 0 WHERE ref_count < 0;` once.

#### Ownership event payloads were not validated

- **Problem:** the six authorization consumers cast `unwrapEvent<T>` payloads and never validated them; a malformed event failed inside Prisma.
- **Fix:** `apps/authorization/src/app/events/integration-events.ts` now holds class-validator classes (`ResourceCreatedEvent`, `TypedResourceCreatedEvent`, `ResourceDeletedEvent`, `TypedResourceDeletedEvent`), and every handler in `apps/authorization/src/app/events/handlers/{exam,live,resource}-ownership.handler.ts` runs `validatePayload` after the inbox claim. A bad payload raises `BadRequestException` before any write (it still goes through the retry/DLQ chain, like every other consumer). Added `apps/authorization/jest.config.ts` so the project has a `test` target.
- **Tests:** `apps/authorization/src/test/app/events/handlers/ownership.handlers.spec.ts` (valid payloads for all six handlers, six malformed ones rejected without touching the repository).

#### Seed: rooms never backfilled; dead `flashcard-list` rows

- **Problem:** the authorization seed copied room owners only from `resource_ownership` into `live.rooms.created_by`, never the other way, so a room whose `live.room.created` event was lost or predates the consumer had no ownership row and its owning mod got 403 on delete/schedule. It also seeded `flashcard-list` ownership, which no event maintains and no route reads.
- **Fix:** `apps/authorization/prisma/seed.ts` upserts a `room` row for every room with a `created_by` (after the existing reverse backfill), and deletes `flashcard-list` rows instead of seeding them. The seed already connected to `LIVE_DB_URL`.
- **Tests:** none (the seed talks to real databases).
- **Running systems:** run `nx run authorization:prisma:seed` once after deploy to backfill rooms and remove the stale rows.

#### `RegisterOwnership` / `RemoveOwnership` were unused and unchecked

- **Problem:** both RPCs were exposed with no caller check and nothing called them (repo-wide grep: only the controller, its DTOs and generated code); anything reaching the authorization gRPC port could revoke an owner's access.
- **Fix:** removed from `proto/authorization.proto` (with the now-unused `google/protobuf/empty.proto` import and messages), regenerated `libs/generated/src/authorization.ts` (`nx run generated:generate`), removed the controller methods in `apps/authorization/src/app/services/authorization.grpc.controller.ts` and the DTOs `register-ownership.req.dto.ts` / `remove-ownership.req.dto.ts`. The consumers keep using the repository directly.
- **Tests:** build/typecheck of authorization and gateway.
- **Running systems:** proto change; deploy authorization and gateway from the same build (the gateway only uses `CheckOwnership`, which is unchanged). `docs/architecture/services-and-data.md:80,82` and `docs/architecture/authorization.md:164` still mention the removed RPCs and the `flashcard-list` seeding and need a one-line update (outside this scope).

### Shared libs and frontend

#### Malformed pagination cursors answered with 502

- **Problem:** `CursorPaginationHelper.decodeCursor` (`libs/utils/src/functions/pagination/cursor.ts`, used by auth, exam, achievement and live) threw plain `Error`s, and `timingSafeEqual` threw a `RangeError` for a signature of another length, so a tampered or truncated cursor reached clients as 502.
- **Fix:** every invalid cursor is a 400 `BadRequestException('Invalid cursor')`; signatures of the wrong length are compared safely.
- **Tests:** `libs/utils/src/functions/pagination/cursor.spec.ts`, `cursor-pagination.factory.spec.ts`.

#### The highlight-to-flashcard popup listed no flash card lists

- **Problem:** the popup (`meowlish-fe/src/components/TextHighlighter.tsx`) asked for 200 lists, above the route's limit of 100, so the request failed with 400 and the list picker stayed empty.
- **Fix:** it asks for 100.

### Not bugs

- None: findings 2-15 were all confirmed against the code. (auth)
- Finding 5 (successful `exam.writing.scored` without `data` stored `comment: undefined` and dead-lettered): already fixed by C21; `WritingScoredHandler` stores it as a failure (`INVALID_RESULT`) and acks. (exam)
- Finding 12 (stale `messaging.md` retry settings): already corrected before this pass. (exam)
- Accepted proposals copy the proposer's `image` into the owner's card: `image` is a free URL string (the frontend form says "đường dẫn" and renders it only if it matches `^https?://`), not a file-service id, so there is nothing to ownership-check or reference-count. (resource)
- `totalThreads` vs pruned placeholders: with consistent data, `deleteComment` keeps a placeholder only while it has replies, so a root is never pruned and the counts agree. The concurrent-delete exception is backlog X3. (resource)
- None. (Checked the ban `reason` case specifically: the ts-proto codec omits an unset `optional StringValue` and decodes it as `undefined`, not `''`, so the 400 was real; fixed above.) (live/notification)
- (none: all 11 findings were confirmed against the code) (achievement/file/authorization)

## November 2026

### C22: the first websocket-only chat connection after a gateway restart timed out

- **Problem:** http-proxy-middleware subscribes to the HTTP server's `upgrade` event only on the first normal request through its route, so after a gateway restart a socket.io client using only the websocket transport timed out until some polling request came through (reproduced on production).
- **Fix:** `LiveWsGatewayController.handleUpgrade` (socket.io paths only) is subscribed to the server's `upgrade` event in `apps/gateway/src/bootstrap.ts` before `listen`. Once the library subscribes itself, its `upgrade` steps aside, so no upgrade is handled twice.
- **Tests:** `apps/gateway/src/test/live-ws-gateway/live-ws.router.controller.spec.ts` ("websocket handshake as the very first request after start-up"; it fails without the subscription).

### S20: Postgres, Redis, MinIO, RabbitMQ and Adminer were open to other machines

- **Problem:** `docker-compose.db.yaml` (and the observability stack) published every infrastructure port on all interfaces: Postgres (5434 in production), Redis without a password (6381) and RedisInsight (8003), Adminer (8180), MinIO's API and console (9000, 9001), RabbitMQ and its management UI (5673, 15673), and Grafana/OTLP. Anything on the network could reach them directly.
- **Fix:** all of these bind `${INFRA_BIND_ADDRESS:-127.0.0.1}` (`docker/docker-compose.db.yaml`, `docker/docker-compose.observability.yaml`, documented in `docker/.env.example`). What browsers need already goes through Caddy on the host: files and uploads via `MINIO_PUBLIC_URL` (the public domain, proxied to `localhost:9000`), the MinIO console via `/minio` (to `localhost:9001`).
- **Running systems:** applied on 14 November 2026 by recreating the infrastructure containers one by one; every service reconnected (23 of 23 consumer queues had their consumer back), the API and public files kept answering, and from the LAN address every one of these ports (and the Envoy ones from S16) is closed. Remote tools now need an SSH tunnel, or `INFRA_BIND_ADDRESS=0.0.0.0` deliberately.

### S16: the Envoy gRPC-web sidecars were reachable from other machines

- **Problem:** every gRPC service except authorization has an Envoy gRPC-web sidecar, and compose published their ports on all interfaces (`0.0.0.0:8081-8088`, `8095`, plus Envoy's admin port 9900). Services trust `requesterId`, `privileged`, `mayAttachAnyFile` and `recipientId` from the message, so anyone who could reach a sidecar skipped the gateway and its checks (for example `UpdateExam` with `privileged: true`).
- **Fix:** `docker/docker-compose.app.yaml` publishes every Envoy port on `127.0.0.1` by default: the sidecars (`ENVOY_SIDECAR_BIND_ADDRESS`), the gateway's Envoy (`ENVOY_GATEWAY_BIND_ADDRESS`) and the admin port (always localhost). A reverse proxy on the host is the public entry point; production's Caddy already proxies `meowlish.servebeer.com/api/*` to `localhost:8280`. A deployment without one sets `ENVOY_GATEWAY_BIND_ADDRESS=0.0.0.0`, which publishes only the gateway (`docker/.env.example`).
- **Not done (needs a separate decision):** forwarding the JWT and re-verifying it in each service (the `Actor` step of the hybrid-authorization spec), which would make the services safe even when reached directly. The database ports are tracked as S20.
- **Running systems:** recreate the Envoy containers. Anything that used a sidecar port from another machine must go through the gateway (or an SSH tunnel).

### Exam scoring was not durable; writing points never reached the score badges

Two items from the backlog's Conventions list.

- **Durable scoring.** Scoring ran in process right after the submit commit (`eventBus.publishAll` → a CQRS handler, errors only logged), so a crash or a failing `score()` in between lost `exam.attempt.scored` and the essays' `exam.writing.submitted` for good. Now `AttemptSubmittedHandler` (`apps/exam/src/app/events/handlers/attempt-submitted.handler.ts`) is a RabbitMQ consumer of exam's own `exam.attempt.submitted` (queue `exam.events.attempt.submitted`, written to the outbox in the submit transaction): in one transaction it claims the event in the inbox, scores the attempt and writes both events. Failures retry and dead-letter instead of disappearing.
- **Writing points and score badges.** AI writing feedback raises the stored score later, but `exam.attempt.scored` is sent once at submit, so achievement's good/perfect badges ignored writing. `WritingScoredHandler` now writes `exam.attempt.rescored { attemptId, attemptedBy, previousScore, score, totalPoints }` in the rescore transaction when the score changed (`attempt-rescored.publisher.ts`). achievement's `AttemptRescoredHandler` (queue `achievement.events.attempt.rescored`, inbox) calls `AttemptScoreBadgeManager.rescore`, which moves the attempt from the tier of its previous score to the new one. It is a difference, so the counts are right whichever of `scored` and `rescored` arrives first; badges are only added.
- **Running systems:** the new queues are declared on start-up. Attempts submitted before the deploy keep the counts they had.
- **Tests:** `apps/exam/src/test/app/events/handlers/attempt-submitted.handler.spec.ts`, `writing-scored.handler.spec.ts` ("announces the new score"), `apps/achievement/src/test/domain/entities/attempt-score-badge-manager.entity.spec.ts`.

### Messaging: unroutable events were dropped; two services ran no relay; legacy bare payloads

Three items from the backlog's Conventions list, fixed together in `@server/messaging`.

- **Unroutable events were silently dropped.** The relay published without `mandatory`, so an event whose routing key had no bound queue (a consumer not deployed yet) was confirmed and lost. Now it publishes `mandatory: true` and records `basic.return` messages per channel (`watchReturns` in `libs/messaging/src/lib/outbox.relay.ts`; the broker sends the return before the confirm). A returned event is treated as a failed publish: it stays in the outbox, is retried with the normal back-off and trips `OutboxStuck`, so it arrives once its queue exists. `auth.user.locked`, the one key that had no consumer, now has one (S17).
- **file-service and notification ran no relay**, so they had no outbox metrics or alerts and, since inbox cleanup runs inside the relay, their `inbox_events` were never pruned. Both run it now (file-service on its only connection, `sub`).
- **Legacy bare payloads** (no envelope, so no id) were accepted by `unwrapEvent` and always claimed by the inbox, i.e. processed without deduplication. Every publisher writes envelopes, so `unwrapEvent` now throws for anything else and `InboxService.claim` requires an id; a stray bare message retries and dead-letters where it can be seen. `exam.writing.submitted` stays bare on purpose and is not read through `unwrapEvent`.
- **Running systems:** before the deploy every queue was checked for old-format messages (none). `achievement.events.user.login.dlq` held 11 enveloped logins that had failed on 13 November with the older achievement code; they were replayed into `achievement.events.user.login` and all processed (logins older than a user's last login change nothing).
- **Tests:** `outbox.relay.spec.ts` (an unroutable event is kept and retried; the return listener is registered once), `envelope.spec.ts` ("rejects a bare payload"), `inbox.service.spec.ts` ("rejects a missing id"), `apps/achievement/src/test/app/events/handlers/login.handler.spec.ts`.

### S17: revoked or locked accounts kept their chat sockets

- **Problem:** live's socket handshake only checked the JWT signature, expiry and `sub`, so a token revoked by logout-all or a password change, or an account locked by an admin, could still open sockets until the token expired (up to 15 min). Nothing consumed `auth.user.locked`, so sockets already open stayed connected.
- **Fix:**
  - The handshake calls auth's `ValidateAccess` (same revocation and lock check as the gateway) and refuses the socket on any failure (`apps/live/src/app/services/chat.gateway.ts`; new `AUTH_CLIENT` in `apps/live/src/live.module.ts`, `authService` in `apps/live/src/configs/config.ts`).
  - New consumer `UserLockedHandler` (`apps/live/src/app/events/handlers/user-locked.handler.ts`, queue `live.events.user.locked`, inbox) disconnects every socket of the locked user on every node (`disconnectAllOf`).
- **Running systems:** live needs `AUTH_SERVICE_HOST` / `AUTH_SERVICE_PORT` (or `AUTH_SERVICE_URL`); compose sets them. Start live before auth publishes a lock, or the event waits in the outbox until the queue exists (see the messaging entry).
- **Tests:** `chat.gateway.spec.ts` (revoked token refused, locked user disconnected), `apps/live/src/test/app/events/handlers/user-locked.handler.spec.ts`.

### Conventions: exam gateway DTOs and `process.env`

- **Exam gateway request DTOs** (`apps/gateway/src/exam-gateway/dtos/req/**`, 23 classes) now `implements` their generated `exam.*` message (with `Omit<…>` for ids from the path and the requester fields), so the compiler keeps them in sync with the proto. `ReviewExamDto.status` is an enum (`apps/gateway/src/enums/exam-status.enum.ts`), so a bad status is a 400 at the gateway.
- **`process.env`** is no longer read in gRPC client providers or listeners: all ten apps read `HOST`/`PORT`/`HEALTH_PORT` (live and notification: `GRPC_*`, `HTTP_*`) and every `*_SERVICE_HOST`/`_PORT`/`_URL` through their zod config and `ConfigService`, with the same names and defaults as before. Only `startTelemetry` (runs before Nest) and `resolveDatabaseUrl` still read `process.env`.

### C21: a scorer failure left the essay unscored with no trace

- **Problem:** when the AI scorer gave up (`status: 'error'`, e.g. `LLM_PARSE_ERROR` or `LLM_TIMEOUT` after its own retries), `WritingScoredHandler` threw. The message was retried five times and dead-lettered, nothing was stored, and the results page polled for five minutes before giving up. A success without `data` failed the same way.
- **Fix:**
  - `WritingScoredHandler` (`apps/exam/src/app/events/handlers/writing-scored.handler.ts`) records the failure as the response's feedback, `{ status: 'error', error_code, error_message, failed_at }` (code `INVALID_RESULT` for a success without `data`), and acks the message. Retrying in exam could not change the scorer's answer.
  - `IAttemptRepository.saveScoringFailure` (`attempt.prisma.repository.impl.ts`) never replaces a real band; a later successful result for the response still overwrites the failure through `saveComment`.
  - Frontend (`meowlish-fe`): the results page and `/writing` recognise the failure record, stop waiting, label the essay "Chưa chấm được" with a plain explanation, and leave it out of the average band. A real band 0 is now shown instead of hidden.
- **Tests:** `apps/exam/src/test/app/events/handlers/writing-scored.handler.spec.ts`, `apps/exam/src/test/infra/repositories/attempt.prisma.repository.impl.spec.ts` ("saveScoringFailure").

### C20: report attachments were never reference-counted

- **Problem:** exam and auth tell file-service when a file becomes referenced (`*.file.added`) or released (`*.files.removed`), and file-service's orphan cleanup deletes files with `ref_count <= 0` an hour after upload. resource's reports did neither, so every report attachment looked orphaned and was deleted after an hour.
- **Fix:** `ReportService` (`apps/resource/src/app/services/report.service.ts`) writes, in the same transaction as the change, `resource.file.added { fileId }` for each attachment of a new report and for each newly attached file (re-attaching is a no-op), and `resource.files.removed { files: [{ id, count: 1 }] }` when a file is detached or its report deleted. Publisher methods `fileAdded` / `filesRemoved` in `resource-events.publisher.ts`. file-service already consumes both keys (`*.file.added`, `*.files.removed`).
- **Running systems:** files attached before this build need their reference added once, **before** the new resource build starts (after it, new attachments are counted by their events):

  ```sql
  -- resource_db: how many reports reference each file
  SELECT file_id, count(*) FROM report_files GROUP BY file_id;
  -- file_db: add those counts (one UPDATE per file, or a VALUES join)
  UPDATE files SET ref_count = ref_count + <count> WHERE id = '<file_id>';
  ```

  Production had no report attachments on 14 November 2026, so nothing was backfilled there.

- **Tests:** `apps/resource/src/test/app/services/report.service.spec.ts` ("file references (C20)").

### S19: leaving one's own uid room dodged ban kicks

- **Problem:** at connect, live joins each socket to a room named after its uid, and a ban removed sockets through that room (`server.in(uid).socketsLeave(roomId)`). `leave-room` accepted any string, so a client could leave its uid room first; the ban then missed it and it kept chatting (`chat` only checks room membership). The ban was also saved _after_ the kick, so a kicked user could re-join before it was stored.
- **Fix:**
  - `leave-room` accepts only room ids (UUIDs), like `join-room` (`apps/live/src/app/services/chat.gateway.ts`).
  - `disconnectUser` also looks up the room's sockets (`fetchSockets`, works across instances through the Redis adapter) and removes those whose verified `socket.data.uid` is the banned user.
  - `ChatService.banUserFrom` stores the ban first, then kicks (`apps/live/src/app/services/chat.service.ts`).
- **Tests:** `apps/live/src/test/app/services/chat.gateway.spec.ts` (leaving a uid room is refused; a ban kicks by socket uid).

### S18: an access token was accepted as a refresh token

- **Problem:** access and refresh tokens are signed with the same RS256 key and had no type claim. `POST /auth/refresh` only checked the signature and the refresh schema, which strips unknown keys, so a 15-minute access token minted a 7-day session. live's socket handshake had the opposite hole: it accepted a refresh token.
- **Fix:**
  - New `TokenType` enum (`libs/typing/src/enums/token-type.enum.ts`); auth signs access tokens with `typ: ACCESS` and refresh tokens with `typ: REFRESH` (`apps/auth/src/app/services/token.service.ts`).
  - `isAccessTokenPayload` / `isRefreshTokenPayload` (`libs/utils/src/types/payload.type.ts`) decide by `typ`, and for tokens issued before the claim existed, by shape (only access tokens carry `roles`/`permissions`). So no session is invalidated by the deploy.
  - Checked in the gateway's `JwtStrategy` (access only) and `JwtRefreshStrategy` (refresh only), and in live's handshake (access only).
- **Running systems:** deploy auth, gateway and live together. Old tokens keep working until they expire.
- **Tests:** `libs/utils/src/types/payload.type.spec.ts`; `apps/gateway/src/test/auth-gateway/auth-cookies.spec.ts` (an access token on `/refresh` and a refresh token on a protected route get 401); live handshake tests in `chat.gateway.spec.ts`.

### Seed: "TOEIC LR 2" was an incomplete Reading test labelled Listening + Reading

- **Problem:** `apps/exam/prisma/seed/exam-toeic-lr-2.ts` only had Reading parts 5-7 (32 questions, numbered 101-132) but was titled "TOEIC LR 2", tagged TOEIC Listening + Reading and timed for 2 hours. Parts 6 and 7 had no passages (no directive, no files), so 17 questions had nothing to read.
- **Fix:** Part instructions, the two Part 6 texts (with numbered blanks) and the three Part 7 texts (email, notice, job advertisement), written to match the existing answer keys; title "TOEIC Reading 2 (Part 5–7)", tag TOEIC Reading, 25 minutes (TOEIC's 75 minutes per 100 questions). The seed skips exams that exist, so `refreshToeicLr2` (called from `seedExams`) updates an existing exam 5 in place; attempts keep pointing at the same sections and questions.
- **Running systems:** applied to the live database (backup `~/meowlish-db-backups/exam_db-20261114-160857.sql`).
