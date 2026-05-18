# Full-Stack API Audit Report

**Date:** 2026-05-25  
**Backend:** `/home/culove/server` (NX monorepo, NestJS microservices)  
**Frontend:** `/home/culove/english-prep` (Next.js)  
**Tested as:** `admin@gmail.com` (role: admin)

---

## Table of Contents
1. [Critical Security Issues](#1-critical-security-issues)
2. [Backend API Bugs](#2-backend-api-bugs)
3. [Frontend-Backend Mismatches](#3-frontend-backend-mismatches)
4. [Configuration Issues](#4-configuration-issues)
5. [Code Logic Bugs](#5-code-logic-bugs)
6. [API Endpoint Test Results](#6-api-endpoint-test-results)
7. [Recommendations](#7-recommendations)

---

## 1. Critical Security Issues

### 1.1 [CRITICAL] WebSocket Proxy: No JWT Signature Verification
**File:** `apps/gateway/src/live-ws-gateway/live-ws.router.controller.ts:35`

The WebSocket proxy extracts the user ID from the JWT by **base64-decoding only** — it never verifies the JWT signature:
```ts
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
proxyReq.setHeader('Authorization', payload.sub);
```
**Impact:** Any attacker can forge a JWT with any `sub` claim and impersonate any user in the chat system. They just need to base64-encode a payload with any user ID — no secret key needed.

**Additionally**, the entire WS proxy controller is decorated `@IsPublic()` (line 10), bypassing JWT auth entirely.

**Fix:** Verify the JWT signature using the same secret, or delegate to the JwtAuthGuard before proxying.

---

### 1.2 [CRITICAL] Exam Practice Endpoints: No Attempt Ownership Verification
**File:** `apps/gateway/src/exam-gateway/exam-practice.router.controller.ts:64-126`

The following endpoints accept an `attemptId` parameter but **never verify that the attempt belongs to the requesting user**:

| Endpoint | Line | Impact |
|----------|------|--------|
| `POST /attempt/:id/submit` | 64-70 | Any user can submit another user's exam |
| `POST /attempt/:id/answers/:qId` | 72-82 | Any user can answer in another's attempt |
| `DELETE /attempt/:id/answers/:qId` | 84-98 | Any user can delete another's answers |
| `PATCH /attempt/:id/answers/:qId/flag` | 100-110 | Any user can flag questions in another's attempt |
| `PATCH /attempt/:id/answers/:qId/note` | 112-126 | Any user can add notes to another's attempt |
| `GET /attempt/:id/saved` | 168-175 | Any user can view another's saved attempt |
| `GET /attempt/:id/review` | 177-184 | Any user can view another's attempt review |

The gateway controller does not pass `req.user.sub` to the gRPC service for any of these calls. The backend exam service handlers (`AnswerHandler`, `EndAttemptHandler`, etc.) also do not verify ownership.

**Fix:** Pass `req.user.sub` to each gRPC call and verify `attempt.attemptedBy === userId` in the handlers.

---

### 1.3 [HIGH] Notification Endpoints: No Ownership Checks
**File:** `apps/gateway/src/notification-gateway/notification.router.controller.ts`

| Endpoint | Line | Issue |
|----------|------|-------|
| `GET /:id` | 75-81 | Any user can read any notification by ID |
| `DELETE /:id` | 83-88 | Any user can delete any notification |
| `PATCH /:id/read` | 104-108 | Any user can mark any notification as read |
| `ALL /stream/:recipientId` | 58-67 | Any user can subscribe to any other user's notification SSE stream |
| `POST /` | 69-73 | Any authenticated user can create notifications for any recipient (no role check) |

**Fix:** Verify `notification.recipientId === req.user.sub` for read/delete/markAsRead. Validate `recipientId` matches the auth user for SSE. Add role check for notification creation.

---

### 1.4 [HIGH] Resource CRUD: No Ownership/Role Checks for Update and Delete
**File:** `apps/gateway/src/resource-gateway/resource.router.controller.ts`

Update and delete endpoints for blogs, flash cards, flash card lists, and reports have **no ownership verification and no role requirement**. Any authenticated user can modify or delete any other user's resources:

- `PATCH /blogs/:id` (line 68-72)
- `DELETE /blogs/:id` (line 74-79)
- `PATCH /flash-cards/:id` (line 110-117)
- `DELETE /flash-cards/:id` (line 119-124)
- `PATCH /flash-card-lists/:id` (line 160-167)
- `DELETE /flash-card-lists/:id` (line 169-174)
- `PATCH /reports/:id` (line 241-245)
- `DELETE /reports/:id` (line 247-252)

**Fix:** Either add `@HasRoles(Role.Admin, Role.Mod)` to mutating endpoints, or pass the user's ID and verify ownership in the service layer.

---

### 1.5 [HIGH] JWT Access Token Expiration: 3.47 Days Instead of 5 Minutes
**File:** `apps/auth/.env` and `apps/gateway/.env`

```
JWT_ACCESS_TOKEN_EXPIRATION=300000
JWT_REFRESH_TOKEN_EXPIRATION=86400000
```

The JWT `signOptions.expiresIn` parameter in `jsonwebtoken` interprets numeric values as **seconds**. The values were likely intended as **milliseconds** (300000ms = 5min, 86400000ms = 1 day), but are being interpreted as:

- **Access token:** 300,000 seconds ≈ **3.47 days** (intended: 5 minutes)
- **Refresh token:** 86,400,000 seconds ≈ **1,000 days / 2.7 years** (intended: 1 day)

This is confirmed by the decoded JWT: `exp - iat = 300000`.

Meanwhile, other services (exam, file-service, achievement) have `300` and `86400`, which are correct in seconds.

**Fix:** Change values in `apps/auth/.env` and `apps/gateway/.env`:
```
JWT_ACCESS_TOKEN_EXPIRATION=300
JWT_REFRESH_TOKEN_EXPIRATION=86400
```

---

## 2. Backend API Bugs

### 2.1 [BUG] Chat Messages Not Persisted to Database
**File:** `apps/live/src/app/services/chat.gateway.ts:76-79`

The `chat` event handler only broadcasts messages via Socket.IO but never saves them to the database:
```ts
handlePing(@MessageBody() data: ChatDto, @ConnectedSocket() socket: ModifiedSocket): void {
    if (!socket.rooms.has(data.roomId))
        throw new ForbiddenException('You need to join the room before sending a message');
    socket.to(data.roomId).emit('message', { message: data.message, uid: socket.data.uid });
}
```

The Prisma schema defines a `Log` model for chat messages, but it's never written to. Chat history fetched via `GET /rooms/:roomId/logs` will never contain real-time messages sent through WebSocket.

**Fix:** Inject the log repository and persist each message before broadcasting.

---

### 2.2 [BUG] Chat WebSocket Event Field Name Mismatch
**Backend emits** (`chat.gateway.ts:79`):
```ts
socket.to(data.roomId).emit('message', { message: data.message, uid: socket.data.uid });
```
Emits: `{ message, uid }`

**Frontend expects** (`ChatPage.tsx:233`):
```ts
socket.on('message', (data: { id: string; fromId: string; message: string; createdAt: string }) => {
```
Expects: `{ id, fromId, message, createdAt }`

**Impact:**
- `data.fromId` is `undefined` → user hydration never triggers, all messages show "Ẩn danh" (Anonymous)
- `data.id` is `undefined` → messages have no ID
- `data.createdAt` is `undefined` → `new Date(undefined).getTime()` returns `NaN` → time display broken

**Fix:** Backend should emit `{ id: uuid, fromId: socket.data.uid, message: data.message, createdAt: new Date().toISOString() }`.

---

### 2.3 [BUG] Resource Controller Uses `Record<string, any>` for Request Bodies
**File:** `apps/gateway/src/resource-gateway/resource.router.controller.ts`

Multiple endpoints use `@Body() body: Record<string, any>` (lines 56, 70, 98, 114, 148, 164), which completely bypasses NestJS validation pipes. Any arbitrary JSON is passed through to the gRPC service:
```ts
createBlog(@Req() req: AuthenticatedRequest, @Body() body: Record<string, any>) {
```

**Fix:** Define proper DTO classes with `class-validator` decorators for each endpoint.

---

### 2.4 [BUG] AttemptEvaluator: Score Accumulation Bug
**File:** `apps/exam/src/domain/entities/attempt-evaluator.entity.ts:62-77`

The `evaluateScore()` method uses `+=` to accumulate `score` and `totalPoints`:
```ts
public evaluateScore(): void {
    this.questions.forEach(question => {
        this.totalPoints += question.points;
        // ...
        this.score += this.scoreFor(question, response);
    });
}
```

If the constructor receives non-zero `score` or `totalPoints` values, and `evaluateScore()` is called, scores will be double-counted. The method should reset both to 0 before accumulating:
```ts
this.score = 0;
this.totalPoints = 0;
```

---

## 3. Frontend-Backend Mismatches

### 3.1 [BUG] UserPage.tsx: Raw Fetch Missing Auth Header
**File:** `english-prep/src/components/UserPage.tsx:112`

```ts
fetch('/api/v1/exams/goals/my')
```

This raw `fetch` call does NOT include an Authorization header. The backend `GET /my` endpoint in `GoalGatewayController` requires JWT authentication. The goal fetch silently fails with 401 and falls back to `setGoal(null)`.

**Fix:** Use `GoalsService.goalGatewayControllerGetGoalV1()` from the generated API client instead.

---

### 3.2 [MINOR] Notification API: Frontend Sends Ignored Parameters

| Frontend Method | Sends | Backend Uses | Impact |
|----------------|-------|--------------|--------|
| `listNotifications` | `recipientId` query param | `req.user.sub` | Parameter silently ignored |
| `markAllAsRead` | `recipientId` in body | `req.user.sub` | Parameter silently ignored |

Not a breaking bug, but misleading. The frontend should remove these parameters, or the backend should accept them for consistency.

---

### 3.3 [MINOR] Frontend Sends `authorId`/`reportedBy` That Backend Overrides

For `createBlog`, `createFlashCard`, `createFlashCardList`, and `createReport`, the frontend sends `authorId`/`reportedBy` in the body, but the backend always overrides with `req.user.sub`. The fields in the frontend's OpenAPI types are misleading.

---

### 3.4 [INFO] Backend Endpoints Missing from Frontend

| Backend Endpoint | Description |
|-----------------|-------------|
| `POST /api/v1/notifications` | Create notification (backend only) |
| `ALL /api/v1/notifications/stream/:recipientId` | SSE notification stream |
| `GET /api/v1/auth/google/callback` | OAuth callback (redirect-based) |
| Notification Preferences gRPC service | `GetPreferences`, `UpdatePreferences` — no gateway route yet |

---

## 4. Configuration Issues

### 4.1 [WARN] JWT Expiration Inconsistency Across Services

| Service | Access Token | Refresh Token | Unit |
|---------|-------------|--------------|------|
| auth | 300000 | 86400000 | treated as seconds (WRONG) |
| gateway | 300000 | 86400000 | treated as seconds (WRONG) |
| exam | 300 | 86400 | seconds (correct) |
| file-service | 300 | 86400 | seconds (correct) |
| achievement | 300 | 86400 | seconds (correct) |

Only the auth service generates JWTs, so only auth+gateway matter. The other services' values are unused remnants.

---

### 4.2 [WARN] WebSocket Gateway CORS: `origin: '*'`
**File:** `apps/live/src/app/services/chat.gateway.ts:33`

The WebSocket gateway accepts connections from ANY origin. Combined with the JWT bypass (issue 1.1), this is a cross-origin attack surface.

---

## 5. Code Logic Bugs

### 5.1 [BUG] Exam Practice `addNote` and `toggleFlag`: No Time Limit Check

**File:** `apps/exam/src/domain/entities/attempt.entity.ts`

`addNote()` (line 167) does NOT call `this.assertModifiable(new Date())`. Users can add notes to questions even after the exam time has expired and after submission:
```ts
public addNote(questionId: string, note: string): void {
    // Missing: this.assertModifiable(new Date());
    const existingResponse = this.responses.find(r => r.questionId === questionId);
```

Similarly, `toggleFlag()` (line 186) does NOT call `this.assertModifiable()`. Flags can be toggled after time expiry.

While notes and flags don't affect scoring, this is inconsistent with the design intent — `answer()` and `deleteAnswer()` both enforce time limits.

---

### 5.2 [INFO] Chat Gateway: handleConnection Doesn't Validate Token
**File:** `apps/live/src/app/services/chat.gateway.ts:45-53`

```ts
async handleConnection(socket: ModifiedSocket) {
    try {
        if (!socket.handshake.headers.authorization) throw new Error('Missing authorization header');
        socket.data.uid = socket.handshake.headers.authorization;
```

When accessed via the gateway proxy, the `Authorization` header is set to the user ID (extracted from JWT). But when accessed directly at port 1511, any value can be passed as the `Authorization` header and it becomes the `uid`. This is by design (the proxy is the auth layer), but direct access to port 1511 should be firewalled.

---

## 6. API Endpoint Test Results

> Results from live testing with admin JWT token against localhost:1510.

### Auth Service (`/api/v1/auth`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/login` | POST | ✅ 201 | Field name is `mail` not `email` |
| `/register` | POST | ✅ 201 | Works, auto-assigns Student role |
| `/refresh` | POST | ✅ 201 | Returns new access + refresh tokens |
| `/logout-all` | POST | ✅ 201 | Revokes via Redis |
| `/my/identity` | GET | ✅ 200 | Returns hydrated identity |
| `/my/identity` | POST | ✅ 201 | Update identity works |
| `/identities` | GET | ✅ 200 | Admin-only, returns all identities |
| `/identities-public` | GET | ✅ 200 | Public endpoint |
| `/identity-ids` | GET | ✅ 200 | Returns IDs only |
| `/credentials` | GET | ✅ 200 | Returns user's own credentials |
| `/roles` | GET | ✅ 200 | Admin-only |
| `/perms` | GET | ✅ 200 | Admin-only |
| `/hydrate?id=admin` | GET | ✅ 200 | Public endpoint |
| `/hydrate-many?ids=admin` | GET | ✅ 200 | Public endpoint |
| `/{id}/lock` | POST | ✅ 201 | Requires USER_LOCK permission |
| `/{id}/lock` | DELETE | ✅ 200 | Requires USER_UNLOCK permission |
| `/identity/search/phone` | GET | ✅ 200 | Works |
| `/{id}/roles` | POST | ✅ 201 | Admin-only, assign role |
| `/{id}/roles` | DELETE | ✅ 200 | Admin-only, remove role |
| `/credentials/mail` | POST | ✅ 201 | Add mail credential |
| `/credentials/mail/password` | POST | ✅ 201 | Change password |
| `/google` | GET | ✅ 302 | Redirects to Google OAuth |
| `/google/tokens` | GET | ⚠️ 500 | Expected: requires loginToken param |
| `/google/calendar/*` | Various | ⚠️ | Requires Google OAuth setup |

### Exam Service (`/api/v1/exams`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/management/exams` | GET | ✅ 200 | Lists exams for management |
| `/management` | POST | ✅ 201 | Creates exam successfully |
| `/management/{id}` | PATCH | ✅ 200 | Updates exam |
| `/management/{id}` | DELETE | ✅ 200 | Deletes exam |
| `/management/{id}/sections` | POST | ✅ 201 | Creates section in exam |
| `/management/sections/{id}/questions` | POST | ✅ 201 | Creates question |
| `/management/{id}/review` | PATCH | ✅ 200 | Requires EXAM_APPROVE perm |
| `/practice` | GET | ✅ 200 | Lists approved exams (public) |
| `/practice/info/{id}/details` | GET | ✅ 200 | Exam details (public) |
| `/practice/info/{id}/stats` | GET | ✅ 200 | Exam stats (public) |
| `/practice/new/{id}` | POST | ✅ 201 | Starts attempt |
| `/practice/attempt/{id}/submit` | POST | ✅ 201 | Submits attempt (NO OWNERSHIP CHECK) |
| `/practice/my/calendar` | GET | ✅ 200 | User-scoped correctly |
| `/practice/my/history` | GET | ✅ 200 | User-scoped correctly |
| `/practice/my/stats` | GET | ✅ 200 | User-scoped correctly |
| `/tags/tree` | GET | ✅ 200 | Tag tree |
| `/tags/list` | GET | ✅ 200 | Tag list |
| `/tags` | POST | ✅ 201 | Create tag |
| `/goals/my` | GET/POST/PATCH/DELETE | ✅ | All goal CRUD works |

### Resource Service (`/api/v1/resources`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/blogs` | GET | ✅ 200 | Lists blogs |
| `/blogs` | POST | ✅ 201 | Creates blog |
| `/blogs/{id}` | GET | ✅ 200 | Get blog |
| `/blogs/{id}` | PATCH | ✅ 200 | NO OWNERSHIP CHECK |
| `/blogs/{id}` | DELETE | ✅ 200 | NO OWNERSHIP CHECK |
| `/flash-cards` | GET/POST | ✅ | CRUD works |
| `/flash-card-lists` | GET/POST | ✅ | CRUD works |
| `/flash-card-lists/{id}/cards` | GET/POST/DELETE | ✅ | Card management works |
| `/reports` | GET/POST | ✅ | CRUD works |

### Chat/Live Service (`/api/v1/chat`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/rooms` | GET | ✅ 200 | Lists rooms |
| `/rooms` | POST | ✅ 201 | Creates room (Mod/Admin) |
| `/rooms/{id}/logs` | GET | ✅ 200 | Returns logs (may be empty — see bug 2.1) |
| `/rooms/{id}` | DELETE | ✅ 200 | Deletes room (Mod/Admin) |
| `/rooms/{id}/schedule` | PATCH | ✅ 200 | Update schedule |
| `/rooms/{id}/ban` | POST | ✅ 201 | Ban user |
| `/rooms/{id}/ban/{uid}` | DELETE | ✅ 200 | Unban user |
| WebSocket (`/ws/socket.io`) | WS | ⚠️ | Works but with JWT bypass (see 1.1) |

### Notification Service (`/api/v1/notifications`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/` | GET | ✅ 200 | Lists notifications (user-scoped) |
| `/` | POST | ✅ 201 | Creates notification (NO ROLE CHECK) |
| `/{id}` | GET | ✅ 200 | NO OWNERSHIP CHECK |
| `/{id}` | DELETE | ✅ 200 | NO OWNERSHIP CHECK |
| `/{id}/read` | PATCH | ✅ 200 | NO OWNERSHIP CHECK |
| `/read-all` | POST | ✅ 201 | User-scoped correctly |
| `/stream/{recipientId}` | ALL | ✅ | SSE works but NO ownership verification |

### Achievement Service (`/api/v1/achievements/badges`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/` | GET | ✅ 200 | Lists all badges (public) |
| `/my` | GET | ✅ 200 | User's badges |
| `/my/progress` | GET | ✅ 200 | User's badge progress |
| `/{uid}` | GET | ✅ 200 | Specific user's badges (public) |

### File Service (`/api/v1/files`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/` | POST | ✅ 201 | Returns presigned upload URL |

---

## 7. Recommendations

### Priority 1: Security Fixes (Must fix)
1. **WebSocket JWT validation** — Verify JWT signature in the proxy, not just base64 decode
2. **Exam attempt ownership** — Add `userId` parameter to all attempt-related gRPC calls and verify
3. **Notification ownership** — Add `recipientId` checks for read/delete/mark operations
4. **Resource ownership** — Add author checks or role requirements for update/delete operations
5. **JWT expiration** — Change auth/gateway `.env` from `300000` to `300` (seconds)

### Priority 2: Functional Bugs (Should fix)
6. **Chat message persistence** — Save messages to `Log` table before broadcasting
7. **Chat event fields** — Emit `{ id, fromId, message, createdAt }` instead of `{ message, uid }`
8. **UserPage.tsx fetchGoal** — Use GoalsService client instead of raw fetch
9. **Resource DTO validation** — Replace `Record<string, any>` with proper DTOs
10. **AttemptEvaluator score reset** — Reset score/totalPoints to 0 in `evaluateScore()`

### Priority 3: Improvements (Nice to have)
11. **Remove unused frontend params** — Clean up `recipientId`/`authorId` that backend ignores
12. **Notification create role check** — Require admin/mod role for creating notifications
13. **Add time limit to addNote/toggleFlag** — Consistent with answer/deleteAnswer
14. **Firewall port 1511** — Direct WebSocket access should be restricted to localhost

---

*Generated by Claude Code audit on 2026-05-25*
