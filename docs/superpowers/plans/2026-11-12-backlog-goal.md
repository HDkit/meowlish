# Backlog Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry out the decisions in `goal.md` against `docs/backlog.md`:

- the S-series security items;
- the C-series correctness items;
- JWTs in HttpOnly cookies;
- limited exponential-backoff retries for RabbitMQ consumers;
- the matching frontend changes in `../meowlish-fe`.

**Architecture:** Each item is fixed inside the service that owns the data, following AGENTS.md:

- ownership and visibility checks live in the service;
- the gateway forwards identity from the JWT, never from client input;
- events go through `@server/messaging`.

Retries are added to `@server/messaging` as per-queue delay queues that route back only to the failing queue. Cookie auth is handled in the gateway (set/clear cookies; extract the cookie first, then fall back to the `Authorization` header) and in live's socket handshake.

**Tech Stack:** NestJS 11, Nx, pnpm, Prisma 6, PostgreSQL, RabbitMQ (`@golevelup/nestjs-rabbitmq`), MinIO, Jest; frontend Next.js/React (`../meowlish-fe`).

**Spec:** `/home/culove/meowlish/goal.md` (the user's decisions), together with `docs/backlog.md` (problem statements) and `AGENTS.md` (conventions). The hybrid-authorization design (`docs/superpowers/specs/2026-11-12-hybrid-authorization-design.md`) remains the target architecture.

## Global Constraints

- **Decisions verbatim from goal.md:**
  - S1 is deleted from the backlog.
  - S2: only the creator or an admin may modify an exam, including its sections and questions.
  - S3: changing a password asks for the current password, and the frontend implements it.
  - S4: record the uploader ID on files. Avatars are NOT private: anyone may view them.
  - S5 and S6 go ahead, with the seed files updated.
  - S7, S8, S9, S10, S11, S12 and S14 go ahead.
  - S13: the details endpoints stay public. This is a practice site.
  - C8: store tags by ID.
  - C10: fine, ignore.
  - C11: Restate repo-wide is being considered. Write the design and plan only; no migration in this plan.
  - C13: use UTC.
  - RabbitMQ retries use limited exponential backoff.
  - Auth returns the JWT with Set-Cookie instead of in the body, and extracts the JWT from the cookie before falling back to the `Authorization` header.
- **Retry policy:**
  - max **5** attempts, delays **1 s, 2 s, 4 s, 8 s, 16 s**;
  - capped at **60 s**;
  - after the last attempt, dead-letter to `<q>.dlq` (existing `eventbus.dlx`).
  - A retry must only redeliver to the failing queue, never back through `eventbus` (fixes C15).
- **Cookies:**
  - access token in `access_token`, refresh token in `refresh_token`;
  - `HttpOnly`, `Secure` when the request is HTTPS or `NODE_ENV=production`, `SameSite=Lax`;
  - `Path=/` for access;
  - refresh restricted to `Path=/api/v1/auth`;
  - `Max-Age` matches the token TTLs from auth config.
  - Logout clears both.
- **CORS:** the gateway allows only the origins in `CORS_ORIGINS` (comma-separated env, documented in `.env.example`), with `credentials: true`. live's socket.io CORS uses the same list.
- **Proto changes are additive.** Removed fields are `reserved`. Regenerate with `pnpm proto:gen` and commit `libs/generated`.
- **Database changes:**
  - additive migrations, created with `prisma migrate dev --create-only`, inspected, then applied with `migrate deploy`;
  - `db push` for services without migrations;
  - never reset, never `--accept-data-loss`.
  - The local DB is the `meowlish-db-1` container on host port 5434.
- **Never stop, restart or recreate the user's docker containers, or modify the RabbitMQ broker.**
- **Every task ends green on** `pnpm exec nx run-many -t lint test build` (backend) or `npm run build && npm test` (frontend), and deletes the backlog rows it fixes in the same commit.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage the unrelated `.gitignore` change.
- **Frontend work** happens on a new branch `feat/backlog-goal` in `../meowlish-fe` (it is currently on `main`).

## Review Focus

- **Cookie auth with an old frontend** that still sends `Authorization: Bearer` must keep working (header fallback). _Task 9: `accepts a bearer header when no cookie is present`._
- **An admin editing another creator's exam** must succeed; a mod editing someone else's must be 403. _Task 1 tests._
- **A poison message** is retried exactly 5 times with growing delays, then lands in `<q>.dlq`, and is never redelivered to other subscribers of the same routing key. _Task 10: `retries go only to the failing queue` and `dead-letters after max attempts`._
- **Wrong current password** must be 401, and must not revoke sessions. _Task 2._
- **A user setting an avatar to a file they didn't upload** must be 403. Viewing anyone's avatar URL keeps working. _Task 3._

---

### Task 1: S2 — only the creator or an admin modifies exam content

**Files:**

- `proto/exam.proto`: add `requester_id` / `privileged` to the management mutating messages for exams, sections, questions, moves and files.
- `libs/generated`
- exam management controller and handlers (`apps/exam/src/...`)
- gateway `exam-management.router.controller.ts`: use `requesterOf(req.user, [Role.Admin])`; drop the section/question-level `@HasRoles` gate in favour of the service check. Keep `@HasRoles(Mod, Admin)` on create-exam.

**Rule:** a mutation is allowed if `exam.createdBy === requesterId || privileged` (admin). Otherwise the service returns 403, or 404 when the exam doesn't exist.

- [ ] Write tests: `creator can edit sections`, `admin can edit another creator's question`, `mod cannot edit another mod's exam (403)`.
- [ ] Implement, regenerate the protos, then run lint/test/build.
- [ ] Delete S2 from the backlog and commit.

### Task 2: S3 — require the current password (backend)

**Files:** `proto/auth.proto` (`UpdateMailPasswordDto` gets `current_password`), libs/generated, the auth `update-password` handler, the gateway `UpdatePasswordDto` (`currentPassword` required, `@IsString @MinLength(1)`).

- [ ] Write tests: `wrong current password is 401 and keeps sessions`, `correct current password updates and revokes sessions`.
- [ ] Implement with async `bcrypt.compare`. Commit.

### Task 3: S4 — uploader on file rows, enforced on attach

**Files:**

- file-service schema: a `uploadedBy String?` column with an index, plus a migration;
- the presign-upload RPC records `uploadedBy` from the gateway-forwarded user;
- a new RPC `CheckFilesOwnedBy(fileIds, userId) → { ok, foreignIds }`.

Callers check before attaching:

- the auth identity `avatarId`;
- exam `addFiles`, section and question files;
- resource report files.

Public viewing is unchanged: avatars and other public files are still signed for anyone.

- [ ] Write tests: `setting an avatar to someone else's file is 403`, `viewing any avatar URL still works`, `exam addFiles rejects foreign files`.
- [ ] Implement, migrate, commit.

### Task 4: S5 + S6 — short-lived upload URLs, no overwrite, `isSystem`

**Files:** file-service `file.service.ts` (presigned PUT expiry **15 min**; each presign gets a fresh server-generated key, so a reviewed object is never re-issued), the schema (`isSystem Boolean @default(false)` plus a migration), orphan cleanup (skip `isSystem`, not the name prefix), and **seed files** that mark system files `isSystem: true` (`apps/file-service/prisma/seed*`, plus any seed that creates `SYSTEM_*` files).

- [ ] Write tests for the expiry value, cleanup skipping `isSystem` while removing a user file named `SYSTEM_x`, and seeds setting `isSystem`.
- [ ] Implement, migrate, commit.

### Task 5: S7 + S8 + S11 — auth token issuance

- **S7:** mail login, Google login, refresh and validate-refresh refuse locked identities (403 "Account locked") and don't publish the login event.
- **S8:** one generic `Invalid email or password` (401) for an unknown email or a wrong password; `await bcrypt.compare`.
- **S11:** revocation compares in milliseconds. Store `revokedAt` in ms, and treat a token as revoked if `iat * 1000 <= revokedAt`, or use a `jti`/`iat` in ms. Keep validation consistent across access and refresh.
- [ ] Write tests for each, implement, commit.

### Task 6: S9 — Google Calendar tokens stay server-side

The gateway and auth Google Calendar `connect`/`token` routes no longer return the refresh token. Auth stores it. `GET .../google/calendar/token` returns only a short-lived access token (refreshing server-side when expired) plus its expiry. Responses use `@ApiResponseEntity`/`@SerializeOptions`, which also fixes that convention line.

- [ ] Write tests, implement, commit.

### Task 7: S10 — throttling, CORS, message size

- Enable `ThrottlerModule` and a global `ThrottlerGuard` in the gateway: a default of **100 req/min/IP**, and **10/min** on login, register, refresh and password routes.
- CORS is restricted to `CORS_ORIGINS` (see the Global Constraints), in the gateway and in live's socket.io.
- The chat message DTO gets `@MaxLength(2000)`.
- [ ] Write tests (a throttled login returns 429 after the limit; the CORS origin check), implement, commit.

### Task 8: S12 — ban/unban only by the room owner or an admin

Use the same pattern as Task 1. Forward the requester to live's ban/unban; allow when `room owner === requester || privileged (admin)`. Room ownership: live has no owner column, so add `createdBy` to the `Room` model (db push), backfill from the authorization ownership rows in the live seed/backfill script, and set it on create.

- [ ] Write tests, implement, commit.

### Task 9: Cookie-based JWT (backend), which also resolves S14

- **Login, Google token exchange and refresh:** set `access_token` / `refresh_token` cookies (per the Global Constraints). The response body no longer contains the tokens: `data` is `null`, or `{ expiresAt }`.
- **Logout and logout-all:** clear both cookies.
- **JWT strategies:** an extractor reads the `access_token` cookie, then the `Authorization: Bearer` header. The refresh strategy reads the `refresh_token` cookie, then the header.
- **live sockets:** the handshake also reads the `access_token` cookie (via `socket.handshake.headers.cookie`).
- **S14:** with the cookie, a top-level navigation to `/api/v1/auth/credentials/google` carries the session, so the linking flow works cross-origin when the frontend navigates there. Document this.
- Add `cookie-parser` (or parse manually).
- [ ] Write tests: `login sets HttpOnly cookies and omits tokens from the body`, `accepts a bearer header when no cookie is present`, `prefers the cookie over the header`, `logout clears cookies`, `socket accepts the cookie`.
- [ ] Implement, delete S14 from the backlog, commit.

### Task 10: Limited exponential-backoff retries in `@server/messaging` (fixes C15)

- `deadLetterQueue(queue, { maxAttempts = 5, baseDelayMs = 1000, maxDelayMs = 60000 })`.
- **The error handler:** if `x-retry-count < maxAttempts`, republish the original message to the default exchange `""`, routing key `<q>.retry`, with `expiration = min(base * 2^n, max)` and header `x-retry-count = n + 1`, then ack the original. Otherwise nack without requeue, so it goes to `<q>.dlq`. `consumer_failures_total` is counted on every failure.
- **`dlqQueueConfig`** also declares `<q>.retry`: durable, `x-dead-letter-exchange: ''`, `x-dead-letter-routing-key: <q>`. An expired message therefore goes back only to `<q>`.
- **Migrate exam writing-scored** to this mechanism, and remove the `exam.retry` exchange/queues that dead-letter back to `eventbus`.
- **Docs:** add each new `<q>.retry` queue to the one-time upgrade notes. These are new queues, so no recreation is needed.
- [ ] Write tests: `retries go only to the failing queue`, `delays grow 1,2,4,8,16 s capped at 60 s`, `dead-letters after max attempts`.
- [ ] Implement, commit.

### Task 11: C3 + C16 — badge-earned events and notification preference routes

- **C3:** when achievement awards a badge, publish `achievement.badge.earned { uid, badgeName }` through the outbox, inside the award transaction. Set `relay: true` for achievement.
- **C16:** the gateway gets `GET /notifications/preferences` and `PATCH /notifications/preferences`, with `identityId` from the JWT and a query/body DTO.
- [ ] Write tests, implement, commit.

### Task 12: Exam correctness — C4, C5, C9, C14

- **C4:** add a `version Int @default(0)` column to `Attempt`. `save` does a conditional update on the version, and EndAttempt is idempotent: a second submit is a no-op and doesn't publish twice.
- **C5:** a migration changes `ScorerData.response` to `ON DELETE CASCADE`.
- **C9:** writing answers count towards the score once AI feedback (`ScorerData`) has given points. Recompute the score when `writing.scored` is saved.
- **C14:**
  - validate `duration > 0` on create and update;
  - allow `points = 0`;
  - enforce the single-correct-choice rule on choice updates.
- [ ] Write tests for each, implement, migrate, commit.

### Task 13: Exam correctness — C6, C7, C8

- **C6:** fix the off-by-one in move-to-lower-index and insert-at-index for sections and questions.
- **C7:** fix backward pagination, and filter `updatedTimeRange` on `updatedAt`.
- **C8:** store section and question tags by ID, like exams. Add a migration that maps the existing name rows to IDs, and update the seed files.
- [ ] Write tests for each (including the move and insert index tables), implement, commit.

### Task 14: C1 + C12 + C13 — achievement and file-service correctness

- **C1:** with Task 10's retries (5 attempts with backoff) on top of the in-handler conflict retry, version races no longer dead-letter in practice. Also set the achievement consumer queues to `prefetch: 1`, which serialises per instance. Close C1.
- **C12:** file-service validates the upload request **before** inserting. Cleanup deletes the bucket objects first, then the rows. Orphan cleanup skips files younger than **1 h**, and re-checks `refCount = 0` within the deleting transaction.
- **C13:** compute login streak days in **UTC** (`YYYY-MM-DD` of the UTC date). Fix the one-day-late streak: the first login counts as day 1, and consecutive days increment.
- [ ] Write tests (streak table across UTC midnight; cleanup ordering and the age guard), implement, commit.

### Task 15: Frontend (`../meowlish-fe`, branch `feat/backlog-goal`)

- **S3:** the change-password form gains a "Current password" field and sends `currentPassword`.
- **Cookie auth:**
  - API calls use `credentials: 'include'`;
  - stop storing tokens in localStorage/state;
  - the session is detected via `GET /auth/my/identity`;
  - refresh calls `POST /auth/refresh` with cookies;
  - logout calls the logout endpoint.
  - The Google callback page no longer exchanges and stores tokens; it calls the exchange endpoint, which now sets cookies.
- **S14:** "Link Google" does a top-level navigation (`window.location.href = <api>/api/v1/auth/credentials/google`) instead of fetch.
- [ ] Update or add tests, `npm run build && npm test`, commit on `feat/backlog-goal`.

### Task 16: C11 Restate design + docs cleanup

- Write `docs/superpowers/specs/2026-11-12-restate-adoption-design.md`. It covers:
  - what moves to Restate (durable sagas: authorization sensitive operations, exam scoring after EndAttempt, file cleanup), and what stays on outbox + RabbitMQ;
  - deployment (Restate server in compose, service endpoints, registration);
  - the migration order and observability;
  - the trade-offs against the just-built outbox, with a recommendation.
- Make no code changes for Restate.
- **Backlog:**
  - delete S1;
  - mark S13 and C10 as by-design (delete them, with a note in the commit message);
  - ensure every row fixed by Tasks 1–14 is gone, along with the convention lines Task 6 fixed.
- Update `AGENTS.md` and `docs/architecture/authorization.md` for the new requester pattern on exam/live, cookie auth and retries.
- [ ] Commit.
