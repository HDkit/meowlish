# engapp-v2 Integration Test Plan — Backend (Jest)

**Project:** engapp-v2 Backend (NestJS 11, TypeORM, PostgreSQL, JWT auth)  
**Framework:** Jest 30 with `ts-jest`, Supertest for HTTP E2E  
**Date:** 2026-05-25  

---

## 1. Testing Strategy

### Scope
Integration tests verify that HTTP controllers work correctly with their services, TypeORM repositories, and the database. Tests exercise real NestJS modules with a test database (SQLite or testcontainers PostgreSQL), mocking only external services (gRPC, S3, OpenAI, ElevenLabs, Resend/SMTP, Google APIs).

### Test Pyramid Placement

```
     /\
    /E2E\       ← few: full user flows (existing test/app.e2e-spec.ts)
   /─────\
  /Integration\ ← many: controller + service + DB
 /─────────────\
/    Unit       \ ← some: pure service logic, helpers
```

### Methodology Selection Table

| Methodology | When Applied |
|---|---|
| **Black-box (Equivalence Partitioning)** | HTTP endpoint input validation, DTO validation |
| **Boundary Value Analysis (BVA)** | Pagination (page, limit), date ranges, numeric fields |
| **Decision Table** | Role-based access (RolesGuard), booking status transitions |
| **Control Flow (Statement/Branch)** | Service methods with conditional branches |
| **MCDC** | `ProtectedRoute` role conditions: `allowedRoles && user.roles.some(r => ...)` |
| **State Transition** | Booking lifecycle, enrollment lifecycle, payment lifecycle |
| **Domain Analysis** | Input DTO validation (email format, date format, slot time format) |
| **Error-Guessing** | Edge cases: duplicate email, locked user, missing required fields |

---

## 2. Test Architecture

### Test Double Strategy

| Component | Approach | Tool |
|---|---|---|
| **Database** | SQLite in-memory (for speed) or testcontainers PostgreSQL | `typeorm` SQLite driver or `@testcontainers/postgresql` |
| **gRPC (Auth service)** | Mocked service class | `jest.fn()` |
| **S3 (File upload)** | Mocked service | `jest.fn()` |
| **OpenAI / ElevenLabs / Resend** | Mocked at service boundary | `jest.mock()` |
| **Google Calendar API** | Mocked | `jest.fn()` |
| **JWT** | Real signing with test secret | `@nestjs/jwt` |
| **SePay webhook** | Stubbed external | `nock` |

### Existing Test Infrastructure

- **Jest config**: `jest` (unit) in `package.json`, `jest --config ./test/jest-e2e.json` (E2E)
- **Existing test file**: `test/app.e2e-spec.ts` — covers health, students, teachers, courses, bookings, parents
- **Module structure**: Each module has `.module.ts` importing TypeORM entities, controller, service

### Recommended Test Module Factory

```typescript
// test/module-factory.ts
export async function createTestApp() {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AuthGrpcClient)
    .useValue(mockAuthGrpc)
    .overrideProvider(S3Service)
    .useValue(mockS3Service)
    .overrideProvider(EmailService)
    .useValue(mockEmailService)
    .overrideProvider(OpenAI)
    .useValue(mockOpenAI)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}
```

---

## 3. Test Module Organization & Prioritization

```
Priority 1 (Core infrastructure):
├── 3.1  Auth — register, login, profile, ensure-profile
├── 3.2  Auth guards — JwtAuthGuard, RolesGuard

Priority 2 (Primary business flows):
├── 3.3  Students — CRUD, enrollment, learning history, videos, AI stats
├── 3.4  Teachers — listing, filtering, availability, teaching courses
├── 3.5  Courses — listing, current, details, modules
├── 3.6  Bookings — create, cancel, complete, meeting lifecycle, feedback

Priority 3 (Secondary flows):
├── 3.7  Parents — children, payments, learning history
├── 3.8  Programs — CRUD programs/cohorts/courses/modules, enrollment
├── 3.9  AI Practice — chat, feedback, transcribe, TTS
├── 3.10 Payments — create pending, process, webhook

Priority 4 (Admin & support):
├── 3.11 Admin — user CRUD, statistics, lock/unlock, bulk create
├── 3.12 Notifications — list, read, unread count
├── 3.13 Chat — conversations, messages, admin operations
├── 3.14 Connections — create/delete parent/teacher links
├── 3.15 Weekly Focus — CRUD, mentor brief
├── 3.16 Google Auth — exchange code, status, disconnect
```

---

## 4. Detailed Test Cases

### 4.1 Auth — `POST /api/auth/register`

**Methodology:** Black-box (ECP + BVA), Decision Table, Domain Analysis

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.1.1 | Valid register (student) | `{ email, password, fullName, role: "student" }` | 201, tokens + user | **ECP**: all fields valid |
| 4.1.2 | Duplicate email | Same email twice | 409 Conflict | **Domain**: email unique constraint |
| 4.1.3 | Duplicate phone | Same phone twice | 409 Conflict | **Domain**: phone unique constraint |
| 4.1.4 | Invalid email format | `{ email: "bad" }` | 400 Bad Request | **Domain**: validation pipe rejects |
| 4.1.5 | Password too short | `{ password: "12" }` | 400 | **BVA**: min length violated |
| 4.1.6 | Register parent with phone | `{ role: "parent", phone }` | 201 | **Decision Table**: parent role→creates Parent entity |
| 4.1.7 | Register teacher | `{ role: "teacher", teacherType }` | 201 | **Decision Table**: teacher role→creates Teacher entity |
| 4.1.8 | Register without required fields | `{}` | 400 | **ECP**: missing required fields |
| 4.1.9 | gRPC failure during register | gRPC throws | 409 Conflict (wrapped) | **Control Flow**: catch + rethrow |
| 4.1.10 | Auto-enroll after student register | New student created | Enrollment created for active course | **State**: post-register side effect |

### 4.2 Auth — `POST /api/auth/login`

**Methodology:** Decision Table, State Transition

| Condition | Valid creds | Wrong pwd | Locked user | Non-existent |
|---|---|---|---|---|
| **Outcome** | 200 + tokens | 401 | 401 | 401 |

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.2.1 | Correct credentials | Valid email+password | 200, tokens + user | **Decision Table**: R1 |
| 4.2.2 | Wrong password | Valid email + bad pwd | 401 | **Decision Table**: R2 |
| 4.2.3 | Non-existent email | `{ email: "no@one.com" }` | 401 | **Decision Table**: R4 |
| 4.2.4 | Login session recorded | Valid login | LoginSession created | **State**: session creation side effect |
| 4.2.5 | gRPC login failure | gRPC throws | 401 wrapped | **Control Flow**: catch→throw |

### 4.3 Auth — `GET /api/auth/profile`, `GET /api/auth/me`, `POST /api/auth/ensure-profile`

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.3.1 | Get profile (authenticated) | JWT header | 200, user+profile | **Control Flow**: JWT guard→service |
| 4.3.2 | Get profile (no token) | No header | 401 | **Decision Table**: JwtAuthGuard |
| 4.3.3 | Get me (authenticated) | JWT header | 200, req.user | **Control Flow**: guard passes user |
| 4.3.4 | Ensure profile — existing user | Exists locally | 200, existing user | **Control Flow**: find + return |
| 4.3.5 | Ensure profile — new user | Not found, create student | 201, new user | **Control Flow**: create profile + auto-enroll |
| 4.3.6 | Ensure profile — invalid token | Bad token | 401 | **Domain**: verifyToken fails |

### 4.4 RolesGuard — Access Control

**Methodology:** Decision Table, MCDC

Decision table for `@Roles(UserRole.ADMIN)` on admin controller:

| Authenticated? | Has role ADMIN? | Result |
|---|---|---|
| T | T | ✅ |
| F | — | ❌ 403 (JWT guard first) |
| T | F | ❌ 403 |

| # | Test Case | Auth | Role | Endpoint | Expected |
|---|---|---|---|---|---|
| 4.4.1 | Admin accesses admin endpoint | T | admin | `GET /api/admin/users` | 200 |
| 4.4.2 | Student accesses admin endpoint | T | student | `GET /api/admin/users` | 403 |
| 4.4.3 | No auth accesses admin endpoint | F | — | `GET /api/admin/users` | 401 |
| 4.4.4 | No roles decorator = public | T/F | any | `GET /api/health` | 200 |

MCDC for ProtectedRoute logic (Frontend):
```
allowedRoles && user.roles.some(r => allowedRoles.includes(r))
```
- C1: `allowedRoles` is defined
- C2: `user` exists  
- C3: at least one of `user.roles` is in `allowedRoles`

### 4.5 Students — `GET /api/students`

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.5.1 | List all students | GET /api/students | 200, array | **Black-box**: read-all |
| 4.5.2 | Get student by ID (exists) | id=1 | 200, student object | **Black-box**: valid lookup |
| 4.5.3 | Get student by ID (not found) | id=9999 | 404 | **Control Flow**: not found |
| 4.5.4 | Get student (locked user) | Student's user.isLocked=true | 404 | **Control Flow**: locked check |
| 4.5.5 | Get enrollment | studentId=1 | 200, enrollment+course+modules | **Domain**: nested relations |
| 4.5.6 | Get enrollment (no enrollment) | New student | 200, null | **Control Flow**: null return |
| 4.5.7 | Get learning history | studentId=1 | 200, array with aiFeedbacks | **Domain**: history with parsed feedback |
| 4.5.8 | Get learning history filtered by module | `?moduleId=1` | 200, filtered | **ECP**: module filter |
| 4.5.9 | Create learning history | `{ activityType, aiFeedback }` | 200, updated list | **State**: history creation |
| 4.5.10 | Get progress videos (before & after) | studentId=1, courseId=1 | `{ beforeVideo, afterVideo }` | **Domain**: two video types |
| 4.5.11 | Get progress videos (none) | No videos uploaded | `{ beforeVideo: null, afterVideo: null }` | **Control Flow**: empty state |
| 4.5.12 | Get connections | studentId=1 | Array of connected users with teacher details | **Domain**: link traversal |
| 4.5.13 | Get AI practice weekly stats | `?weeks=8` | Weekly data + totals + streak | **Domain Analysis**: week alignment + streak computation |
| 4.5.14 | Upload progress video (valid) | FormData: video file, videoType, courseId | 200, updated videos | **Control Flow**: S3 upload + save |
| 4.5.15 | Upload video without file | No file | 400 | **Domain**: file required |
| 4.5.16 | Upload video invalid type | videoType="invalid" | 400 | **Domain**: must be before/after |
| 4.5.17 | Upload video (non-video mime) | image file | 400 | **Domain**: fileFilter rejects |
| 4.5.18 | Delete progress video | `?videoType=before&courseId=1` | 200, removed | **State**: video deleted |

### 4.6 Teachers

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.6.1 | List all teachers | GET /api/teachers | 200, array | **Black-box** |
| 4.6.2 | Filter by type | `?type=video_call` | Filtered results | **ECP**: type filter |
| 4.6.3 | Get video call teachers | GET /api/teachers/video-call | Only video_call+both types | **Domain**: query filters |
| 4.6.4 | Get mentors | GET /api/teachers/mentors | TEACHER/MENTOR, not IN_PERSON | **Decision Table**: role+type filter |
| 4.6.5 | Get teacher by ID | id=1 | 200, formatted with specialties | **Control Flow**: format |
| 4.6.6 | Get teacher (not found) | id=9999 | 404 | **Control Flow**: not found |
| 4.6.7 | Get availability (weekend) | `?date=2026-03-07` (Saturday) | Slots array | **Domain**: dayOfWeek=6→returns slots |
| 4.6.8 | Get availability (weekday) | `?date=2026-03-09` (Monday) | Message: weekend only | **Domain**: dayOfWeek≠0,6 |
| 4.6.9 | Get availability with existing bookings | Booked slots marked unavailable | `isAvailable: false` for booked slots | **State**: booked vs available |
| 4.6.10 | Get teaching courses | teacherId=1 | CohortCourse list with cohort+program | **Domain**: cohort course relations |

### 4.7 Courses

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.7.1 | List courses | GET /api/courses | 200, array with modules | **Black-box** |
| 4.7.2 | Get current course | GET /api/courses/current | 200, course or null | **Domain**: status-based query |
| 4.7.3 | Get course by ID | id=1 | 200, course+modules | **Control Flow**: relations |
| 4.7.4 | Get course modules | id=1 | Array of modules | **Domain**: module ordering |

### 4.8 Bookings — Full Lifecycle

**Methodology:** State Transition (primary), BVA, Domain Analysis, Decision Table

Booking states:
```
[PENDING] ──create──► [CONFIRMED] ──cancel──► [CANCELLED]
                          │
                          ├──complete──► [COMPLETED] ──rate──► (rating added)
                          │
                          ├──start-meeting──► [IN_PROGRESS] ──end-meeting──► [ENDED]
                          │
                          └──no-show──► [NO_SHOW]
```

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.8.1 | Create booking (valid) | `{ studentId, teacherId, moduleId, bookingDate (Saturday), slotStartTime }` | 201, status=confirmed | **State**: PENDING→CONFIRMED |
| 4.8.2 | Create booking (invalid date format) | `bookingDate: "14-03-2026"` | 400 | **Domain**: date format validation |
| 4.8.3 | Create booking (weekday) | Monday | 400 | **Domain**: weekend only |
| 4.8.4 | Create booking (conflict) | Same teacher+time slot | 400 | **State**: slot already booked |
| 4.8.5 | Find by student | `?studentId=1` | 200, bookings array | **Black-box**: read |
| 4.8.6 | Find by teacher | teacherId=1 | 200, bookings array | **Black-box**: read |
| 4.8.7 | Get single booking | id=1 | 200, booking | **Black-box**: lookup |
| 4.8.8 | Complete booking | `PATCH /:id/complete` | Status→completed | **State**: CONFIRMED→COMPLETED |
| 4.8.9 | Cancel booking | `PATCH /:id/cancel` | Status→cancelled | **State**: CONFIRMED→CANCELLED |
| 4.8.10 | Cancel already-cancelled booking | Cancel same booking | 400 | **State**: already cancelled |
| 4.8.11 | Start meeting (JWT required) | `{ teacherId }` | meetingStatus=in_progress | **State**: CONFIRMED→IN_PROGRESS |
| 4.8.12 | Start meeting (no auth) | No JWT | 401 | **Decision Table**: JwtAuthGuard |
| 4.8.13 | End meeting | `{ teacherId }` | meetingStatus=ended, endedAt set | **State**: IN_PROGRESS→ENDED |
| 4.8.14 | Add teacher feedback (JWT) | `{ teacherId, feedback }` | 200, teacherFeedback saved | **State**: feedback added |
| 4.8.15 | Add student rating (JWT) | `{ studentId, rating: 5, comment }` | 200, rating+comment saved | **Domain**: rating bounds |
| 4.8.16 | Add rating (out of range) | rating=10 | 400 (validation) | **BVA**: rating > 5 rejected |

### 4.9 Parents

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.9.1 | Get parent by ID | id=1 | 200 | **Black-box** |
| 4.9.2 | Get parent (not found) | id=9999 | 404 | **Control Flow** |
| 4.9.3 | Get children | parentId=1 | Array of children via account_links | **Domain**: link traversal |
| 4.9.4 | Get child enrollment | parentId, studentId | Enrollment | **Domain**: nested parent→child→enrollment |
| 4.9.5 | Get child learning history | parentId, studentId | Array | **Domain**: same as student path |
| 4.9.6 | Get child progress videos | parentId, studentId, courseId | Videos | **Domain**: delegated to students service |
| 4.9.7 | Get child AI practice stats | parentId, studentId, weeks | Stats | **Domain**: delegated to students service |
| 4.9.8 | Get parent payments | parentId | Array | **Domain**: payment relations |

### 4.10 Programs — Full CRUD + Enrollment

**Methodology:** Control Flow, State Transition, Domain Analysis

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.10.1 | Get all programs (public) | GET /api/programs | 200, programs with cohorts+courses | **Black-box**: public read |
| 4.10.2 | Create program (JWT required) | `{ name, description }` | 201 | **Decision Table**: auth required |
| 4.10.3 | Create program (no auth) | No JWT | 401 | **Decision Table**: guard |
| 4.10.4 | Update program | `PUT /:id` with name change | 200, updated | **State**: CRUD update |
| 4.10.5 | Delete program | `DELETE /:id` | 200, success | **State**: CRUD delete |
| 4.10.6 | Create cohort | `{ name, startDate, programId }` | 201 | **State**: cohort in program |
| 4.10.7 | Create cohort-course | `{ cohortId, courseId, teacherId }` | 201 | **State**: course linked to cohort |
| 4.10.8 | Create module | `{ courseId, moduleNumber, title, topic }` | 201 | **State**: module in course |
| 4.10.9 | Create module with content JSON | `{ mondayContent, aiPracticeContent, teacherSessionContent }` | 201, JSON stored | **Domain**: JSONB fields |
| 4.10.10 | Enroll student | `{ studentId, cohortCourseId }` | 201, enrollment created | **State**: enrollment |
| 4.10.11 | Duplicate enrollment | Same student+cohort-course | 409 | **Domain**: unique constraint |
| 4.10.12 | Unenroll student | `DELETE /enroll/:studentId/:cohortCourseId` | 200 | **State**: removal |
| 4.10.13 | Mark enrollment as paid | `POST /enrollment/pay` | 200 | **State**: pending→paid |
| 4.10.14 | Get student enrollments (formatted) | studentId | Array with course details | **Domain**: formatted aggregation |
| 4.10.15 | Enroll by user ID | `{ userId, cohortCourseId }` | 201 | **Control Flow**: user→student lookup |

### 4.11 AI Practice

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.11.1 | Chat with AI | `{ studentId, moduleId, message, history }` | 200, `{ content }` | **Black-box**: OpenAI call |
| 4.11.2 | Chat (OpenAI error) | Mocked error | 500, handled | **Control Flow**: catch→throw |
| 4.11.3 | Generate feedback | `{ studentId, moduleId, transcript }` | 200, `{ feedback }` | **Control Flow**: OpenAI call |
| 4.11.4 | Transcribe audio | FormData with audio file | 200, transcribed text | **Control Flow**: Whisper API |
| 4.11.5 | Transcribe without audio | No file | 400 | **Domain**: file required |
| 4.11.6 | Text-to-speech | `{ text: "hello" }` | 200, audio/mpeg binary | **Control Flow**: ElevenLabs API |
| 4.11.7 | TTS with empty text | `{ text: "" }` | 400 | **Domain**: empty text rejected |

### 4.12 Payments

**Methodology:** State Transition, Domain Analysis, Error-Guessing

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.12.1 | Create pending payment | `{ studentId }` | 200, transactionCode + amount | **State**: creates PENDING payment |
| 4.12.2 | Process payment | `{ studentId, moduleId, amount }` | 200, success | **State**: PENDING→COMPLETED |
| 4.12.3 | Check payment status (paid) | Student with completed payment | `{ paid: true, paidAt }` | **State**: paid check |
| 4.12.4 | Check payment status (no payment) | New student | `{ paid: false }` | **State**: no payment |
| 4.12.5 | SePay webhook (valid API key) | POST with valid key | Processed webhook | **Domain**: API key verification |
| 4.12.6 | SePay webhook (invalid API key) | POST with wrong key | `{ success: false }` | **Control Flow**: key mismatch |
| 4.12.7 | SePay webhook health | GET /payments/sepay-webhook | `{ status: "ok" }` | **Black-box**: health check |

### 4.13 Admin

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.13.1 | Get user statistics | GET | 200, total+breakdown | **Domain**: aggregate query |
| 4.13.2 | Get visit statistics | `?hours=24` | 200, hourlyData | **Domain**: time-bucketed |
| 4.13.3 | Get practice statistics | `?hours=24` | 200, AI + video call data | **Domain**: split by activity type |
| 4.13.4 | List users (paginated) | `?page=1&limit=10` | 200, users+pagination | **BVA**: page/limit boundaries |
| 4.13.5 | List users (filter by role) | `?role=student` | Filtered | **ECP**: role filter |
| 4.13.6 | List users (search) | `?search=john` | Matched by name/email | **Domain**: search query |
| 4.13.7 | Get user by ID | id=1 | 200 | **Black-box** |
| 4.13.8 | Update user | `{ fullName }` | 200, updated | **State**: update |
| 4.13.9 | Toggle user lock | `PATCH /users/:id/lock` | isLocked toggled | **State**: locked→unlocked or vice versa |
| 4.13.10 | Create user (admin) | `{ email, password, fullName, role }` | 201 | **State**: user created |
| 4.13.11 | Update user role | `{ role: "teacher" }` | 200, role changed | **State**: role transition |
| 4.13.12 | Bulk create users | `{ users: [10 records] }` | 200, counts | **BVA**: bulk edge cases |

### 4.14 Notifications

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.14.1 | List by user | `?userId=1` | Array | **Black-box** |
| 4.14.2 | Get unread count | `?userId=1` | `{ count }` | **Domain**: aggregation |
| 4.14.3 | Mark as read | `PATCH /:id/read` | 200 | **State**: unread→read |
| 4.14.4 | Mark all as read | `PATCH /mark-all-read?userId=1` | All user's notifications read | **State**: bulk update |

### 4.15 Chat

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.15.1 | Get or create conversation (JWT) | POST /chat/conversations | 200, conversation | **State**: find or create |
| 4.15.2 | Get user conversations | GET /chat/conversations/my | Array with unreadCount | **Domain**: aggregation |
| 4.15.3 | Get user unread count | GET /chat/user/unread-count | `{ count }` | **Domain**: aggregation |
| 4.15.4 | Get conversation messages (owner) | /conversations/:id/messages | Array | **Control Flow**: role-based access |
| 4.15.5 | Get conversation messages (admin) | Admin role | Same, different access path | **Decision Table**: role branch |
| 4.15.6 | Send message | POST .../messages | Created message | **State**: message added |
| 4.15.7 | Get all conversations (admin) | /chat/admin/conversations | Paginated with unread+lastMessage | **Decision Table**: RolesGuard |
| 4.15.8 | Close conversation (admin) | PATCH .../close | Status→closed | **State**: OPEN→CLOSED |

### 4.16 Connections

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.16.1 | Create connection (parent→student) | `{ studentId, email (parent), linkType: "parent" }` | 201, connection created + notification | **State**: link created |
| 4.16.2 | Create connection (teacher→student) | `linkType: "teacher"` | 201 | **State**: teacher link |
| 4.16.3 | Create connection (non-existent email) | Bad email | 404 | **Control Flow**: user not found |
| 4.16.4 | Delete connection | id=1 | 200 | **State**: link removed |

### 4.17 Weekly Focus

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.17.1 | Create weekly focus | `{ moduleId, teacherId, weekTopic, speakingGoals }` | 201 | **State**: created |
| 4.17.2 | Get by module | `GET /weekly-focus/module/:moduleId` | 200, focus or null | **Domain**: module lookup |
| 4.17.3 | Get by teacher (JWT) | `GET /weekly-focus/teacher/:teacherId` | Array | **Decision Table**: auth required |
| 4.17.4 | Update weekly focus | `{ speakingGoals }` | 200, updated | **State**: updated |
| 4.17.5 | Get mentor brief | `?studentId=&moduleId=` | Combined focus + AI stats | **Domain**: cross-entity aggregation |

### 4.18 Google Auth

| # | Test Case | Input | Expected | Method Reasoning |
|---|---|---|---|---|
| 4.18.1 | Exchange Google code | `{ code }` with valid Google OAuth code | Exchanged with Google API, calendar connected | **Control Flow**: external API call |
| 4.18.2 | Exchange Google code (Google API fails) | Invalid code | 401 | **Control Flow**: fetch fails |
| 4.18.3 | Check connection status | GET /google/status | `{ connected, email }` | **Black-box**: status |
| 4.18.4 | Disconnect | DELETE /google/disconnect | 200 | **State**: connected→disconnected |

---

## 5. Testing Infrastructure

### Database Strategy

Use SQLite in-memory for unit/service tests (fast), PostgreSQL testcontainers for full E2E:

```typescript
// test/database-test-utils.ts
import { SqliteDriver } from '@mikro-orm/sqlite'; // or use typeorm SQLite

export function useSqliteModule(): TypeOrmModuleOptions {
  return {
    type: 'sqlite',
    database: ':memory:',
    entities: [/* all entities */],
    synchronize: true,
  };
}
```

### gRPC Mock

```typescript
// test/mocks/auth-grpc.mock.ts
export const mockAuthGrpcClient = {
  registerMail: jest.fn().mockResolvedValue({ accessToken: 'mock-at', refreshToken: 'mock-rt', identity: { id: 'test-uid' } }),
  loginMail: jest.fn().mockResolvedValue({ accessToken: 'mock-at', refreshToken: 'mock-rt', identity_id: 'test-uid' }),
  validateAccess: jest.fn().mockResolvedValue({}),
  assignRoleTo: jest.fn().mockResolvedValue({}),
};
```

### Running Tests

```bash
# Unit tests
npm test

# E2E tests (requires DB)
npm run test:e2e

# Coverage
npm run test:cov
```

---

## 6. Coverage Targets

| Element | Target | Method |
|---|---|---|
| Lines | ≥75% | `--coverage` |
| Branches (services) | ≥70% | `--coverage` |
| Controller route coverage | 100% | Each endpoint tested |
| Auth guards | 100% MCDC | Manual verification |
| Booking state transitions | 100% | All 5 states covered |

---

## 7. Existing E2E Test Gaps

The existing `test/app.e2e-spec.ts` covers basic CRUD but is missing:

| Missing Area | Gap | New Tests to Add |
|---|---|---|
| Auth (register) | No register test | 4.1.1–4.1.10 |
| Auth (guards) | No 401/403 tests | 4.4.1–4.4.4 |
| Bookings (cancellation edge cases) | Already-cancelled | 4.8.10 |
| Bookings (meeting lifecycle) | Start/end meeting | 4.8.11–4.8.13 |
| Teachers (availability + booking overlap) | Booked slots | 4.6.9, 4.8.4 |
| Programs CRUD | No test at all | 4.10.1–4.10.15 |
| Admin | No test at all | 4.13.1–4.13.12 |
| AI Practice | No test at all | 4.11.1–4.11.7 |
| Chat | No test at all | 4.15.1–4.15.8 |
| Payments + webhook | No test at all | 4.12.1–4.12.7 |
| Notifications | No test at all | 4.14.1–4.14.4 |
| Weekly Focus | No test at all | 4.17.1–4.17.5 |

---

## 8. File Organization

```
test/
├── app.e2e-spec.ts                    (existing, expand)
├── jest-e2e.json                       (existing)
├── module-factory.ts                   (new)
├── mocks/
│   ├── auth-grpc.mock.ts               (new)
│   ├── s3-service.mock.ts              (new)
│   ├── email-service.mock.ts           (new)
│   └── openai-service.mock.ts          (new)
└── e2e/
    ├── auth.e2e-spec.ts               (4.1, 4.2, 4.3, 4.4)
    ├── students.e2e-spec.ts           (4.5)
    ├── teachers.e2e-spec.ts           (4.6)
    ├── courses.e2e-spec.ts            (4.7)
    ├── bookings.e2e-spec.ts           (4.8)
    ├── parents.e2e-spec.ts            (4.9)
    ├── programs.e2e-spec.ts           (4.10)
    ├── ai-practice.e2e-spec.ts        (4.11)
    ├── payments.e2e-spec.ts           (4.12)
    ├── admin.e2e-spec.ts              (4.13)
    ├── notifications.e2e-spec.ts      (4.14)
    ├── chat.e2e-spec.ts               (4.15)
    ├── connections.e2e-spec.ts        (4.16)
    ├── weekly-focus.e2e-spec.ts       (4.17)
    └── google-auth.e2e-spec.ts        (4.18)
```

---

## Appendix A: engapp-v2 Entity Relationships

```
User ──1:1──► Student
User ──1:1──► Parent
User ──1:1──► Teacher
Student ──N:1──► Teacher (assignedInpersonTeacher)
Student ──1:N──► Enrollment ──N:1──► Course
Course ──1:N──► Module
Student ──1:N──► LearningHistory ──1:N──► AiFeedback
Student ──1:N──► LearningHistory ──1:N──► TeacherFeedback
Student ──1:N──► StudentVideo (before/after)
Student ──1:N──► AccountLink ──N:1──► User (parent/teacher)
Student ──1:N──► Booking ──N:1──► Teacher
Booking ──N:1──► Module
Program ──1:N──► Cohort ──1:N──► CohortCourse ──N:1──► Teacher
CohortCourse ──N:1──► Course
Student ──1:N──► StudentCohortEnrollment ──N:1──► CohortCourse
User ──1:N──► ChatConversation (as user or admin)
ChatConversation ──1:N──► ChatMessage ──N:1──► User (sender)
User ──1:N──► Notification
Teacher ──1:N──► WeeklyFocus ──N:1──► Module
Parent ──1:N──► Payment ──N:1──► Student
Payment ──N:1──► Course
```
