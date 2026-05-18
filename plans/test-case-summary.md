# Test Case Summary — All 4 Plan Files

**Grand Total: ~509 test cases**

| Plan | Tests | Share |
|---|---|---|
| 04 — server backend integration | 105 | 20.6% |
| 05 — english-prep frontend UI | ~148 | 29.1% |
| 06 — engapp-v2 backend integration | ~147 | 28.9% |
| 07 — engapp-v2 frontend UI | ~109 | 21.4% |

---

## Plan 1: `04-integration-test-plan.md` — server backend integration (20.6%)

| Feature / Module | Tests | % of Plan |
|---|---|---|
| Auth Gateway — Register | 8 | 7.6% |
| Auth Gateway — Login | 5 | 4.8% |
| Token Validation — Refresh | 6 | 5.7% |
| RolesGuard & PermissionsGuard (MCDC) | 5 | 4.8% |
| Exam Management — CRUD Flow | 12 | 11.4% |
| Exam Practice — Attempt Lifecycle | 18 | 17.1% |
| Live Chat — REST API | 14 | 13.3% |
| Live Chat — WebSocket (Socket.IO) | 9 | 8.6% |
| Notifications — CRUD + SSE | 11 | 10.5% |
| File Service — Presigned URLs | 5 | 4.8% |
| Achievement Service — Badge Assignment | 5 | 4.8% |
| Resource Service — Blogs, Flashcards, Reports | 7 | 6.7% |
| **Total** | **105** | **100%** |

## Plan 2: `05-ui-test-plan.md` — english-prep frontend UI (29.1%)

| Feature / Module | Tests | % of Plan |
|---|---|---|
| AuthForm — Login/Register | 16 | 10.8% |
| TestInterface — Exam Taking | 23 | 15.5% |
| Dashboard | 14 | 9.5% |
| WritingTest — Evaluation Wizard | 16 | 10.8% |
| ChatPage — Rooms & Messaging | 16 | 10.8% |
| ProgressTracker — Charts & History | 13 | 8.8% |
| Middleware — Route Protection | 5 | 3.4% |
| Redux Store — Persistence & Hydration | 5 | 3.4% |
| NotificationPage | 5 | 3.4% |
| ExamCreation — Builder UI | 6 | 4.1% |
| SpeakingSession — Recording Flow | 8 | 5.4% |
| E2E: Authentication Flow | 3 | 2.0% |
| E2E: Exam Authoring Flow | 1 | 0.7% |
| E2E: Moderation Flow | 1 | 0.7% |
| E2E: Writing Evaluation Flow | 1 | 0.7% |
| Visual Regression (UI components) | ~15 | 10.1% |
| **Total** | **~148** | **~100%** |

## Plan 3: `06-engapp-v2-integration-test-plan.md` — engapp-v2 backend (28.9%)

| Feature / Module | Tests | % of Plan |
|---|---|---|
| Auth — Register | 10 | 6.8% |
| Auth — Login | 5 | 3.4% |
| Auth — Profile/Me/Ensure-Profile | 6 | 4.1% |
| RolesGuard — Access Control | 4 | 2.7% |
| Students — CRUD + Enrollment + History | 18 | 12.2% |
| Teachers — List, Filter, Availability | 10 | 6.8% |
| Courses | 4 | 2.7% |
| Bookings — Full Lifecycle | 16 | 10.9% |
| Parents — Children, Payments, History | 8 | 5.4% |
| Programs — CRUD + Enrollment | 15 | 10.2% |
| AI Practice — Chat, Feedback, TTS | 7 | 4.8% |
| Payments — Create, Process, Webhook | 7 | 4.8% |
| Admin — Users, Stats, Lock/Bulk | 12 | 8.2% |
| Notifications — List, Read, Unread | 4 | 2.7% |
| Chat — Conversations, Messages, Admin | 8 | 5.4% |
| Connections — Parent/Teacher Links | 4 | 2.7% |
| Weekly Focus — CRUD, Mentor Brief | 5 | 3.4% |
| Google Auth — Exchange, Status, Disconnect | 4 | 2.7% |
| **Total** | **~147** | **~100%** |

## Plan 4: `07-engapp-v2-ui-test-plan.md` — engapp-v2 frontend UI (21.4%)

| Feature / Module | Tests | % of Plan |
|---|---|---|
| Login Page | 12 | 11.0% |
| Register Page | 5 | 4.6% |
| ProtectedRoute — Role-Based Access (MCDC) | 6 | 5.5% |
| Dashboard (Redirect Page) | 6 | 5.5% |
| Navigation Component | 6 | 5.5% |
| Student Dashboard | 6 | 5.5% |
| Teacher Dashboard | 5 | 4.6% |
| Booking Page | 8 | 7.3% |
| AI Practice Page | 7 | 6.4% |
| Parent Dashboard | 8 | 7.3% |
| Admin Dashboard | 11 | 10.1% |
| Theme Switcher | 4 | 3.7% |
| Language Switcher | 5 | 4.6% |
| Chat Widget | 5 | 4.6% |
| Rise Meter Component Suite | 7 | 6.4% |
| E2E: Authentication Flow | 4 steps | — |
| E2E: Booking Flow | 5 steps | — |
| E2E: Admin User Management | 5 steps | — |
| E2E: Program Management CRUD | 6 steps | — |
| E2E: Parent Dashboard Flow | 5 steps | — |
| Visual Regression (UI components) | ~3 | 2.8% |
| **Total** | **~109** | **~100%** |

---

## Overall Test Design Philosophy

### Method Selection by Layer & Feature

| Methodology | Applied When | Example |
|---|---|---|
| **State Transition** | Multi-step lifecycles with explicit states | Attempt lifecycle (`IDLE → IN_PROGRESS → SUBMITTED → SCORED`), booking lifecycle, writing evaluation wizard |
| **Control Flow (Statement/Branch)** | Any method with `if/else`, try/catch, conditional branches | Handlers with guard checks, polling loops, debounce timers |
| **Decision Table** | Role-based access, multi-condition guard logic | `ProtectedRoute`, `RolesGuard`, `ResourceAccessGuard`, form mode toggle (login vs register) |
| **MCDC** | Complex boolean conditions — each condition must independently flip the outcome | `Admin ∨ (Mod ∧ Owner)` in resource access; `isAuth && (!allowedRoles \|\| roles.some(...))` in route protection |
| **ECP (Equivalence Partitioning)** | Input validation — partition valid/invalid/edge | Email format, MCQ single vs multi-select, missing required fields |
| **BVA (Boundary Value Analysis)** | Numeric thresholds, string length limits | Password min=6 (test 5/6/7), pagination (0/1/N/100), rating max=5 |
| **Domain Analysis** | Complex domain-specific logic | URL validation (YouTube/Twitch patterns), streak computation (consecutive vs broken), score-to-CEFR mapping |
| **Error-Guessing** | Historically known bug patterns | SQL injection, race conditions, null values, duplicate constraints (from `api-bugs-found.md`) |
| **Visual Regression** | UI component snapshots | shadcn UI buttons, cards, dialogs |

### Core Principles

1. **Test Pyramid**: Unit (most) → Integration (many) → E2E (few). Integration tests use real DB (testcontainers/SQLite) with mocked external services. E2E tests intercept API at the HTTP level.

2. **Methodology → Feature Mapping**: Features with complex state machines get **State Transition**. Guard-heavy features get **Decision Table + MCDC**. Data-heavy features get **ECP + BVA + Domain Analysis**.

3. **100% Branch Coverage on Auth**: Auth guards, route protection, and role-based rendering target 100% MCDC — every boolean condition must independently affect the outcome.

4. **Every API-dependent Component Tests 4 States**: Loading → Success → Error → Empty. No component with API calls is considered tested without all 4 branches.

5. **Test Double Strategy by Layer**:
   - **Backend Integration**: Testcontainers (PostgreSQL, Redis) for real infra, mocked gRPC/RabbitMQ/MinIO
   - **Frontend Component**: Mocked Redux store + `cy.intercept()` for API
   - **Frontend E2E**: Intercepted API at HTTP level, real React rendering

6. **Priority-Driven Implementation**: Auth infrastructure (P0) → Primary business flows (P1) → Secondary (P2) → Supporting/Admin (P3). Each plan has a clear priority matrix.

---

*Generated from: `04-integration-test-plan.md`, `05-ui-test-plan.md`, `06-engapp-v2-integration-test-plan.md`, `07-engapp-v2-ui-test-plan.md`*
