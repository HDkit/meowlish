# Fixed issues

What was fixed from [`backlog.md`](roadmap.md) (now [`roadmap.md`](roadmap.md)), and how. Newest first. Each entry says what was wrong, what changed (files), what it means for running systems, and how it is tested. The backlog row is deleted in the same commit as the fix.

## Flash card images in file-service (November 2026)

- **Problem:** a flash card's image was a free URL string (`flash_cards.image`). Users could not upload a picture, any external URL was hot-linked (the frontend showed it only when it started with `http(s)://`), and nothing checked or cleaned it up.
- **Fix:** card images are file-service files, like avatars and report attachments.
  - **Schema/proto:** new nullable column `flash_cards.image_file_id` (`FlashCard.imageFileId`). The legacy `image` column stays and is still returned for old cards; setting or removing an image clears it. `CreateFlashCardRequest.image` (3) and `UpdateFlashCardRequest.image` (4) are removed and reserved: new URLs are no longer accepted. Requests take `image_file_id` (+ `may_attach_any_file`, set by the gateway for admins); `FlashCardResponse` and `FlashCardContent` gain `image_file_id`, and their `image` is now "the URL to show". Update: absent keeps the image, `''` removes it, an id replaces it.
  - **Uploader check:** `FlashcardService.createFlashCard` / `updateFlashCard` call `CheckFilesOwnedBy` before the transaction (403 `You can only attach files you uploaded`), skipped for admins and for re-sending the card's current image (so the owner of a copy can save a card whose image someone else uploaded). The update locks the card row and refuses (409) if the image changed between the check and the write such that the sent id was never checked.
  - **Reference counting** (`apps/resource/src/app/services/card-image-refs.service.ts`): each card row holding an `image_file_id` is one reference. In the same transaction as the card change, the outbox gets `resource.file.added` for every new holder and `resource.files.removed` (grouped counts) for every holder that lets go: create, replace, remove, card delete, list delete, fork (each copied card adds one), pull (updated image moves the reference, new cards add, removed cards release), accepted proposal (added cards add, removed cards release; modifications write text only, `cardTextData`). Cards are deleted with `DELETE … RETURNING image_file_id` so a concurrent delete is never released twice; list delete locks the list first and deletes the cards itself instead of relying on the FK cascade; pull locks the copy's cards. Old snapshots and stored proposals without `imageFileId` read it as null (`cardContentSchema` default).
  - **URLs** (`card-image-url.service.ts`): one `GetUrls` per response (card, page of cards, list detail, diff, proposal), outside transactions. Images are uploaded to the public bucket (`isPublicFile: true`, like avatars), so URLs don't expire. Unknown files or a file-service outage leave `image` absent instead of failing the read.
  - **Files:** `apps/resource/prisma/schema/resource.prisma`, `proto/resource.proto` + `libs/generated/src/resource.ts`, `apps/resource/src/app/services/{flashcard,flashcard-list,flashcard-fork,flashcard-proposal,card-image-refs,card-image-url}.service.ts`, `app/mappers/{flash-card,flash-card-fork}.mapper.ts`, `domain/flash-card-fork/card-content.ts`, read models, service DTOs, `resource.module.ts`; gateway `resource-gateway/dtos/{req/create-flash-card,req/update-flash-card,res/flash-card,res/flash-card-proposal}` and `resource.router.controller.ts` (`mayAttachAnyFile`). Docs: `flows/resource.md`, `flows/resource-community.md` ("Card images in copies and proposals"), `flows/achievement-file-authorization.md`, `messaging.md`, `services-and-data.md`.
  - **Known edge:** a proposal holds no reference. If the proposer removes an added card's image and no other card holds the file, the orphan cleanup may delete it (after 24 h) before the proposal is accepted; the accepted card then shows no image (file-service logs `file.added for unknown file`).
- **Deploy:** `nx run resource:prisma:push` (adds the nullable column, no data change) before the new resource starts. Then resource, then gateway with the frontend. Mixed versions fail safe: an old gateway's `image` (field 3/4, now reserved) is ignored by the new resource, and a new gateway's `image_file_id` is ignored by an old resource; either way the card is saved without the image. An old frontend's `image` URL is stripped by the new gateway's whitelist. No file-service change.
- **Frontend:** the card form uploads the picked image (JPG/PNG, max 10 MB) with the new `uploadPublicFile` (`src/lib/file-upload.ts`), previews it, and offers change/remove; updates send `imageFileId` only when the image was changed (`imageFileIdForUpdate`). Cards show `image` (the resolved or legacy URL).
- **Tests:** `apps/resource/src/test/app/services/flashcard.service.spec.ts` (uploader check and admin override, current image exempt, replace/remove/delete balance, row lock, 409 race, delete once, legacy URL), `flashcard-list.service.spec.ts` (list delete releases each card's image, shared files counted, lock before delete, URLs on detail and pages), `flashcard-fork.service.spec.ts` (fork adds per copy, pull moves/adds/releases, skipped cards keep theirs, old snapshots, card lock, diff URLs), `flashcard-proposal.service.spec.ts` (accept adds/releases, modified untouched, already-deleted removals, reject/withdraw nothing, legacy proposals, URLs), `card-image-refs.service.spec.ts`, `card-image-url.service.spec.ts`, `test/domain/flash-card-fork/list-diff.spec.ts` (image file synced by pull, never proposed, old snapshots), gateway `resource.router.controller.spec.ts` (URL dropped, admin-only `mayAttachAnyFile`). Shared fakes in `apps/resource/src/test/helpers/card-images.ts` (`refBalance` sums the published references). Frontend: `src/lib/file-upload.test.ts`, `src/lib/flashcard-fields.test.ts`, `src/lib/api-errors.test.ts`.

## Follow-ups (November 2026)

### Frontend: switches in the off state were white on white

- **Problem:** the switch's off track used `bg-switch-background`, declared only as a Tailwind 4 `--color-*` token in `globals.css`; the frontend runs Tailwind 3, so the class was never generated and the track was transparent (white thumb on a white card), on the settings page and in the flash card screens.
- **Fix:** `switch-background` is a color in `tailwind.config.ts` (frontend commit "switches in the off state had no track color").
- **Tests:** checked in the browser: the off track is `rgb(194, 214, 202)`.

### Badge names were English in notifications, Vietnamese on the badge page

- **Problem:** `BADGE_INFORMATION` (`apps/achievement/src/constants/badge-info.const.ts`) had English names ("Flawless Start"), which `achievement.badge.earned` carries and the notification quotes inside a Vietnamese sentence, while the frontend's badge page shows its own Vietnamese catalogue ("Hoàn hảo").
- **Fix:** the backend names and descriptions are the same Vietnamese texts as the frontend catalogue (`src/lib/badges.ts`). The seed now upserts the badges (it used `createMany … skipDuplicates`, so stored texts never changed), so re-running it updates `badges.display_name`/`description`. Notifications already stored were rewritten once on production (message and `data.badgeName`, matched on the old English name).
- **Deploy:** re-run the achievement seed (`nx run achievement:prisma:seed`, re-runnable) and redeploy achievement. Old notifications keep their English names unless rewritten.
- **Tests:** `apps/achievement/src/test/infra/repositories/badge-manager.prisma.repository.impl.spec.ts` (the event carries `displayName`).

## Backlog decisions (November 2026)

The items in the backlog that needed a decision (S21–S25, C23–C40), after the product owner decided each one. Kept as they are, by decision: **S24** (question explanations stay public), **C23** (deleted users' identities are still returned by hydration), **C27** (approved exams can be deleted, and the delete cascades to every attempt), **C34** (every thread view counts), **C36** (the unused email/push/system switches stay).

### C25: Goal targets could not be half bands (IELTS 6.5)

- **Problem:** `goals.target` was an `Int` column and the proto fields were `Int32Value`/`int32`, so targets were validated as integers 0-990 and IELTS/VSTEP half bands were refused with a 400.
- **Fix:** `goals.target` is now `Float` (Postgres `DOUBLE PRECISION`) through the additive migration `apps/exam/prisma/migrations/20261115100000_goal_target_decimal` (`ALTER COLUMN ... SET DATA TYPE DOUBLE PRECISION`, matches `prisma migrate diff`). `proto/exam.proto` `SetGoalDto`/`UpdateGoalDto.target` are `DoubleValue` and `GoalResponse.target` is `double` (regenerated `libs/generated/src/exam.ts`). The exam service validates each target against its type in `assertValidGoalTarget` / `goalScales` (`apps/exam/src/domain/entities/goal.entity.ts`, called from `GoalService.setGoal/updateGoal`): IELTS 0-9 in steps of 0.5, TOEIC 10-990 in steps of 5, TOEFL 0-120 whole numbers, VSTEP 0-10 in steps of 0.5. Anything else is a 400. There is a new service enum `apps/exam/src/enums/goal-type.enum.ts`, and the service DTOs use `@IsNumber` + `@IsEnum(GoalType)`. The gateway DTOs (`apps/gateway/src/exam-gateway/dtos/req/goal/*`) only check for a finite number in 0-990 and document the per-type scales in OpenAPI. Docs: `docs/architecture/flows/exam.md` (Goals), `apps/<service>/README.md` (`goals` row).
- **Deploy:** run migration `20261115100000_goal_target_decimal` (widening, keeps every existing value). The proto change is **not wire-compatible** (field 3 changes from varint to fixed64/DoubleValue), so deploy gateway and exam together. Existing integer goals that fall outside the new per-type rules (e.g. an IELTS goal of 750, or TOEIC 752) stay readable. Only a set or update re-validates them. Frontend: `src/lib/goal-form.ts` scales now match (TOEIC step 5, TOEFL whole numbers) and `src/lib/api-errors.ts` translates the new message.
- **Tests:** `apps/exam/src/test/domain/entities/goal.entity.spec.ts` (accepted and rejected values per type, NaN/Infinity, unknown type), `apps/exam/src/test/app/services/goal.service.spec.ts` (half bands stored, out-of-scale values rejected before saving), `apps/gateway/src/test/exam-gateway/dtos/req/goal/set-goal.req.dto.spec.ts` (gateway accepts 6.5, rejects -1/990.5/"7"/NaN).

### C26: Attempt review `additionalData` was JSON-encoded twice

- **Problem:** `WritingScoredHandler` stored `JSON.stringify(payload.data)` (and the failure record) as a JSON _string_ in the JSON column `scorer_data.comment`, and `getAttemptReview` ran `JSON.stringify` on it again. The result was a JSON string containing a JSON string.
- **Fix:** the handler now stores the feedback object itself (`instanceToPlain(payload.data)`) and the failure record object (`apps/exam/src/app/events/handlers/writing-scored.handler.ts`; `saveComment`/`saveScoringFailure` take `Record<string, unknown>` in `domain/repositories/attempt.repository.ts` and `infra/repositories/attempt.prisma.repository.impl.ts`). The review builds `additionalData` with the new `toAdditionalData` (`infra/repositories/writing-band.ts`): an object is `JSON.stringify`'d once, and an old string row is returned as is because it already holds that single encoding. Old and new rows therefore produce identical output. `toWritingBand` already read both forms. The seed (`apps/exam/prisma/seed/attempt-builder.ts`) now writes objects too. Docs: `flows/exam.md` (review, `WritingScoredHandler`), `services-and-data.md` (`scorer_data`).
- **Deploy:** exam only, no migration, no proto change. Existing rows are not rewritten; they are read through the string fallback. The frontend (`WritingTest.tsx`, `TestResult.tsx`) parses once and again if the result is still a string, so it reads both shapes.
- **Tests:** `apps/exam/src/test/infra/repositories/writing-band.spec.ts` (band from object and from string rows, single encoding for both, same output for old and new rows), `writing-scored.handler.spec.ts` (saves objects, not strings), `attempt.prisma.repository.impl.spec.ts` (upsert receives the object, band loads from an object row), `prisma/seed/attempt-builder.spec.ts`.

### C27: Deleting an approved exam cascades to every user's history

- **Decided: keep.** Approved exams can be deleted, and the delete cascades to attempts, responses and AI feedback. It is the one mutation an approved exam allows. This is now stated explicitly in `docs/architecture/flows/exam.md` (DELETE `/exams/management/:id`, "Approved is frozen") and covered by a test in `approved-exam.handlers.spec.ts`.

### C28: Approved exam workflow (approval is final)

- **Problem:** the workflow was undecided. Most mutations already 409'd on approved exams, but `addTag`/`removeTag` on `Exam`, `Section` and `Question` had no `assertModifiable`. They were only blocked because the update handlers happen to call `updateDetails` first.
- **Fix:** decision: once `APPROVED`, an exam can only be deleted. Status changes are refused for everyone, admins included (no reject, no back to pending). Content edits are refused too. `addTag`/`removeTag` now call `assertModifiable()` on all three aggregates (`apps/exam/src/domain/entities/{exam,section,question}.entity.ts`). Every handler was audited every handler in `app/commands/handlers/management/`. Review, update exam, create/update/delete/move section, and create/update/delete/move question (details, choices, tags, files) all 409 through the aggregates. Moves only resolve destinations inside the same exam, so nothing can be moved into or out of an approved exam. Docs: `flows/exam.md` ("Approved is frozen; it can only be deleted", review route).
- **Deploy:** exam only.
- **Tests:** `apps/exam/src/test/app/commands/handlers/management/approved-exam.handlers.spec.ts` (31 cases, one per mutation type through the real handlers with approved aggregates: 409 and nothing saved/published; delete still works). `apps/exam/src/test/domain/entities/approved-exam-lock.spec.ts` (updateStatus to every status is 409; tag changes on approved exam/section/question are 409; pending/rejected still reviewable and taggable).

### C29: `addCardToList` ignored `position` (cards had no order column)

- **Problem:** `AddCardToListDto.position` was validated and forwarded but ignored; cards had no order column and lists always sorted `createdAt desc`.
- **Fix:** new nullable column `flash_cards.position` (`FlashCard.position Int?`). `CARD_ORDER` (`apps/resource/src/app/mappers/flash-card.mapper.ts`) = `position asc nulls first, createdAt desc, id asc`, used by `listCardsInList` and `getFlashCardList` (its `flashCards`); `GET /flash-cards` (across lists) stays `createdAt desc`. Null = "never placed": every existing row and every card created since (create, accepted proposals, pulled cards). Nulls sort first, newest first, so a list nobody reorders shows exactly today's order. `addCardToList` (now `@Transactional()`) locks the list row (`SELECT … FOR UPDATE`), reads the list's other cards in `CARD_ORDER`, puts the card at `min(position ?? n, n)` (omitted = append at the end, past the end = last, a card already in the list is moved) and renumbers the others `0..n` with one raw `UPDATE … FROM unnest(ids, positions)` (only rows whose number changes; raw so their `updatedAt` is untouched). After the first add/move a list is fully numbered, so `position` is the 0-based index; a card created afterwards shows at the top until the next move. Moving a card out of a list leaves a harmless gap in the old list. Forks copy `position` as is. `FlashCardResponse` gains `optional int32 position = 13` (`FlashCardDto.position`, gateway + service). Files: `apps/resource/prisma/schema/resource.prisma`, `apps/resource/src/app/services/flashcard-list.service.ts`, `flashcard-fork.service.ts`, `app/mappers/flash-card.mapper.ts`, `domain/read-models/flash-card.read-model.ts`, `presentation/controllers/flashcard-list.controller.ts`, `presentation/dtos/res/flash-card.res.dto.ts`, `apps/gateway/src/resource-gateway/dtos/{req/add-card-to-list.req.dto.ts,res/flash-card.dto.ts}`, `proto/resource.proto` + `libs/generated/src/resource.ts`. Docs: `flows/resource.md` (add card / list cards / list detail), `flows/resource-community.md` (fork copy), `services-and-data.md`.
- **Deploy:** `nx run resource:prisma:push` (additive nullable column, no data change) before the new resource starts. Order: resource then gateway (an old gateway simply never sends/reads `position`; new gateway with old resource just ignores it as before).
- **Frontend:** `FlashCardResponse.position` in `FlashcardService.ts`; no screen reorders cards yet.
- **Tests:** `apps/resource/src/test/app/services/flashcard-list.service.spec.ts` (order used by list/detail; append numbers unplaced cards first; insert shifts only later cards; clamp past end; move within a list closes the gap; list lock taken before reading cards), `flashcard-fork.service.spec.ts` (copies keep `position`). The raw renumbering SQL was checked against Postgres on a rolled-back temp table.

### C30: `resolvedBy` named whoever last changed status/response, even on reopened reports

- **Problem:** `resolvedBy` changed whenever the status or response changed and survived a move back to `pending`/`reviewing`; staff could keep editing (and re-resolving) a resolved report; reporters could still attach/detach files after resolution.
- **Fix:** decision: a report is resolved once, by one person, and is frozen afterwards. Final statuses are `resolved`, `rejected`, `dismissed`, `closed`, all treated the same (`isFinalReportStatus`, `apps/resource/src/enums/report-status.enum.ts`); `pending`, `reviewing`, `in_progress` (and any legacy string) are open. `ReportService.updateReport` locks the report row (`SELECT … FOR UPDATE`), then 409 `This report is already <status> and can no longer be changed` for everyone (admins included) if it is final; otherwise it updates and sets `resolvedBy` = caller only when the new status is final, `null` otherwise. The lock makes resolution single-winner (the second concurrent resolver waits, then gets 409). `addFileToReport` (pre-check, then again under the row lock inside `attachFile`) and `removeFileFromReport` (under the lock) are 409 on final reports for reporter and staff alike. Reporters can't edit or delete reports at all (staff-only routes); staff `DELETE` of a final report is still allowed (it removes the record, it doesn't change the resolution). Read model returns `resolvedBy` only for final reports, so legacy rows that name someone on an open report show no resolver (the next update clears the column). Files: `apps/resource/src/app/services/report.service.ts`, `apps/resource/src/enums/report-status.enum.ts`, `apps/gateway/src/resource-gateway/{resource.router.controller.ts,dtos/res/report.dto.ts}` (OpenAPI text), proto comments in `proto/resource.proto` + `libs/generated/src/resource.ts`. Docs: `flows/resource.md` (PATCH/DELETE reports, report files), `services-and-data.md`.
- **Deploy:** resource only (gateway change is documentation). No schema change. Behaviour change visible to staff: updating a resolved/rejected report now returns 409.
- **Frontend:** `ReportManagementPage.tsx` treats every final status as closed (`isFinalReportStatus` in `src/lib/admin.ts`, so `in_progress` stays open), sets `resolvedBy` optimistically only on a final status, and refreshes on a 409; `api-errors.ts` translates the 409.
- **Tests:** `apps/resource/src/test/app/services/report.service.spec.ts` (`ReportService resolution (C30)`: resolver recorded on final move; non-final changes leave/clear `resolvedBy`; every final status refuses status and response updates with 409 and no event; row lock before read; legacy `resolvedBy` hidden on open reports; add/remove files 409 on each final status without calling file-service; attach refused when resolved during the uploader check; foreign report still 404 before 409).

### C31: concurrent comment deletes could leave a reply-less `[deleted]` placeholder

- **Problem:** deleting the last reply and its parent at the same time: each transaction counted the other's row as still present, so the parent became a placeholder with no replies (pruned by `buildCommentTree` while `totalThreads` still counted it).
- **Fix:** `BlogCommentService.deleteComment` row-locks (`SELECT id FROM blog_comments WHERE id = $1 FOR UPDATE`, `lockComment`) the comment itself before reading it, then its parent before counting replies, and in the placeholder walk each ancestor's parent before deleting the ancestor. Locks are always taken deepest first, so deletes on one chain serialize without deadlocks; whichever runs second sees the first one's commit (reply gone → parent hard-deleted; parent soft-deleted → the reply delete removes the now-empty placeholder). File: `apps/resource/src/app/services/blog-comment.service.ts`. Docs: `flows/resource.md` (DELETE blog comment, findings).
- **Deploy:** resource only. No schema change.
- **Tests:** `apps/resource/src/test/app/services/blog-comment.service.spec.ts` (`delete locking`: comment and parent locked before counting replies; comment locked before it is read; chain locks `leaf, ph, live` deepest first; parent with no replies left after waiting is hard-deleted).

### C32: flash card update/delete relied on `@ResourceAccess` alone

- **Problem:** `PATCH`/`DELETE /resources/flash-cards/:id` were gated only by `@ResourceAccess` (authorization's ownership copy); resource did no owner check; a new card was 403 for its author until `resource.resource.created` was consumed; `parent`/`mentor` users got 403 on their own cards; unknown ids were 403.
- **Fix:** requester pattern. `UpdateFlashCardRequest` gains `requester_id = 12`, `privileged = 13`; `DeleteFlashCardRequest` gains `requester_id = 2`, `privileged = 3` (regenerated `libs/generated`). Gateway drops `@ResourceAccess` on both routes and sends `requesterOf(req.user, FLASH_CARD_ADMIN_ROLES)` (`[Role.Admin]`). Resource DTOs extend `RequesterReqDto`; `FlashcardService.findOwnedCard` = `findFirst({ id, list: { authorId: requesterId } })` (no list filter for admins), 404 `FlashCard not found` otherwise, used by `updateFlashCard` and `deleteFlashCard`. Card create was already checked in the service (target list must be the caller's), so with no gateway ownership lookup the author can edit/delete a new card immediately. `resource.resource.created/deleted` for `flashcard` and the authorization seed backfill are kept (no route reads them now; keeps a rolled-back gateway working; can be removed later). Files: `proto/resource.proto`, `libs/generated/src/resource.ts`, `apps/gateway/src/resource-gateway/resource.router.controller.ts`, `apps/resource/src/app/services/flashcard.service.ts`, `apps/resource/src/presentation/controllers/flashcard.controller.ts`, `apps/resource/src/presentation/dtos/req/{update,delete}-flash-card.req.dto.ts`. Docs: `AGENTS.md` (Authorization bullets), `docs/architecture/authorization.md` (§1, §5, §6, §7(e) rewritten, §8, §9), `flows/resource.md`, `flows/achievement-file-authorization.md`, `docs/architecture/README.md`.
- **Deploy:** **resource first, then gateway.** New resource + old gateway: the old gateway sends no `requesterId`, so card update/delete fail validation (400) until the gateway is deployed (fails closed). The reverse order (new gateway, old resource) would leave card update/delete with no owner check at all, so don't do it. No schema change.
- **Tests:** `apps/resource/src/test/app/services/flashcard.service.spec.ts` (lookup through the list author; 404 on update and delete for a stranger with no write/event; admins change any card; author edits and deletes a card right after creating it); `apps/gateway/src/test/resource-gateway/resource.router.controller.spec.ts` (no `@ResourceAccess` metadata on the two routes; JWT user forwarded on update whatever the body claims; only admins privileged on delete).

### S21: Google login CSRF (default-frontend login had no state)

- **Problem:** Default-frontend Google login sent no `state`, and passport used no state store, so `/google/callback` accepted any code. An attacker could send a victim a callback URL carrying the attacker's own code. The victim's frontend then exchanged the resulting `loginToken`, which signed the victim into the attacker's account (login CSRF). Listed-frontend logins had a state, but it was not tied to the browser either.
- **Fix:** `GoogleOAuth2Guard.startFlow` now writes a single-use nonce for every flow (login and linking, default and listed frontends): Redis `gateway:oauth2:state:<nonce>` = `{ identityId?, frontend?, bound: true }`, 300 s. It also sets the `oauth2_state` cookie (HttpOnly, Lax, Secure like the session cookies, Path=`/api/v1/auth/google/callback`). `GoogleOAuth2CallbackGuard.consumeState` refuses a missing state and requires cookie == state for every record. It checks before deleting, so a forged callback can't burn the state. After that it DELs the record and clears the cookie. There is a transition window until `LEGACY_STATE_ACCEPTED_UNTIL` (2026-11-15 06:00 UTC, a few hours after the deploy). During it, a callback with no state (old default-frontend login) or with an unbound login record (old listed-frontend login, record without `bound`) is still accepted. After it, both get `SESSION_EXPIRED`. It is a fixed moment rather than "15 min after start", so a later restart doesn't reopen it; remove the constant and its two uses in the next release. Files: `apps/gateway/src/auth/guards/google-oauth2.guard.ts`. Docs: `docs/architecture/flows/auth.md`, `docs/architecture/authorization.md`, `docs/operations.md`.
- **Deploy:** No env change. `BASE_URL` must be the frontend's public origin (it already must be for linking). Every Google login now needs the `oauth2_state` cookie on the callback, so a `BASE_URL` that points at another host would make every Google login fail with `SESSION_EXPIRED`. Locally (gateway :3000, frontend :6767 on localhost) it works because cookies ignore the port. Follow-up: delete `LEGACY_STATE_ACCEPTED_UNTIL` / `acceptsLegacyState` in the next release. The callback returns to the frontend the flow started on (`BASE_URL`, or a `GOOGLE_OAUTH_FRONTENDS` origin), so the share frontend's cookie comes back too.
- **Tests:** `apps/gateway/src/test/auth-gateway/google-oauth.spec.ts`: "default frontend login: BASE_URL callback and a state bound to the browser", "naming the default frontend is the same as omitting it", "listed frontend: its own callback, remembered in the bound state", "linking binds the state to the browser with a cookie", "default frontend login, with the Google name and email", "login with someone else's code and state is refused (login CSRF)", "transition: a pre-deploy login without a state is still accepted", "transition: a pre-deploy unbound listed-frontend state needs no cookie", "after the transition a missing or unbound state is refused". The existing callback and exchange tests now use bound states.

### S22: Refresh tokens were not rotated

- **Problem:** A refresh token stayed valid until `exp` (7 days) or a logout-all, however often it was used, so a stolen token kept working.
- **Fix:** Rotation with reuse detection in auth's Redis (auth already used Redis for `jwt:blacklist:user:*`).
  - **Token claims:** refresh tokens now carry `fam`, a family id, alongside `jti`. Each login, register or Google login starts a new family.
  - **Exchange:** `TokenService.rotateTokens` runs `SET auth:refresh:used:<jti> {family, successor, usedAtMs} EX <refresh lifetime> NX`. If the key was set, this is the first exchange: it issues the successor (new `jti`, same `fam`).
  - **Grace window:** if the same token comes back within `REFRESH_REUSE_GRACE_MS` (30 s), it gets the current member back. That member is re-signed with the same `jti`/`fam`, so concurrent tabs end up holding the same token.
  - **Reuse:** a later reuse sets `auth:refresh:family:<fam>:revoked` (TTL = refresh lifetime) and returns 401 "Refresh token reused". Every member of that family then gets 401 "Token has been revoked". Other sessions of the same user are untouched.
  - **Pre-deploy tokens** have no `fam`. The first exchange starts a family (stored in the used-jti record), so they work once, with the same grace and reuse behaviour as any other token.
  - **Contract:** `RefreshDto` gains `jti` and `family` (proto plus regenerated `libs/generated`). The gateway `JwtRefreshStrategy` requires `jti` (`refreshPayloadSchema`, `@server/utils`) and passes `jti`/`fam` to `Refresh`.
  - **Password change:** `Refresh` without `jti` issues a new pair in a new family. Only the gateway's re-login after a password change calls it that way.
  - **Revocation:** logout-all, password change and role changes still revoke by `iatMs` through ValidateRefresh. Logout still only clears cookies.
  - **Files:** `proto/auth.proto`, `libs/generated/src/auth.ts`, `libs/utils/src/types/payload.type.ts`, `apps/auth/src/app/services/token.service.ts`, `apps/auth/src/app/commands/auth.refresh.command.ts`, `apps/auth/src/app/commands/handlers/refresh.handler.ts`, `apps/auth/src/presentation/dtos/req/refresh-dto.req.dto.ts`, `apps/auth/src/presentation/controllers/auth.controller.ts`, `apps/gateway/src/auth-gateway/strategies/jwt-refresh.strategy.ts`, `apps/gateway/src/auth-gateway/auth.router.controller.ts`, `apps/gateway/src/types/authenticated-request.ts`.
  - **Docs:** `docs/architecture/flows/auth.md`, `docs/architecture/authorization.md`, `docs/operations.md`.
- **Deploy:** Nothing required, and no env change. Gateway and auth can go out in either order: a mixed pair simply doesn't rotate (the old gateway sends no `jti`, so new auth issues a new family; the old auth ignores the new fields). Existing sessions keep working, and each existing refresh token can be exchanged once. API clients that use `Authorization: Bearer` must store the new refresh token from every refresh; browsers do this through the cookie.
- **Tests:**
  - `apps/auth/src/test/app/services/token.service.spec.ts` ("TokenService refresh rotation"): "every login starts its own family", "a refresh issues a new refresh token in the same family", "the same token again within the grace window returns the current member (tabs)", "reuse after the grace window revokes the whole family", "a pre-rotation token (no family) works once and starts a family", "records each exchange for the refresh lifetime, once (SET NX EX)".
  - `apps/auth/src/test/app/commands/handlers/token-issuance.spec.ts`: "refresh rotates the presented refresh token", "refresh without a jti starts a new session (after a password change)".
  - `apps/gateway/src/test/auth-gateway/auth-cookies.spec.ts`: "refresh reads the refresh cookie and rotates both cookies" (asserts jti/family are forwarded), "refresh passes a pre-rotation token (no family) on, and refuses one without a jti".
  - `apps/gateway/src/test/throttle.spec.ts`: updated its guard stub.

### C24: No charset rule on usernames

- **Problem:** `RegisterMailDto.username` and `UpdateIdentityDto.username` only checked "not blank" and a maximum of 50 characters, so spaces, control characters, upper case and look-alike Unicode were accepted.
- **Fix:**
  - **Shared rule:** `USERNAME_PATTERN` = `^[a-z0-9._-]{3,30}$` plus `isValidUsername`, `USERNAME_MIN_LENGTH` / `USERNAME_MAX_LENGTH` and `USERNAME_RULE_MESSAGE` in `libs/utils/src/constants/username.const.ts`. It uses the same set and maximum as the usernames Google sign-up generates from the e-mail.
  - **Register:** the rule is applied in both the gateway and the auth `RegisterMailDto` (the gateway DTO also documents it in OpenAPI).
  - **Update:** both `UpdateIdentityDto`s keep "not blank / max 50", because they can't see the old value. `UpdateIdentityCommandHandler` applies the rule only when the username differs from the current one (400 otherwise), so a nonconforming username re-sent unchanged still saves.
  - **Google sign-up:** it now adds the random suffix when the e-mail local part is shorter than 3 characters (e.g. `ab` becomes `ab-1f2c`), so generated usernames match the rule. The UUID fallback (36 characters, used only when no e-mail is usable or 5 tries collide) still exceeds 30; it stays valid because it is never re-validated unless changed.
  - **Seed:** usernames in `apps/auth/prisma/seed.ts` (admin, demo, minh.nguyen, …) all match; the seed is untouched.
  - **Files:** `libs/utils/src/constants/{username.const.ts,index.ts}`, `apps/gateway/src/auth-gateway/dtos/req/{register-mail,update-identity}.req.dto.ts`, `apps/auth/src/presentation/dtos/req/{register-mail,update-identity}.req.dto.ts`, `apps/auth/src/app/commands/handlers/{update-identity,google-register-or-login}.handler.ts`. Docs: `docs/architecture/flows/auth.md`.
- **Deploy:** Nothing (no migration; existing usernames are kept). Frontend: `src/lib/username.ts` checks the same rule in the register form (`AuthForm.tsx`, input lowercased) and the profile dialog (`UserPage.tsx`, only when the username changes; the dialog used to pre-fill the e-mail's local part instead of the real username, so saving the profile tried to change it); `api-errors.ts` translates the backend message.
- **Tests:**
  - `libs/utils/src/constants/username.const.spec.ts` ("isValidUsername" accepts/refuses cases).
  - `apps/auth/src/test/presentation/dtos/req/username.req.dto.spec.ts`: "RegisterMailDto.username accepts/refuses", "UpdateIdentityDto.username accepts an existing nonconforming username (checked by the handler)", "still refuses a blank username".
  - `apps/gateway/src/test/auth-gateway/dtos/req/register-mail.req.dto.spec.ts`: "gateway RegisterMailDto.username accepts/refuses", "gateway UpdateIdentityDto.username lets an unchanged legacy username through".
  - `apps/auth/src/test/app/commands/handlers/update-identity.handler.spec.ts` ("UpdateIdentityCommandHandler username rule"): "a new username … outside [a-z0-9._-]{3,30} is 400", "a valid new username is saved", "re-sending an existing nonconforming username unchanged is accepted".
  - `apps/auth/src/test/app/commands/handlers/google-register-or-login.handler.spec.ts`: "pads a local part shorter than 3 characters with a suffix", "generated usernames follow the username rule".

### S25: A user banned from a room could still read its chat history

- **Problem:** `GET /api/v1/chat/rooms/:roomId/logs` had no requester in `GetChatLogRequest`, so any signed-in user, including one banned from the room, could read the room's full history.
- **Fix:** `proto/live.proto` `GetChatLogRequest.requester_id = 6` (regenerated `libs/generated/src/live.ts`). The gateway (`apps/gateway/src/live-gateway/live.router.controller.ts`) sets it from `req.user.sub`. Live `GetChatLogDto` requires it, and `ChatService.getChatLogsOf(roomId, requesterId, …)` checks `IRoomRepository.isBannedFrom` (a `banneds` row for `(roomId, uid)`, `room.prisma.repository.ts`) first. A banned requester gets 404 `Room not found`, and no history is read. Only the ban is checked; no visibility or membership rule was added.
- **Deploy:** deploy live and gateway together. A new gateway talking to an old live is harmless (the field is ignored). An old gateway talking to a new live fails validation (`requesterId` is required) with 400 until the gateway is updated. No env or schema change.
- **Frontend:** `ChatPage.tsx` shows "Phòng không tồn tại hoặc bạn đã bị cấm khỏi phòng này" on the 404 instead of only logging it.
- **Tests:** `apps/live/src/test/app/services/chat.service.chat-log.spec.ts`: a banned user gets 404 and the log repository is not called; a user who is not banned reads the history; the existing paging tests now pass a requester.

### C33: Withdrawing a flash card proposal left the owner's "waiting for review" notification behind

- **Problem:** `withdrawFlashCardProposal` published no event, so the list owner kept an unread "proposal waiting for your review" notification for a proposal that was no longer open.
- **Fix:** notification adds `FlashCardProposalWithdrawnHandler` (`apps/notification/src/app/events/handlers/flashcard-proposal-withdrawn.handler.ts`) on queue `notification.events.flashcard-proposal.withdrawn` (`defineConsumerQueue`, `@UseCls` + `@Transactional`, `unwrapEvent`, `InboxService.claim`, `validatePayload`; registered in `handlers/index.ts` and `configs/rmq.sub.config.ts`). It calls `NotificationService.deleteProposalNotifications(targetOwnerId, proposalId)`, which runs `deleteMany` where `recipientId`, `type = 'flashcard'` and `data.proposalId` (JSON path) match. The notification is **deleted** rather than marked read: its text ("đang chờ bạn xem xét") is no longer true and its link leads to a closed proposal, and deleting it also drops it from the unread count. Resource `ResourceEventsPublisher.flashCardProposalWithdrawn` writes `resource.flashcard-proposal.withdrawn { proposalId, targetListId, targetOwnerId, authorId }` to the outbox in the same `@Transactional()` withdraw (`apps/resource/src/app/services/flashcard-proposal.service.ts`). Nothing is pushed over SSE; the client sees the change on its next list fetch.
- **Deploy:** **notification first**, so its consumer queue exists and is bound to `eventbus`. Then resource. If resource goes first, the mandatory publish finds no route, the event stays in the outbox and trips `OutboxStuck`. No env or schema change.
- **Tests:** `apps/notification/src/test/app/events/handlers/flashcard-proposal.handlers.spec.ts`: deletes the owner's notification for that proposal, claims the inbox on the right queue, skips redeliveries and rejects malformed payloads. `apps/notification/src/test/app/services/notification.service.spec.ts`: the `deleteMany` filter. `apps/resource/src/test/app/services/flashcard-proposal.service.spec.ts`: a withdraw publishes the event with the right payload; a forbidden withdraw publishes nothing.

### C35: SSE delivered only on one replica, with no heartbeat or replay

- **Problem:** SSE fan-out used an in-process `EventEmitter2`/`Subject`, so with more than one notification replica, clients connected to another replica missed notifications. There was no heartbeat, so proxies could cut idle streams. There was no event `id` and no `Last-Event-ID` replay, so a client that reconnected lost what was sent while it was away. Nest also held the response headers until the first event.
- **Fix:** `apps/notification/src/app/services/notification-sse.service.ts` now publishes each push on Redis channel `notification:sse` through `ioredis` (already a root dependency; one publisher connection and one subscriber connection). Every replica, the sender included, forwards the push to its own streams for that recipient. If the publish fails, the push is delivered to the local streams and the error is logged. Each event is `event: notification`, `id: <notification id>`, `data: <notification JSON>`. A comment `: ping` goes out when the stream opens (so the headers are sent at once) and then every 25 s. On reconnect, `NotificationSseController` reads `Last-Event-ID` and `NotificationService.listMissed(recipientId, lastId)` returns the notifications stored after that id: only that recipient's own, the newest 100 at most, oldest first. An unknown or foreign id replays nothing. These go out before any live push; live pushes that arrive during the query are held, then sent unless the replay already had them. A failed replay query is logged and the stream goes live. `EventEmitterModule` was removed from `notification.module.ts`. Config: `redis { host, port }` was added to the zod schema and `loadEnv` (`REDIS_HOST`, `REDIS_PORT`) and to `apps/notification/.env.example`. The gateway proxy (`http-proxy-middleware`) already forwards `Last-Event-ID`.
- **Deploy:** notification now **requires** `REDIS_HOST`/`REDIS_PORT` (zod fails fast without them), so add them to every real `apps/notification/.env` (local: `localhost` / `6380`). Docker needs no change: notification already reads `.env.services` (which has `REDIS_HOST=redis`, `REDIS_PORT=6379`) and already `depends_on: redis`. No schema change.
- **Frontend:** none today: the frontend polls `GET /notifications` every 30 s and doesn't open the stream.
- **Tests:** `apps/notification/src/test/app/services/notification-sse.service.spec.ts` uses an in-memory Redis shared by two "replicas". It covers: a push from one replica reaches a stream on the other, with id = notification id, and not other recipients; the local fallback when publish fails; the heartbeat at 0 s and every 25 s; replay first, then held live pushes without duplicates; going live after a failed replay; ignoring malformed channel messages. `notification.service.spec.ts` covers `listMissed`: a foreign or unknown id replays nothing, and the query is newest 100 after the anchor, returned oldest first. `apps/notification/src/test/presentation/controllers/notification-sse.controller.spec.ts` checks that `Last-Event-ID` is trimmed and used, and that a blank or missing header means no replay.

### C37: Forum quote notifications shared the blog comment reply switch and type

- **Problem:** A forum quote notification used the `commentReply` preference and type `comment_reply`, both shared with blog comment replies, so forum quotes could not be muted separately.
- **Fix:** a new `forumQuoteEnabled` preference (`forum_quote_enabled`, default true) in `apps/notification/prisma/schema/notification.prisma`. It was added to `proto/notification.proto` (`NotificationPreferencesResponse.forum_quote_enabled = 12`, `UpdatePreferencesRequest.forum_quote_enabled = 10`, regenerated), to the read model, input type, service and DTOs in notification, and to the gateway DTOs and controller (`apps/gateway/src/notification-gateway/…`). `'forumQuote'` was added to `OptionalNotificationType`. `forum-reply-created.handler.ts` now gates the quoted author on `forumQuote` and creates type `forum_quote`, titled "Có người trích dẫn trả lời của bạn". The `commentReplyEnabled` descriptions now say "reply to my blog comment" only.
- **Deploy:** `prisma db push` for notification (it has no migrations folder; `nx run notification:prisma:push`). Deploy notification before or together with the gateway. Existing rows get `true`.
- **Frontend:** `SettingsPage.tsx` has the "Trích dẫn trong diễn đàn" switch (`NotificationService.ts` `forumQuoteEnabled`); `forum_quote` has its own icon and label in `NotificationDropdown.tsx` / `NotificationPage.tsx` (`NotificationType.ForumQuote`).
- **Tests:** `discussion-notifications.spec.ts`: a quoted author gets `forum_quote` through the `forumQuote` switch, and one who muted it is skipped while the thread author is still notified. `apps/gateway/src/test/notification-gateway/notification.router.controller.spec.ts`: the switch is forwarded.

### C38: Flash card proposal notifications could not be turned off

- **Problem:** The flash card proposal handlers skipped the preference check; there was no flash card preference.
- **Fix:** a new `flashcardEnabled` preference (`flashcard_enabled`, default true), wired the same way as C37 (proto fields 13 / 11). `'flashcard'` was added to `OptionalNotificationType`. `FlashCardProposalCreatedHandler` checks it for the list owner, and `FlashCardProposalDecidedHandler` checks it for the proposer (both now inject `NotificationPreferencesService`).
- **Deploy:** `prisma db push` for notification (same push as C37). Existing rows get `true`.
- **Frontend:** `SettingsPage.tsx` has the "Đề xuất bộ thẻ" switch (`flashcardEnabled`).
- **Tests:** `flashcard-proposal.handlers.spec.ts`: an owner or a proposer who turned it off gets nothing, and `isEnabled` is called with `'flashcard'`. The gateway spec forwards `flashcardEnabled`.

### C39: The forum reply deep link assumed the frontend's page size

- **Problem:** `forum-reply-created.handler.ts` worked out `?page=N` with a `REPLIES_PER_PAGE = 20` copied from the frontend, so changing the frontend page size would silently break the links.
- **Fix:** `forumReplyAction(threadId, replyId)` now returns `/forum/thread/<threadId>?reply=<replyId>`, with no `#reply-` fragment and no page. The notification `data` is now `{ threadId, replyId, position, action }` (`position` is the reply's 1-based position, oldest first, at the time it was created). The constant was removed.
- **Deploy:** notification only. Notifications already stored keep their old `?page=N#reply-<id>` links, which the frontend still handles.
- **Tests:** `discussion-notifications.spec.ts`: the exact `data` shape and the id encoding in the link.

### S23: rate limits were counted per gateway process

- **Problem:** the throttler had no `storage`, so its counters were in memory: with N gateway replicas every limit (including 10 logins/min) was N times higher, and every restart or deploy reset them.
- **Fix:** `RedisThrottlerStorage` (`apps/gateway/src/throttle-storage.ts`, registered through `ThrottlerModule.forRootAsync` in `gateway.module.ts`) keeps the counters in Redis with one Lua script per hit (fixed window `throttle:<key>:hits`, block marker `throttle:<key>:block`; going over the limit blocks for the block duration, then counting starts afresh). No new dependency: it uses `ioredis`, already installed, on its own connection with no offline queue and a 500 ms command timeout. **Fails open:** while Redis is unreachable it counts in memory (the throttler's own `ThrottlerStorageService`, so limits apply per process as before) and logs one warning, and one info line when Redis is back.
- **Deploy:** nothing; it uses the gateway's existing `REDIS_HOST`/`REDIS_PORT`.
- **Tests:** `apps/gateway/src/test/throttle-storage.spec.ts` (Redis result mapping, blocks, fallback while Redis is down, recovery). The Lua script was also run against the real Redis (limit 3: hits 1–3 pass, the 4th blocks, counting restarts after the block).

### C40: a late `file.added` could find its file deleted

- **Problem:** the orphan cleanup deleted files with `ref_count 0` untouched for 1 h. A file uploaded more than an hour before the form that uses it was saved (or whose `file.added` was retried for a while) could be gone when the reference arrived; `incrementRef` then updated 0 rows silently and auth/exam kept a dangling id.
- **Fix:** `MIN_ORPHAN_AGE_MS` is 24 h (`apps/file-service/src/infra/jobs/orphan-cleanup.job.ts`), so abandoned uploads are kept a day longer. `incrementRef` returns the number of rows it updated (`file.repository.ts`, `file.prisma.repository.impl.ts`), and `FileAddedHandler` logs `file.added for unknown file <id>; the reference is dangling` when it is 0.
- **Deploy:** nothing; files already waiting are simply kept longer.
- **Tests:** `apps/file-service/src/test/infra/jobs/orphan-cleanup.job.spec.ts` ("only considers files untouched for at least 24 hours"), `apps/file-service/src/test/app/events/handlers/file-added.handler.spec.ts`.

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
- Accepted proposals copy the proposer's `image` into the owner's card: `image` is a free URL string (the frontend form says "đường dẫn" and renders it only if it matches `^https?://`), not a file-service id, so there is nothing to ownership-check or reference-count. (resource) (Since then card images are file-service files and accepted proposals never change a card's image; see "Flash card images in file-service" at the top.)
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
