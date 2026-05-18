# Test Plan Summary

## Tổng quan

Dự án sử dụng **Jest 29.7** với **ts-jest**, **supertest** cho integration tests. Kiến trúc **NestJS 11** với CQRS, gRPC microservices.

---

## Thống kê kiểm thử

| STT | Chức năng / Phân hệ              | Số lượng | Phương pháp                              | File test                                                                                                                            |
| --- | -------------------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Xác thực và phân quyền           | 53       | ECP, BVA, Decision Table, MCDC           | `auth-grpc.controller.spec.ts`, `guards.integration.spec.ts`, `auth-gateway.integration.spec.ts`, `authorization.controller.spec.ts` |
| 2   | Quản lý học sinh                 | 18       | ECP, BVA, Decision Table, Error Guessing | `identity-management.integration.spec.ts`                                                                                            |
| 3   | Quản lý giáo viên                | 10       | ECP, Decision Table, MCDC                | `identity-management.integration.spec.ts`                                                                                            |
| 4   | Quản lý khóa học                 | 4        | ECP, Control Flow                        | `course-schedule-curriculum.integration.spec.ts`                                                                                     |
| 5   | Quản lý đặt lịch                 | 16       | ECP, BVA, Error Guessing                 | `course-schedule-curriculum.integration.spec.ts`, `live-gateway.integration.spec.ts`                                                 |
| 6   | Quản lý phụ huynh                | 8        | ECP, Error Guessing                      | `identity-management.integration.spec.ts`                                                                                            |
| 7   | Quản lý chương trình học         | 15       | ECP, BVA, Control Flow, Decision Table   | `course-schedule-curriculum.integration.spec.ts`                                                                                     |
| 8   | Luyện tập AI                     | 7        | ECP, Control Flow                        | `exam-practice.controller.spec.ts`, `exam-practice.integration.spec.ts`                                                              |
| 9   | Thanh toán                       | 7        | ECP, BVA, Control Flow, Error Guessing   | `system-admin-payment.integration.spec.ts`                                                                                           |
| 10  | Quản trị hệ thống                | 12       | Decision Table, MCDC, ECP                | `system-admin-payment.integration.spec.ts`                                                                                           |
| 11  | Thông báo                        | 4        | ECP                                      | `notification-gateway.integration.spec.ts`                                                                                           |
| 12  | Trò chuyện                       | 8        | ECP                                      | `live-gateway.integration.spec.ts`                                                                                                   |
| 13  | Liên kết phụ huynh — giáo viên   | 4        | ECP, Decision Table                      | `weekly-goals-google-login.integration.spec.ts`                                                                                      |
| 14  | Mục tiêu tuần                    | 5        | ECP, Control Flow                        | `weekly-goals-google-login.integration.spec.ts`                                                                                      |
| 15  | Đăng nhập Google                 | 4        | ECP, Control Flow                        | `weekly-goals-google-login.integration.spec.ts`, `auth-grpc.controller.spec.ts`                                                      |
| 16  | Quản lý bài thi                  | 12       | BVA, Control Flow, Error Guessing        | `exam-management.controller.spec.ts`, `exam-management.integration.spec.ts`                                                          |
| 17  | Làm bài thi                      | 18       | Control Flow, Error Guessing             | `exam-practice.controller.spec.ts`, `exam-practice.integration.spec.ts`                                                              |
| 18  | Trò chuyện trực tiếp — REST API  | 14       | BVA, Error Guessing                      | `live-gateway.integration.spec.ts`                                                                                                   |
| 19  | Trò chuyện trực tiếp — WebSocket | 9        | Error Guessing, Control Flow             | `live-ws-gateway.integration.spec.ts`                                                                                                |
| 20  | Thông báo SSE                    | 11       | ECP, Error Guessing                      | `notification-sse.integration.spec.ts`                                                                                               |
| 21  | Dịch vụ tệp tin                  | 5        | BVA, ECP                                 | `file-gateway.integration.spec.ts`, `file.controller.spec.ts`                                                                        |
| 22  | Dịch vụ thành tích               | 5        | ECP, BVA                                 | `achievement-gateway.integration.spec.ts`, `badge.controller.spec.ts`                                                                |
| 23  | Dịch vụ tài nguyên học tập       | 7        | ECP, BVA, Control Flow                   | `resource-gateway.integration.spec.ts`, `resource-management.controller.spec.ts`                                                     |
|     | **Tổng cộng**                    | **252**  |                                          | **23 file test**                                                                                                                     |

---

## Danh sách file test

### Unit Tests (gRPC Controllers) — 7 files

| File                                                                 | Module        | Tests | Mô tả                                                                                                              |
| -------------------------------------------------------------------- | ------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/auth/src/__tests__/auth-grpc.controller.spec.ts`               | Auth          | 30    | Auth CQRS controller: register, login, refresh, JWT, Google OAuth, roles, permissions, identities, Google Calendar |
| `apps/exam/src/__tests__/exam-management.controller.spec.ts`         | Exam          | 17    | Exam CRUD CQRS: create/update/delete exam, section, question, review, move, counts                                 |
| `apps/exam/src/__tests__/exam-practice.controller.spec.ts`           | Exam          | 16    | Exam practice CQRS: attempt, answer, flag, note, stats, history                                                    |
| `apps/notification/src/__tests__/notification.controller.spec.ts`    | Notification  | 15    | Notification CRUD: create, get, delete, list, markAsRead, markAllAsRead, pagination, error handling                |
| `apps/resource/src/__tests__/resource-management.controller.spec.ts` | Resource      | 15    | Resource CRUD: blog, flashcard, flashcard list, report controllers                                                 |
| `apps/file-service/src/__tests__/file.controller.spec.ts`            | File Service  | 5     | Presigned URL, MIME validation, file size BVA, get URLs                                                            |
| `apps/achievement/src/__tests__/badge.controller.spec.ts`            | Achievement   | 5     | Badge listing, user badges, progress, pagination BVA                                                               |
| `apps/authorization/src/__tests__/authorization.controller.spec.ts`  | Authorization | 5     | Ownership check/register/remove, event handler integration                                                         |

### Integration Tests (HTTP Gateway) — 16 files

| File                                                                        | Module                     | Tests | Mô tả                                                                                  |
| --------------------------------------------------------------------------- | -------------------------- | ----- | -------------------------------------------------------------------------------------- |
| `apps/gateway/src/__tests__/auth-gateway.integration.spec.ts`               | Auth Gateway               | 13    | HTTP auth: register (ECP/BVA), login, refresh                                          |
| `apps/gateway/src/__tests__/guards.integration.spec.ts`                     | Auth Guards                | 15    | JwtAuthGuard, RolesGuard, PermissionsGuard, ResourceAccessGuard (MCDC, Decision Table) |
| `apps/gateway/src/__tests__/exam-management.integration.spec.ts`            | Exam Management            | 17    | HTTP exam CRUD with validation                                                         |
| `apps/gateway/src/__tests__/exam-practice.integration.spec.ts`              | Exam Practice              | 18    | HTTP practice endpoints                                                                |
| `apps/gateway/src/__tests__/notification-gateway.integration.spec.ts`       | Notifications              | 11    | HTTP notification CRUD with validation                                                 |
| `apps/gateway/src/__tests__/resource-gateway.integration.spec.ts`           | Resources                  | 34    | Blogs, flashcards, reports full CRUD                                                   |
| `apps/gateway/src/__tests__/live-gateway.integration.spec.ts`               | Live Chat                  | 19    | Room management, schedule, ban, chat logs                                              |
| `apps/gateway/src/__tests__/file-gateway.integration.spec.ts`               | File                       | 6     | Presigned URL validation                                                               |
| `apps/gateway/src/__tests__/achievement-gateway.integration.spec.ts`        | Achievement                | 7     | Badge endpoints                                                                        |
| `apps/gateway/src/__tests__/identity-management.integration.spec.ts`        | Identity                   | 43    | Student (18), Teacher (10), Parent (8), role/permission management, pagination BVA     |
| `apps/gateway/src/__tests__/course-schedule-curriculum.integration.spec.ts` | Course/Schedule/Curriculum | 43    | Course (5), Schedule (16), Curriculum (16) management                                  |
| `apps/gateway/src/__tests__/system-admin-payment.integration.spec.ts`       | Admin + Payment            | 28    | Payment (7), System Admin (12), role-based access Decision Table                       |
| `apps/gateway/src/__tests__/weekly-goals-google-login.integration.spec.ts`  | Goals + Login              | 20    | Weekly Goals (5), Parent-Teacher Link (4), Google Login (4)                            |
| `apps/gateway/src/__tests__/live-ws-gateway.integration.spec.ts`            | WebSocket                  | 20    | WebSocket handshake, join/leave room, chat, ban, disconnect                            |
| `apps/gateway/src/__tests__/notification-sse.integration.spec.ts`           | SSE                        | 12    | SSE connection, streaming, heartbeat, filtering, concurrent connections                |

**Tổng số file test: 23 | Tổng số test cases: 414**

---

## Phương pháp kiểm thử

### 1. Equivalence Partitioning (ECP)

Phân vùng dữ liệu hợp lệ và không hợp lệ cho DTO, API input và form data.

**Ví dụ áp dụng:**

- `auth-gateway.integration.spec.ts`: email hợp lệ (`a@b.com`) vs không hợp lệ (`notanemail`)
- `file-gateway.integration.spec.ts`: MIME type hợp lệ (`image/jpeg`) vs không hợp lệ (`text/plain`)
- `payment`: currency hợp lệ (`VND`, `USD`) vs không hợp lệ (`BTC`)
- `identity-management`: số điện thoại hợp lệ (`+84123456789`) vs không hợp lệ (`abc`)

### 2. Boundary Value Analysis (BVA)

Kiểm thử các giá trị biên.

**Ví dụ áp dụng:**

- `auth-gateway.integration.spec.ts`: password 5 ký tự (< 6) vs 6 ký tự (= min)
- `file.controller.spec.ts`: file size 10MB (hợp lệ) vs 10MB+1 (không hợp lệ)
- `identity-management.integration.spec.ts`: pagination limit 0, 1, 100
- `achievement-gateway.integration.spec.ts`: limit âm bị từ chối
- `course-schedule-curriculum.integration.spec.ts`: schedule time quá khứ vs tương lai

### 3. Decision Table Testing

Kiểm thử logic phân quyền, RBAC và permission guards.

**Ví dụ áp dụng:**

- `guards.integration.spec.ts`: RolesGuard với matrix Role (Admin/Mod/User) × Required Role
- `system-admin-payment.integration.spec.ts`: Admin có quyền truy cập /admin endpoints, User/Mod bị chặn
- `identity-management.integration.spec.ts`: roles & permissions filter combinations
- `course-schedule-curriculum.integration.spec.ts`: publish/unpublish status transitions

**Ma trận quyết định điển hình (RolesGuard):**

| @IsPublic | Required Role | User Role | Kết quả      |
| --------- | ------------- | --------- | ------------ |
| true      | —             | —         | ✅ Pass      |
| false     | undefined     | —         | ✅ Pass      |
| false     | [Admin]       | Admin     | ✅ Pass      |
| false     | [Admin]       | User      | ❌ Forbidden |

### 4. Control Flow / Branch Testing

Kiểm thử các nhánh xử lý trong service, handler và transaction flow.

**Ví dụ áp dụng:**

- `notification.controller.spec.ts`: tạo 3 notification theo sequence, kiểm tra call count
- `system-admin-payment.integration.spec.ts`: create → confirm → refund flow
- `weekly-goals-google-login.integration.spec.ts`: login → link Google account flow
- `course-schedule-curriculum.integration.spec.ts`: add section → reorder sections → remove section

### 5. Modified Condition/Decision Coverage (MCDC)

Áp dụng cho các điều kiện boolean phức tạp.

**Ví dụ áp dụng:**

- `guards.integration.spec.ts`: RolesGuard — mỗi điều kiện (isPublic, hasRoles, roleMatch) được test độc lập
- `identity-management.integration.spec.ts`: Teacher có Mod role được access management endpoints, Teacher không có Admin role bị chặn admin endpoints
- `system-admin-payment.integration.spec.ts`: Mod role bị chặn config admin trong khi Admin được phép (mỗi điều kiện boolean thay đổi độc lập)

### 6. Error Guessing

Kiểm thử các lỗi thực tế dựa trên kinh nghiệm.

**Ví dụ áp dụng:**

- `auth-gateway.integration.spec.ts`: SQL injection trong email, duplicate email, revoked token
- `identity-management.integration.spec.ts`: duplicate parent-student link, invalid parent-student pair
- `live-ws-gateway.integration.spec.ts`: banned user cố gắng join room, join non-existent room
- `course-schedule-curriculum.integration.spec.ts`: schedule time conflict
- `system-admin-payment.integration.spec.ts`: webhook signature không hợp lệ
- `notification-sse.integration.spec.ts`: invalid recipientId

---

## Cấu trúc test

### Unit Test Pattern (gRPC Controller)

```
Test.createTestingModule({
  imports: [CqrsModule.forRoot()],
  controllers: [SomeController],
  providers: [
    { provide: 'winston', useValue: mockWinstonLogger },
    { provide: AppLoggerService, useValue: ... },
  ],
})
→ Spy on commandBus.execute / queryBus.execute (CQRS pattern)
→ OR mock service directly (non-CQRS pattern)
```

### Integration Test Pattern (HTTP Gateway)

```
Test.createTestingModule({
  imports: [ConfigModule.forRoot(...)],
  controllers: [SomeController],
  providers: [
    { provide: SOME_CLIENT, useValue: mockGrpcClient },
    { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
    { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(...) },
    { provide: APP_GUARD, useValue: { canActivate: ... } },
  ],
})
.overrideGuard(RolesGuard).useValue(mockGuard(...))
.overrideGuard(PermissionsGuard).useValue(mockGuard(...))
.overrideGuard(ResourceAccessGuard).useValue(mockGuard(...))
→ request(app.getHttpServer()).get/post/patch/delete(...)
```

---

## Chạy kiểm thử

```bash
# Chạy tất cả tests
npx nx run-many -t test

# Chạy test cho specific app
npx nx test auth
npx nx test gateway
npx nx test exam

# Chạy với coverage
npx nx test gateway --coverage
```

gg
