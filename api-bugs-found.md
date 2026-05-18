# API Bug Report

**Server**: `https://meowlish.servebeer.com`  
**Test date**: 2026-05-22  
**Auth**: Admin (admin@gmail.com / admin), JWT sub=`admin`, roles=`['admin']`

---

## 🐛 Critical Bugs

### Bug 1: `createRoom` uses wrong `where` clause

**File**: `apps/live/src/app/infra/repositories/room.prisma.repository.ts:35`

```ts
async createRoom(name: string): Promise<void> {
    await this.txHost.tx.room.upsert({
        where: { id: name },   // BUG: should be { name: name }
        update: { isDeleted: false },
        create: { name: name },
    });
}
```

**Problem**: Room model defines `id` as `@id @default(uuid())` (UUID). Using `where: { id: name }` passes a human-readable name like `"api-test-room"` as the UUID lookup, which fails. The `name` column has `@unique` constraint.

**Fix**: Change `where: { id: name }` → `where: { name: name }`

**Effect**: `POST /api/v1/chat/rooms` always returns 500.

---

### Bug 2: Missing `@SerializeOptions` on gateway controllers

**Files affected**:

| Gateway | Controller | Methods affected |
|---|---|---|
| `resource-gateway` | `resource.router.controller.ts` | All `@Get()` and `@Get(':id')` methods |
| `live-gateway` | `live.router.controller.ts` | `getRoomList()`, `getChatLog()` |
| `notification-gateway` | `notification.router.controller.ts` | `getNotification()`, `listNotifications()` |

**Problem**: These gateway controllers return gRPC `Observable` responses directly, but lack `@SerializeOptions({ type: ..., strategy: 'exposeAll' })` decorators. The exam-practice gateway uses these decorators and works correctly. Without them, NestJS's `ClassSerializerInterceptor` cannot properly serialize the protobuf response objects, resulting in `data: {}` in the HTTP response.

**Fix**: Add `@SerializeOptions({ type: ResponseDto, strategy: 'exposeAll' })` to each handler method in these controllers, mirroring the pattern in `apps/gateway/src/exam-gateway/exam-practice.router.controller.ts`.

**Effect**: All GET list/detail endpoints return `data: {}`:
- `GET /api/v1/chat/rooms`
- `GET /api/v1/chat/rooms/:roomId/logs`
- `GET /api/v1/resources/blogs`
- `GET /api/v1/resources/blogs/:id`
- `GET /api/v1/resources/flash-cards`
- `GET /api/v1/resources/flash-cards/:id`
- `GET /api/v1/resources/flash-card-lists`
- `GET /api/v1/resources/flash-card-lists/:id`
- `GET /api/v1/resources/flash-card-lists/:id/cards`
- `GET /api/v1/resources/reports`
- `GET /api/v1/resources/reports/:id`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/:id`

---

### Bug 3: POST /notifications returns 500

**Endpoint**: `POST /api/v1/notifications`  
**File**: `apps/gateway/src/notification-gateway/notification.router.controller.ts:69`

```ts
createNotification(@Body() body: notification.CreateNotificationRequest) {
    return this.notificationService.createNotification(body);
}
```

**Problem**: Returns 500 Internal Server Error with any input. The gRPC call to the notification service fails, likely due to protobuf type mismatch or the `data` field expecting a JSON string vs object.

**Effect**: Cannot create notifications via API.

---

### Bug 4: POST /resources/blogs returns 502

**Endpoint**: `POST /api/v1/resources/blogs`  
**File**: `apps/gateway/src/resource-gateway/resource.router.controller.ts:49`

```ts
createBlog(@Body() body: Record<string, any>) {
    return this.blogService.createBlog(body as resource.CreateBlogRequest);
}
```

**Problem**: Returns 502 Bad Gateway. The gRPC call fails.

**Effect**: Cannot create blog posts via API.

---

### Bug 5: POST /resources/reports returns 500

**Endpoint**: `POST /api/v1/resources/reports`  
**File**: `apps/gateway/src/resource-gateway/resource.router.controller.ts:208`

```ts
createReport(@Body() body: resource.CreateReportRequest) {
    return this.reportService.createReport(body);
}
```

**Problem**: Returns 500 Internal Server Error. gRPC call fails.

**Effect**: Cannot create reports via API.

---

## ⚠️ Minor Issues

### Issue 6: GET /auth/google/tokens returns 500 instead of 400

**Endpoint**: `GET /api/v1/auth/google/tokens`

**Problem**: When called without a valid `loginToken` query param, returns 500 Internal Server Error instead of 400 Bad Request.

---

### Issue 7: DELETE /exams/goals/my returns 502 when no goal exists

**Endpoint**: `DELETE /api/v1/exams/goals/my`

**Problem**: When no goal has been set, returns 502 "Check the app's log" instead of a proper error message.

---

### Issue 8: POST /auth/credentials/mail/password doesn't require current password

**Endpoint**: `POST /api/v1/auth/credentials/mail/password`  
**File**: `apps/gateway/src/auth-gateway/dtos/req/update-password.req.dto.ts`

```ts
export class UpdateMailPasswordDto {
    @IsString()
    id!: string;

    @IsString()
    @IsStrongPassword()
    password!: string;  // Only new password, no current password
}
```

**Problem**: The DTO only requires the credential `id` and new `password`. There's no `currentPassword` field, meaning any authenticated user can change their password without providing their current password. This is a security concern if the user leaves their session open.

---

### Issue 9: JWT access token expiry is 5 minutes (300000ms)

**File**: `apps/gateway/.env`:
```
JWT_ACCESS_TOKEN_EXPIRATION=300000
JWT_REFRESH_TOKEN_EXPIRATION=86400000
```

**Observation**: 5-minute access token lifetime is very short. Any API call with an expired token returns 401, which requires the frontend to implement robust token refresh logic. This is intentional but worth noting — any API test needs to refresh tokens frequently.

---

## ✅ Verified Correct (no issues)

| Module | Endpoints | Status |
|---|---|---|
| Auth | register, login, refresh, logout-all, roles, perms, identities, lock/unlock, role assign/remove | ✅ All working |
| Exam Practice | All 15 endpoints (new attempt, submit, answer, flag, note, list, detail, question detail, stats, saved, review, calendar, history, stats) | ✅ Fully functional |
| Exam Management | Create/update/delete/review exams, sections, questions (with proper approval locking) | ✅ All working |
| Tags | CRUD, tree, list, move | ✅ Working |
| Goals | CRUD | ✅ Working |
| Files | Presigned URL generation | ✅ Working |
| Achievements | Badges list, user badges, progress | ✅ Working |
