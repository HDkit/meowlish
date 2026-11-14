# Fixed issues

What was fixed from [`backlog.md`](backlog.md), and how. Newest first. Each entry says what was wrong, what changed (files), what it means for running systems, and how it is tested. The backlog row is deleted in the same commit as the fix.

## November 2026

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
