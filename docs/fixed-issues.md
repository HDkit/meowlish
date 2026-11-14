# Fixed issues

What was fixed from [`backlog.md`](backlog.md), and how. Newest first. Each entry says what was wrong, what changed (files), what it means for running systems, and how it is tested. The backlog row is deleted in the same commit as the fix.

## November 2026

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
