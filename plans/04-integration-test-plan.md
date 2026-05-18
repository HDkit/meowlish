# Integration Test Plan — Backend (Jest)

**Project:** server (NestJS 11 monorepo, Nx, gRPC, PostgreSQL, Redis, RabbitMQ)  
**Framework:** Jest 29 with `@nx/jest` plugin, Supertest for HTTP  
**Date:** 2026-05-25  

---

## 1. Testing Strategy

### Scope
Integration tests verify that **multiple units work together correctly** — gateway HTTP controllers with their gRPC proxies, gRPC controllers with command/query handlers, and handlers with Prisma repositories. Tests exercise real infrastructure (test PostgreSQL, Redis) with stubbed external dependencies (gRPC clients, RabbitMQ, MinIO).

### Test Pyramid Placement

```
     /\
    /E2E\       ← few: full user flows (Gateway→Auth→DB)
   /─────\
  /Integration\ ← many: service + DB, Gateway + mocked gRPC
 /─────────────\
/    Unit       \ ← most: handlers, services, mappers
```

### Methodology Selection Table

| Methodology | When Applied |
|---|---|
| **Black-box (Equivalence Partitioning)** | HTTP endpoint input validation, auth guards |
| **Boundary Value Analysis (BVA)** | Pagination cursors, limit params, timestamps |
| **Decision Table** | Auth guard logic (public/Auth/RBAC/permission combinations) |
| **Control Flow (Statement/Branch)** | Command/query handlers with conditional branches |
| **MCDC (Modified Condition/Decision Coverage)** | Complex guard conditions (RolesGuard, PermissionsGuard, resource access rules) |
| **State Transition** | Attempt lifecycle (start→answer→submit→review), exam status (Draft→Pending→Approved/Rejected), ban lifecycle |
| **Domain Analysis** | Input DTO validation, entity invariants |
| **Error-Guessing** | Edge cases from bug report (`api-bugs-found.md`) |

---

## 2. Test Architecture

### Test Double Strategy

| Component | Approach | Tool |
|---|---|---|
| Database | Testcontainers (PostgreSQL) | `@testcontainers/postgresql` |
| Redis | Testcontainers (Redis) | `@testcontainers/redis` |
| RabbitMQ | Mocked | `jest-mock-extended` |
| MinIO | Mocked | `jest-mock-extended` |
| gRPC client (Gateway→Service) | Mocked stub | `@grpc/proto-loader` + mock |
| External HTTP (Google OAuth) | `nock` | `nock` |
| JWT signing | Real keys for test env | `@nestjs/jwt` |
| Socket.IO | Attach to test HTTP server | `socket.io-client` |
| AI scoring (RabbitMQ consumer) | In-memory event bus | Test module override |

### Test Infrastructure

Each test suite uses a **NestJS testing module** (`Test.createTestingModule`) that imports the real module but overrides:
- `DATABASE_SERVICE` with a Prisma client connected to testcontainer
- RabbitMQ providers with mocks
- MinIO/FILE_CLIENT with mocks

---

## 3. Test Module Organization & Prioritization

```
Priority 1 (Core infrastructure — must pass first):
├── 3.1  Auth Service (register, login, refresh, logout, lock/unlock)
├── 3.2  Gateway Auth Guards (JWT, Roles, Permissions, ResourceAccess)

Priority 2 (Primary business flows):
├── 3.3  Exam Management (CRUD exams, sections, questions, review workflow)
├── 3.4  Exam Practice (attempt lifecycle, answering, scoring)

Priority 3 (Secondary services):
├── 3.5  Live Chat (REST rooms, WebSocket messaging, ban)
├── 3.6  Notifications (CRUD, SSE streaming, event handling)

Priority 4 (Supporting services):
├── 3.7  File Service (presigned URLs, orphan cleanup)
├── 3.8  Achievement Service (badge assignment, progress)
├── 3.9  Resource Service (blogs, flashcards, reports)
├── 3.10 Authorization Service (ownership tracking)
```

---

## 4. Detailed Test Cases

### 4.1 Auth Gateway — `POST /api/v1/auth/register`

**Methodology:** Black-box (ECP + BVA), Domain Analysis

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.1.1 | Valid registration | `{ mail: "a@b.com", password: "Abc123!", username: "test" }` | 201 + tokens | **ECP**: valid class (all fields valid) |
| 4.1.2 | Duplicate email | Same email twice | 409 Conflict | **State**: email uniqueness invariant |
| 4.1.3 | Invalid email format | `{ mail: "notanemail" }` | 400 Bad Request | **Domain**: email regex fails |
| 4.1.4 | Password < 6 chars | `{ password: "Abc12" }` | 400 Bad Request | **BVA**: boundary at 6 — below fails |
| 4.1.5 | Password = 6 chars | `{ password: "Abc123" }` | 201 | **BVA**: boundary at 6 — at passes |
| 4.1.6 | Empty username | `{ username: "" }` | 400 | **Domain**: required field |
| 4.1.7 | Missing mail field | `{ password: "Abc123!" }` | 400 | **ECP**: missing required field |
| 4.1.8 | SQL injection attempt | `{ mail: "' OR 1=1--" }` | 400 | **Error-guessing**: injection patterns |

### 4.2 Auth Gateway — `POST /api/v1/auth/login`

**Methodology:** Decision Table, State Transition

| Condition | Valid creds | Wrong pwd | Locked account | Non-existent |
|---|---|---|---|---|
| **Outcome** | 200 + tokens | 401 | 403 | 404 |

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.2.1 | Correct credentials | Valid email+password | 200, tokens | **Decision Table**: R1 — all conditions OK |
| 4.2.2 | Wrong password | Valid email + wrong pwd | 401 | **Decision Table**: R2 — creds invalid |
| 4.2.3 | Locked account | Locked identity + correct creds | 403 | **Decision Table**: R3 — lock check in validateAccess |
| 4.2.4 | Non-existent email | `{ mail: "no@one.com" }` | 404 via gRPC | **Decision Table**: R4 — not found |
| 4.2.5 | Login after unlock | Previously locked, now unlocked | 200 | **State Transition**: locked→unlocked→login OK |

### 4.3 Token Validation — `POST /api/v1/auth/refresh`

**Methodology:** Control Flow (validate-refresh handler), MCDC

Handler code path (pseudocode):
```
if revoked? → throw
if identity not found? → throw
if locked? → throw
else → return claims
```

| # | Test Case | Condition | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.3.1 | Valid refresh token | Not revoked, identity exists, unlocked | 200 | **MCDC**: all conditions true |
| 4.3.2 | Revoked token | Token revoked via logout-all | 401 | **MCDC**: revoked=true → fail |
| 4.3.3 | Deleted identity | Identity soft-deleted | 404 | **MCDC**: exists=false → fail |
| 4.3.4 | Locked identity | Identity.isLocked=true | 403 | **MCDC**: locked=true → fail |
| 4.3.5 | Token issued before revoke | iat < revoke timestamp | 401 | **Control Flow**: revoke comparison branch |
| 4.3.6 | Token issued after revoke | iat > revoke timestamp | 200 | **Control Flow**: valid branch |

### 4.4 RolesGuard & PermissionsGuard

**Methodology:** Decision Table, MCDC

Decision table for `@HasRoles(Role.Admin)`:

| Has role? | Is public? | Guard skips? | Access |
|---|---|---|---|
| T | — | — | ✅ |
| F | T | T (decorator) | ✅ |
| F | F | F | ❌ 403 |

Decision table for resource access guard (update exam):
```
@ResourceAccess({
  resourceType: 'exam',
  resourceIdParam: 'id',
  rules: [
    { roles: [Role.Admin] },
    { roles: [Role.Mod], requireOwnership: true },
  ],
})
```

MCDC conditions:
- C1: user has Role.Admin
- C2: user has Role.Mod
- C3: user owns resource
- Result: C1 ∨ (C2 ∧ C3)

| # | Test Case | C1(Admin) | C2(Mod) | C3(Owner) | Expected | Reason |
|---|---|---|---|---|---|---|
| 4.4.1 | Admin, no ownership | T | F | F | ✅ | C1 alone is sufficient |
| 4.4.2 | Mod, owner | F | T | T | ✅ | C2 ∧ C3 covers |
| 4.4.3 | Mod, not owner | F | T | F | ❌ 403 | Ownership required |
| 4.4.4 | Learner | F | F | F | ❌ 403 | No role |
| 4.4.5 | Admin + owner | T | F | T | ✅ | Multiple paths true |

### 4.5 Exam Management — Full CRUD Flow

**Methodology:** State Transition, Control Flow, Decision Table

Attempt lifecycle states:
```
[C1] PENDING ──review(approve)──► [APPROVED] ──delete──► [DELETED]
                ──review(reject)──► [REJECTED]
```

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.5.1 | Create exam (Mod) | `{ title, description, duration }` | 201, exam.id | **Control Flow**: happy path |
| 4.5.2 | Create exam (Learner) | Same | 403 Forbidden | **Decision Table**: missing Mod role |
| 4.5.3 | Create section in exam | `{ name, directive, contentType }` | 201, section.id | **State**: section attached to exam |
| 4.5.4 | Create nested section | sectionId of another section | 201 | **Control Flow**: recursive section support |
| 4.5.5 | Create question in section | `{ content, type: MCQ, choices }` | 201, question.id | **State**: question attached to leaf section |
| 4.5.6 | Update exam (owning Mod) | Change title | 200 | **ResourceAccess**: Mod+owner |
| 4.5.7 | Update exam (non-owning Mod) | Change title | 403 | **ResourceAccess**: Mod+non-owner |
| 4.5.8 | Review exam (has EXAM_APPROVE) | `{ status: APPROVED }` | 200 | **Decision Table**: permission check |
| 4.5.9 | Review exam (no permission) | `{ status: APPROVED }` | 403 | **Decision Table**: permission denied |
| 4.5.10 | Delete exam with sections cascade | Delete exam | 200 + sections removed | **Control Flow**: cascade delete logic |
| 4.5.11 | Move section | `{ newParentId, newOrder }` | 200 | **Domain Analysis**: closure table update |
| 4.5.12 | Get exam counts | — | `{ pending, approved, rejected }` | **Black-box**: aggregate query |

### 4.6 Exam Practice — Attempt Lifecycle

**Methodology:** State Transition (primary), BVA, Equivalence Partitioning

Attempt states:
```
[IDLE] ──start──► [IN_PROGRESS] ──answer──► [ANSWERED]
                                              │
                                              └──submit──► [SUBMITTED] ──score──► [SCORED]
```

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.6.1 | Start attempt on approved exam | examId | 201, attempt.id | **State**: IDLE→IN_PROGRESS |
| 4.6.2 | Start attempt on pending exam | examId | 400 | **State**: not APPROVED |
| 4.6.3 | Start concurrent attempt | Already has active attempt | 409 | **Domain**: order uniqueness |
| 4.6.4 | Answer MCQ question | `{ questionId, answer: ["A"] }` | 200 | **State**: IN_PROGRESS→ANSWERED |
| 4.6.5 | Answer MCQ_MULTI question | `{ questionId, answer: ["A","C"] }` | 200 | **ECP**: valid multi-select |
| 4.6.6 | Answer MCQ_MULTI with 1 choice | `{ questionId, answer: ["B"] }` | 200 | **BVA**: min choices = 1 |
| 4.6.7 | Answer MCQ_MULTI with all choices | `{ questionId, answer: ["A","B","C","D"] }` | 200 | **BVA**: max choices = all |
| 4.6.8 | Remove answer | `{ questionId }` | 200 | **State**: ANSWERED→IN_PROGRESS |
| 4.6.9 | Toggle flag | `{ questionId }` | 200, isFlagged:true | **Control Flow**: toggle logic |
| 4.6.10 | Toggle flag (already flagged) | Same question | isFlagged:false | **Control Flow**: toggle back |
| 4.6.11 | Submit attempt | — | 200 | **State**: IN_PROGRESS→SUBMITTED |
| 4.6.12 | Submit already-submitted attempt | — | 400 | **State**: already submitted |
| 4.6.13 | Get attempt review (after scoring) | attemptId | 200, score+responses | **Control Flow**: scoring pipeline |
| 4.6.14 | Get attempt review (before scoring) | attemptId | 200, no scores | **State**: review before score event |
| 4.6.15 | Get user stats | — | `{ attemptCounts, avgScore, tagInfos }` | **Black-box**: aggregation |
| 4.6.16 | Get calendar history | `{ from, to }` | `{ history: { [epoch]: count } }` | **Domain**: date range filter |
| 4.6.17 | Add note to question | `{ note: "review later" }` | 200 | **Control Flow**: note upsert |
| 4.6.18 | Writing attempt — full flow | Write content, submit, poll | 200, score+feedback | **State**: end-to-end async scoring |

### 4.7 Live Chat — REST API

**Methodology:** Black-box, Decision Table, Domain Analysis

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.7.1 | List rooms (no auth) | GET /chat/rooms | 200, room list | **Black-box**: public read |
| 4.7.2 | List rooms with pagination | `?cursor=xxx&limit=5` | 200 + nextCursor | **BVA**: limit 0,1,default,100 |
| 4.7.3 | Create room (Mod) | `{ name: "General" }` | 201 | **Decision Table**: Mod role OK |
| 4.7.4 | Create room (Learner) | Same | 403 | **Decision Table**: Learner forbidden |
| 4.7.5 | Delete room (Admin) | roomId | 200 | **ResourceAccess**: Admin bypasses ownership |
| 4.7.6 | Delete room (non-owning Mod) | roomId | 403 | **ResourceAccess**: Mod+non-owner |
| 4.7.7 | Create room with duplicate name | Same name | 409 | **Domain**: unique name |
| 4.7.8 | Ban user from room (Mod) | `{ uid, reason }` | 200 | **Control Flow**: ban→disconnect WS |
| 4.7.9 | Unban user | `DELETE /ban/:uid` | 200 | **State**: banned→unbanned |
| 4.7.10 | Get chat logs | roomId | 200, log entries | **Black-box**: paginated logs |
| 4.7.11 | Get chat logs with date range | `?from=...&to=...` | 200, filtered | **Domain**: date range filter |
| 4.7.12 | Update schedule (valid YouTube URL) | `{ url: "https://youtube.com/watch?v=..." }` | 200 | **Domain analysis**: URL pattern match |
| 4.7.13 | Update schedule (invalid URL) | `{ url: "https://example.com" }` | 400 | **Domain analysis**: pattern rejection |
| 4.7.14 | Update schedule (set fields null) | `{ setUrlNull: true }` | 200 | **Control Flow**: nullification branch |

### 4.8 Live Chat — WebSocket (Socket.IO)

**Methodology:** State Transition, Control Flow

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.8.1 | Connect without auth header | — | Disconnected | **Control Flow**: handleConnection → catch → disconnect |
| 4.8.2 | Connect with valid auth | `{ authorization: "uid123" }` | Connected, joined personal room | **Control Flow**: happy path |
| 4.8.3 | Join allowed room | `emit("join-room", roomId)` | Joined room | **Domain**: canJoinRoom returns true |
| 4.8.4 | Join banned room | `emit("join-room", bannedRoomId)` | UnauthorizedException | **Decision Table**: banned user → blocked |
| 4.8.5 | Leave room | `emit("leave-room", roomId)` | Left room | **State**: joined→left |
| 4.8.6 | Send message without joining | `emit("chat", { roomId, message })` | ForbiddenException | **Control Flow**: rooms.has check fails |
| 4.8.7 | Send message after joining | `emit("chat", { roomId, message })` | Message broadcast to room | **Control Flow**: saveLog→emit |
| 4.8.8 | Receive broadcast message | Another user sends message | `message` event received | **State**: broadcast delivery |
| 4.8.9 | Disconnect | Client disconnects | Logged, removed | **Control Flow**: handleDisconnect |

### 4.9 Notifications — CRUD + SSE

**Methodology:** Black-box, State Transition, Domain Analysis

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.9.1 | Create notification | `{ recipientId, type, title, message }` | 201 | **Black-box**: valid creation |
| 4.9.2 | List notifications (valid recipient) | `GET ?page=1&limit=20` | 200, paginated list + totalCount + unreadCount | **Domain**: pagination + aggregation |
| 4.9.3 | List notifications with type filter | `?type=Achievement` | Filtered results | **ECP**: type filtering |
| 4.9.4 | List notifications with isRead filter | `?isRead=false` | Unread only | **Decision Table**: isRead condition |
| 4.9.5 | Mark single as read | `PATCH /:id/read` | 200, isRead=true | **State**: unread→read |
| 4.9.6 | Mark all as read | `POST /read-all` | 200, all read | **State**: bulk state change |
| 4.9.7 | Mark already-read as read | Same read notification | 200, no error | **Control Flow**: idempotent |
| 4.9.8 | Delete notification | `DELETE /:id` | 200 | **Control Flow**: soft/hard delete |
| 4.9.9 | Get single notification | `GET /:id` | 200, notification DTO | **Black-box**: lookup by ID |
| 4.9.10 | SSE stream (recipient matches auth) | `GET /stream/:recipientId` | SSE connection, events received | **Integration**: SSE proxy + EventEmitter |
| 4.9.11 | Notification emitted on achievement event | RabbitMQ `achievement.badge.earned` | Notification created + SSE push | **Integration**: event bus → handler → creation → SSE |

### 4.10 File Service — Presigned URLs

**Methodology:** Control Flow, Domain Analysis

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.10.1 | Create presigned upload URL | `{ name, size, mimeType }` | 201, uploadUrl | **Control Flow**: happy path MinIO presigning |
| 4.10.2 | Create with invalid mimeType | `{ mimeType: "" }` | 400 | **Domain**: mime type validation |
| 4.10.3 | Create with zero size | `{ size: 0 }` | 400 | **BVA**: size > 0 |
| 4.10.4 | Create with excessive size | `{ size: 1TB }` | 400 | **BVA**: max size exceeded |
| 4.10.5 | Orphan cleanup job | — | Old refCount=0 files deleted | **Control Flow**: BullMQ worker |

### 4.11 Achievement Service — Badge Assignment

**Methodology:** Domain Analysis, State Transition

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.11.1 | List all badges | GET /badges | 200, badge definitions | **Black-box**: read-only |
| 4.11.2 | Get user badges | GET /badges/my | 200, earned badges | **Black-box**: user-specific |
| 4.11.3 | Get user progress | GET /badges/my/progress | 200, progress on criteria | **Domain**: partial criteria met |
| 4.11.4 | Badge earned via login streak | 7 consecutive logins | Badge: "Login Streak" + event | **State Transition**: streak accumulation |
| 4.11.5 | Badge earned via exam attempts | 10 perfect attempts | Badge: "Perfect Score" + event | **State Transition**: count threshold |

### 4.12 Resource Service — Blogs, Flashcards, Reports

**Methodology:** Standard CRUD (Black-box + State), BVA

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.12.1 | Create blog | `{ title, content, tags }` | 201 | **Black-box**: valid input |
| 4.12.2 | List blogs with pagination | `?page=1&limit=10` | 200 | **BVA**: page=0 → first, page=N → last |
| 4.12.3 | Create flashcard in list | `{ word, definition }` | 201 | **State**: card attached to list |
| 4.12.4 | Remove card from list | cardId | 200 | **State**: orphan check |
| 4.12.5 | Create report | `{ type, title, description, targetType, targetId }` | 201 | **Black-box**: valid report |
| 4.12.6 | Create report with files | fileIds | 201, reportFile relations | **Domain**: file attachment |
| 4.12.7 | Update report status (head_staff) | `{ status: Resolved, adminResponse }` | 200 | **State Transition**: pending→resolved |

---

## 5. Testing Infrastructure Setup

### 5.1 Testcontainers Configuration

```typescript
// jest-containers.setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();

  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUri();

  // Run Prisma migrations
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../apps/auth'),
    env: { ...process.env, DATABASE_URL: pgContainer.getConnectionUri() },
  });
});

afterAll(async () => {
  await pgContainer?.stop();
  await redisContainer?.stop();
});
```

### 5.2 Test Module Factory (per service)

```typescript
// test/module-factory.ts
export async function createAuthTestModule() {
  const module = await Test.createTestingModule({
    imports: [AuthModule],
  })
    .overrideProvider('FILE_CLIENT')
    .useValue(mockFileClient)
    .overrideProvider(AmqpConnectionManager)
    .useValue(mockAmqpConnection)
    .compile();

  const app = module.createNestApplication();
  // Connect gRPC microservice
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: { package: 'auth', protoPath: join(__dirname, '../proto/auth.proto') },
  });
  await app.startAllMicroservices();
  return app;
}
```

### 5.3 Gateway Integration Test Setup

For gateway-level tests, use Supertest against an in-memory NestJS app with mocked gRPC clients:

```typescript
describe('Auth Gateway', () => {
  let app: INestApplication;
  let mockAuthService: MockType<auth.AuthServiceClient>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthGatewayModule],
    })
      .overrideProvider(AUTH_CLIENT)
      .useValue(mockGrpcClient)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    app.useGlobalGuards(/* ... */);
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
  });

  it('POST /register -> 201', async () => {
    mockAuthService.registerMail.mockResolvedValue({ accessToken: '...' });
    return request(app.getHttpServer())
      .post('/register')
      .send({ mail: 'a@b.com', password: 'Abc123!', username: 'test' })
      .expect(201);
  });
});
```

---

## 6. Test Execution

### Commands

```bash
# Run all tests (via Nx)
pnpm exec nx run-many -t test

# Run specific service tests
pnpm exec nx test auth
pnpm exec nx test gateway
pnpm exec nx test exam

# Run with coverage
pnpm exec nx test auth --coverage

# Run with watch mode
pnpm exec nx test auth --watch
```

### CI Integration

The existing CI pipeline (`.github/workflows/ci-cd.yml`) already has test step:
```yaml
- name: Tests
  run: pnpm exec nx run-many -t test
```

Testcontainers require Docker. In CI, this is available via the GitHub Actions `docker` service (or use `service:` for DB).

---

## 7. Coverage Targets

| Element | Target | Measurement |
|---|---|---|
| Lines | ≥80% | `--coverage` |
| Branches | ≥75% | `--coverage` |
| Functions | ≥85% | `--coverage` |
| Guards (Roles/Permissions/Resource) | 100% MCDC | Manual verification |
| gRPC controller (Auth Service) | 100% | Each method called |
| Command handlers | 100% | Each command executed |
| RabbitMQ event publishers | 100% | Events published on trigger |

---

## 8. Bug Regression Tests

From `api-bugs-found.md`, the following bugs must have regression tests:

| Bug | File/Location | Regression Test |
|---|---|---|
| `createRoom` wrong Prisma `where` | `apps/live/src/.../room.repository.ts` | Test 4.7.3, 4.7.5 |
| Missing `@SerializeOptions` on 13 endpoints | Various gateway controllers | Each endpoint test checks serialization |
| 502/500 errors on notification/blog/report creation | Gateway→gRPC error mapping | Tests 4.9.1, 4.12.1, 4.12.5 |
| Wrong HTTP status on `google/tokens` | `auth.router.controller.ts:146` | Test with expired loginToken |
| Delete goal without goal set | Goals endpoint | Guard test with no existing goal |

---

## 9. File Organization

```
apps/
├── auth/
│   └── src/
│       └── __tests__/
│           ├── auth-grpc.controller.spec.ts       (4.1, 4.2, 4.3)
│           ├── mail-register.handler.spec.ts       (unit-level flow)
│           ├── mail-login.handler.spec.ts
│           └── token.service.spec.ts               (4.3)
├── gateway/
│   └── src/
│       └── __tests__/
│           ├── auth-gateway.integration.spec.ts    (4.1, 4.2)
│           ├── guards.integration.spec.ts          (4.4)
│           ├── exam-management.integration.spec.ts (4.5)
│           ├── exam-practice.integration.spec.ts   (4.6)
│           ├── live-gateway.integration.spec.ts    (4.7)
│           ├── live-ws.integration.spec.ts         (4.8)
│           └── notification.integration.spec.ts    (4.9)
├── live/
│   └── src/
│       └── __tests__/
│           ├── chat.gateway.spec.ts                (4.8)
│           ├── chat.service.spec.ts                (4.7)
│           └── chat.controller.spec.ts
├── notification/
│   └── src/
│       └── __tests__/
│           ├── notification.service.spec.ts        (4.9)
│           └── notification-sse.service.spec.ts
├── exam/
│   └── src/
│       └── __tests__/
│           ├── exam-management.handlers.spec.ts    (4.5)
│           ├── exam-practice.handlers.spec.ts      (4.6)
│           └── tag.service.spec.ts
└── resource/
    └── src/
        └── __tests__/
            └── resource.service.spec.ts             (4.12)
```

---

## Appendix A: Methodology Reference

| Method | Description | Example Use |
|---|---|---|
| **ECP (Equivalence Partitioning)** | Partition input domain into classes expected to behave equivalently | Email validation: valid/invalid/missing |
| **BVA (Boundary Value Analysis)** | Test exact boundaries of equivalence classes | Password: min length=6, test at 5,6,7 |
| **Decision Table** | Systematic coverage of multiple boolean conditions | Auth guards: {isPublic, isAuth, hasRole} × {allow,deny} |
| **MCDC** | Every condition independently affects decision outcome | ResourceAccess: Admin ∨ (Mod ∧ Owner) |
| **Control Flow** | Exercise every statement and branch | Attempt handler: "if submitted → return, else → process" |
| **State Transition** | Test all valid state transitions and invalid ones | Attempt: IDLE→IN_PROGRESS→SUBMITTED |
| **Domain Analysis** | Identify valid/invalid regions of complex domains | URL pattern matching for YouTube/Twitch |
| **Error-Guessing** | Intuitively target common error patterns | SQL injection, race conditions, null values |
