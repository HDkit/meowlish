# UI Test Plan — Frontend (Cypress)

**Project:** english-prep (Next.js 15, React 18, Redux Toolkit, Radix/shadcn UI, Tailwind)  
**Framework:** Cypress 13+ (E2E + Component Testing)  
**Date:** 2026-05-25  

---

## 1. Testing Strategy

### Two-Layer Approach

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Component Tests (Cypress CT)                  │
│  └─ Isolated component mount with mocked Redux + API    │
│  └─ Fast (<100ms per test), no real backend             │
│  └─ Coverage: logic branches, rendering, user events    │
├─────────────────────────────────────────────────────────┤
│  Layer 2: E2E Tests (Cypress E2E)                       │
│  └─ Full page mount with next.js server                 │
│  └─ Real API calls via intercept (stub or live)         │
│  └─ Coverage: page-level flows, navigation, auth        │
└─────────────────────────────────────────────────────────┘
```

### Methodology Selection

| Methodology | When Applied |
|---|---|
| **Black-box (Equivalence Partitioning)** | Form inputs, search/filter, field validation |
| **Boundary Value Analysis (BVA)** | Pagination, text length limits, date ranges |
| **Decision Table** | Auth role-based rendering, conditional UI branches |
| **Control Flow (Statement/Branch)** | Component state machines (loading→error→success) |
| **MCDC** | Complex conditional rendering: `{role===X && (permY || permZ)}` |
| **State Transition** | Multi-step flows (exam attempt, writing evaluation wizard, speaking session) |
| **Domain Analysis** | URL validation in chat (YouTube/Twitch patterns) |
| **Visual Regression** | Snapshot comparisons for shadcn UI components |

---

## 2. Test Infrastructure

### Setup

```bash
# Install Cypress
pnpm add -D cypress @cypress/react @cypress/vite-dev-server

# cypress.config.ts
import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: { framework: 'next', bundler: 'webpack' },
    specPattern: 'src/**/*.cy.{ts,tsx}',
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
  },
});
```

### Test Doubles

| Dependency | Approach |
|---|---|
| **API calls** | `cy.intercept()` — stub all API routes |
| **Redux store** | Mount with pre-filled store state using `cy.window()` + `store.dispatch()` |
| **Socket.IO** | `cy.intercept('ws', ...)` or stub socket instance |
| **Next.js router** | `cy.visit()` with query params, `cy.location()` assertions |
| **localStorage** | `cy.setCookie()`, `cy.clearCookie()` for auth session |
| **Gemini/ElevenLabs APIs** | `cy.intercept()` to stub AI responses |
| **Timer (setTimeout)** | `cy.clock()` + `cy.tick()` for debounce/polling tests |
| **Browser APIs** | Stub `MediaRecorder`, `SpeechRecognition`, `AudioContext` |

### Redux Store Fixture Pattern

```typescript
// cypress/fixtures/store/auth-store.json
{
  "currUser": {
    "current": {
      "id": "test-user-1",
      "email": "learner@test.com",
      "fullName": "Test Learner",
      "roleId": "role-learner",
      "status": "active"
    }
  }
}
```

---

## 3. Component Test Cases

### 3.1 AuthForm — Login/Register

**Methodology:** Black-box (ECP), BVA, Domain Analysis, Decision Table

**File:** `src/components/AuthForm.tsx`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.1.1 | Login mode — renders login UI | Visit `/auth?mode=login` | "Đăng nhập" header visible, no username/confirm fields | **Decision Table**: mode=login → omit register fields |
| 3.1.2 | Register mode — renders register UI | Visit `/auth?mode=register` | "Tạo tài khoản" header, username+confirm fields visible | **Decision Table**: mode=register → show register fields |
| 3.1.3 | Empty email — validation error | Submit with empty email | "Email là bắt buộc" visible | **Domain**: required field |
| 3.1.4 | Invalid email format | Submit with "notanemail" | "Email không hợp lệ" | **Domain**: email regex fails |
| 3.1.5 | Valid email format | Submit with "a@b.com" | No email error | **ECP**: valid email class |
| 3.1.6 | Password < 6 chars (register) | Submit with "Abc12" | "Mật khẩu phải dài hơn 6 ký tự" | **BVA**: boundary=6, test 5 |
| 3.1.7 | Password = 6 chars (register) | Submit with "Abc123" | No password error | **BVA**: boundary=6, test 6 |
| 3.1.8 | Confirm mismatch | Passwords don't match | "Mật khẩu xác nhận không khớp" | **Domain**: equality check |
| 3.1.9 | Toggle to register mode | Click "Đăng ký ngay" | URL changes to `?mode=register` | **Control Flow**: toggleMode |
| 3.1.10 | Toggle to login mode | Click "Đăng nhập" | URL changes to `?mode=login` | **Control Flow**: toggleMode |
| 3.1.11 | Show password toggle | Click eye icon | Password field becomes text | **Control Flow**: showPassword state |
| 3.1.12 | Successful login API call | Valid form, API success | dispatch(setUser) called, redirect to /test-selection | **State Transition**: form→loading→redirect |
| 3.1.13 | Failed login — network error | Valid form, API 401 | Error message "Đăng nhập thất bại" | **Control Flow**: catch→setError |
| 3.1.14 | Login as admin role | JWT with admin role decoded | Redirect to /dashboard | **Decision Table**: role=admin→/dashboard |
| 3.1.15 | Login as learner role | JWT with learner role | Redirect to /test-selection | **Decision Table**: role=learner→/test-selection |
| 3.1.16 | Google login button | Click "Tiếp tục với Google" | `window.location.href = '/api/v1/auth/google'` | **Control Flow**: handleGoogleLogin |

### 3.2 TestInterface — Exam Taking

**Methodology:** State Transition (primary), Control Flow, ECP, Domain Analysis

**File:** `src/components/TestInterface.tsx`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.2.1 | Loading skeleton | Mount while data loads | Skeleton/animated placeholder visible | **Control Flow**: loading state |
| 3.2.2 | MCQ question rendered | Question type `MCQ` with 4 choices | 4 radio button options | **ECP**: MCQ renders choices |
| 3.2.3 | MCQ_MULTI question | `type: MCQ_MULTI` | Checkboxes (multi-select) | **ECP**: multi vs single select |
| 3.2.4 | Fill question rendered | `type: Fill` | Text input field | **ECP**: fill type rendering |
| 3.2.5 | Writing question rendered | `type: Writing` | Textarea for long text | **ECP**: writing type rendering |
| 3.2.6 | Select MCQ answer | Click choice "A" | Choice highlighted, API call made (debounced) | **State**: unanswered→answered |
| 3.2.7 | Deselect MCQ answer | Click chosen "A" again (MCQ) | Answer removed | **State**: answered→unanswered |
| 3.2.8 | Select multiple MCQ_MULTI | Click "A", then "C" | Both highlighted | **State**: multi-select accumulation |
| 3.2.9 | Timer display | Exam with duration | Clock counts down | **Control Flow**: timer interval |
| 3.2.10 | Auto-submit on timer expiry | Timer reaches 0 | auto-submit triggered | **State**: in-progress→submitted |
| 3.2.11 | Flag question | Click flag icon | Flag toggled on, API call | **State**: unflagged→flagged |
| 3.2.12 | Unflag question | Click flagged icon | Flag toggled off | **State**: flagged→unflagged |
| 3.2.13 | Add note | Click note, type text, save | Note saved, API called | **Control Flow**: note editor open/save |
| 3.2.14 | Navigate questions via sidebar grid | Click question #5 in grid | Scrolls to question #5 | **Control Flow**: question navigation |
| 3.2.15 | Section tabs navigation | Click different section tab | Shows questions for that section | **Control Flow**: section filtering |
| 3.2.16 | Passage rendering | Section with directive text | Directive text displayed in left panel | **Domain Analysis**: getPassageSections logic |
| 3.2.17 | Audio attachment | Section with .mp3 fileUrl | AudioPlayer rendered with play button | **Domain Analysis**: getSectionAudioUrl |
| 3.2.18 | Image attachment | Question with image fileUrl | Image rendered in passage | **Domain Analysis**: isImageUrl |
| 3.2.19 | Writing auto-save (debounce) | Type in writing textarea, wait 800ms | API call sent after debounce | **Control Flow**: debounce timer |
| 3.2.20 | Writing auto-save (beforeunload) | Close tab with unsaved writing | API call on beforeunload | **Control Flow**: beforeunload listener |
| 3.2.21 | Question tracker grid layout | 40+ questions across sections | Grid with globalIndex numbers | **Domain**: flattenAttemptData |
| 3.2.22 | Translate button | Click translate on content | Calls /api/gemini/translate | **Control Flow**: translate API call |
| 3.2.23 | API error during answer | Network error on answer call | Toast error, answer preserved locally | **Control Flow**: error handling |

### 3.3 Dashboard

**Methodology:** Control Flow, Decision Table, Domain Analysis

**File:** `src/components/Dashboard.tsx`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.3.1 | Loading state (isHydrated=false or loading) | Mount before hydration | Spinner visible | **Control Flow**: loading branch |
| 3.3.2 | No current user (not authenticated) | Redux has no currentUser | Redirect to /auth | **State**: unauthenticated→redirect |
| 3.3.3 | Stats display | API returns stat values | 4 stat cards with data | **ECP**: {attempts, score, streak, topics} |
| 3.3.4 | Activity heatmap rendering | calendarHistory populated | Color-coded grid rendered | **Domain**: heatmapWeeks computation |
| 3.3.5 | Heatmap day tooltip on hover | Hover over day cell | Tooltip with date + count | **Control Flow**: group/cell hover state |
| 3.3.6 | Change date range | Select "1 tháng" from dropdown | Range updated, data refetched | **State**: 180→30 days transition |
| 3.3.7 | Greeting displays user name | currentUser.fullName set | "Chào mừng trở lại, {name}!" | **Domain**: displayName computation |
| 3.3.8 | Username shown when different from fullName | Both username and fullName set | "@{username}" shown below greeting | **Control Flow**: showUsername condition |
| 3.3.9 | Quick action: jump to test | Click "Làm bài tập ngay" | Navigate to /test-selection | **Control Flow**: router.push |
| 3.3.10 | Quick action card: flashcards | Click flashcard card | Navigate to /flashcards | **Control Flow**: card onClick |
| 3.3.11 | Streak computation — consecutive | 3 consecutive days with activity | streak=3 | **Domain Analysis**: computeStreak |
| 3.3.12 | Streak computation — broken | Activity yesterday, none today, day before | streak=1 (yesterday only) | **Domain Analysis**: broken streak logic |
| 3.3.13 | Streak computation — 0 streak | No activity ever | streak=0 | **Domain Analysis**: empty map |
| 3.3.14 | API failure during load | ExamPracticeService fails | Graceful fallback (no crash) | **Control Flow**: catch→empty data |

### 3.4 WritingTest — Full Evaluation Wizard

**Methodology:** State Transition (primary), Control Flow, BVA

**File:** `src/components/WritingTest.tsx`

States: `SELECT_EXAM → INPUTTING → EVALUATING_STEP1(create attempt) → EVALUATING_STEP2(get saved data) → EVALUATING_STEP3(submit answer) → EVALUATING_STEP4(end attempt) → POLLING → RESULTS | ERROR`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.4.1 | Exam selection — exams loaded | API returns exam list | Select component with options | **State**: loading→ready |
| 3.4.2 | Exam selection — empty list | API returns empty | "Chưa có đề Writing nào" error | **State**: empty→error |
| 3.4.3 | Exam selection — API failure | Network error | "Không thể tải danh sách" error + retry button | **Control Flow**: catch→setExamError |
| 3.4.4 | Submit without content | Click "Đánh giá" with empty | Toast "Vui lòng nhập bài viết" | **Domain**: content.trim() check |
| 3.4.5 | Submit without exam selection | No exam selected | Toast "Vui lòng chọn đề bài" | **Domain**: selectedExamId check |
| 3.4.6 | Full evaluation — success path | Valid writing, all steps succeed | Results card with score + corrections | **State Transition**: all 5 steps complete |
| 3.4.7 | Step 1 fails (create attempt) | attempt API fails | Error state with message | **State**: EVALUATING→ERROR |
| 3.4.8 | Step 3 fails (submit answer) | answer API fails | Error state, cleanup | **State**: EVALUATING→ERROR |
| 3.4.9 | Polling — first attempt returns no review | Review API empty on first try | Continues polling | **Control Flow**: for loop iteration |
| 3.4.10 | Polling — max retries exhausted | Review never returns data | Error "Không thể nhận kết quả" | **BVA**: maxRetries=12, test 13th attempt fails |
| 3.4.11 | Polling — review data with additionalData JSON | Review returns valid data | Score + corrections rendered | **Domain Analysis**: parseAdditionalData(JSON) |
| 3.4.12 | Polling — review data with plain text additionalData | No JSON, plain string | Displayed as detailed_feedback | **Domain Analysis**: parseAdditionalData(fallback) |
| 3.4.13 | Results display — score card | Results available | Score + sub_scores + feedback displayed | **Control Flow**: results branch |
| 3.4.14 | Results display — corrections | corrections[] populated | Error list with original/corrected/explanation | **Control Flow**: corrections.map rendering |
| 3.4.15 | findFirstQuestionId — nested sections | Deep section tree | First question found | **Domain Analysis**: tree traversal |
| 3.4.16 | findFirstQuestionId — no questions | Sections with zero questions | Returns null | **Domain Analysis**: empty leaf |

### 3.5 ChatPage — Rooms & Messaging

**Methodology:** State Transition, Decision Table, Domain Analysis

**File:** `src/components/ChatPage.tsx`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.5.1 | Room list displayed | Rooms returned by API | List of room cards with name + last message | **Black-box**: list rendering |
| 3.5.2 | Search rooms | Type in search box | Filtered room list | **Control Flow**: search filter |
| 3.5.3 | Select room | Click room card | Chat messages loaded for that room | **State**: room selection |
| 3.5.4 | Send message | Type + Enter/Send button | Message appears in chat, socket.io message event sent | **State Transition**: compose→sent |
| 3.5.5 | Auto-scroll on new message | New message received | Scrolls to bottom | **Control Flow**: scrollIntoView |
| 3.5.6 | Create room dialog | Click create → fill name → submit | Room created, list refreshes | **Control Flow**: dialog→API→refresh |
| 3.5.7 | Delete room | Click delete → confirm | Room removed | **State**: exists→deleted |
| 3.5.8 | Schedule edit — valid YouTube URL | `https://youtube.com/watch?v=xxx` | Schedule saved | **Domain Analysis**: isValidLiveUrl |
| 3.5.9 | Schedule edit — valid Twitch URL | `https://twitch.tv/xxx` | Schedule saved | **Domain Analysis**: isValidLiveUrl |
| 3.5.10 | Schedule edit — invalid URL | `https://example.com` | Error message | **Domain Analysis**: URL rejection |
| 3.5.11 | Ban user dialog | Click ban → enter uid+reason | User banned, disconnected | **State**: chatting→banned |
| 3.5.12 | Unban user | Click unban | User unbanned | **State**: banned→unbanned |
| 3.5.13 | Chat date separator | Messages from different days | Date separator line rendered | **Domain Analysis**: date comparison |
| 3.5.14 | User name hydration | Chat message from user | API called to hydrate username, name displayed | **State**: loading→hydrated |
| 3.5.15 | Empty room | Room with 0 messages | Empty state / "No messages" | **Control Flow**: empty messages branch |
| 3.5.16 | Live stream embed | Room with scheduledLiveUrl | YouTube/Twitch iframe embedded | **Domain Analysis**: getEmbedUrl |

### 3.6 ProgressTracker — Charts & History

**Methodology:** Domain Analysis, BVA, Control Flow

**File:** `src/components/ProgressTracker.tsx`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.6.1 | Stats overview | API returns stats | 4 stat cards: attempts, avg score, streak, best score | **Black-box**: data display |
| 3.6.2 | Score trend chart | Multiple attempts returned | AreaChart rendered with data points | **Domain Analysis**: chart data transformation |
| 3.6.3 | Skill radar (desktop) | Viewport > 768px | RadarChart with skill dimensions | **Decision Table**: responsive rendering |
| 3.6.4 | Skill bar chart (mobile) | Viewport <= 768px | BarChart instead of RadarChart | **Decision Table**: mobile fallback |
| 3.6.5 | Activity heatmap | calendarHistory populated | 6-month heatmap grid | **Domain Analysis**: date range + aggregation |
| 3.6.6 | History list — paginated | Many attempts | Cursor-based "Load more" | **Control Flow**: pagination loop |
| 3.6.7 | History sort by score ASC | Click sort → score → ASC | Ordered by score ascending | **Control Flow**: sort toggle |
| 3.6.8 | History sort by date DESC | Click sort → date → DESC | Ordered by date descending | **Control Flow**: sort toggle |
| 3.6.9 | Insights card — strongest topic | Multiple tag scores computed | "Strongest: {tag}" | **Domain Analysis**: tag comparison |
| 3.6.10 | Insights card — weakest topic | Multiple tag scores computed | "Needs improvement: {tag}" | **Domain Analysis**: tag comparison |
| 3.6.11 | Insights card — trend direction | Recent scores increasing | "On the rise" indicator | **Domain Analysis**: trend slope |
| 3.6.12 | Empty state | no attempts yet | Empty state component | **Control Flow**: empty data branch |
| 3.6.13 | Error state | API failure | Error message + retry | **Control Flow**: error handling |

### 3.7 Middleware — Route Protection

**Methodology:** Decision Table, State Transition

**File:** `src/middleware.ts`

| Condition | Authenticated? | Protected route? | Public route? | Action |
|---|---|---|---|---|
| T | T | T | — | ✅ allow |
| T | F | T | — | 🔀 redirect to /auth |
| T | T | F | T | 🔀 redirect to /dashboard |
| T | F | F | T | ✅ allow |

| # | Test Case | State | Expected | Method |
|---|---|---|---|---|
| 3.7.1 | Auth user on protected route | Cookie set, visit /dashboard | 200, page loads | **Decision Table**: R1 |
| 3.7.2 | Unauth user on protected route | No cookie, visit /dashboard | 302 → /auth | **Decision Table**: R2 |
| 3.7.3 | Auth user on public route | Cookie set, visit /landing | 302 → /dashboard | **Decision Table**: R3 |
| 3.7.4 | Unauth user on public route | No cookie, visit /auth | 200, page loads | **Decision Table**: R4 |
| 3.7.5 | Unauth on root / | No cookie | 302 → /auth (via middleware) or → /landing (via page redirect) | **State**: root resolution |

### 3.8 Redux Store — Persistence & Hydration

**Methodology:** Control Flow, State Transition

**File:** `src/lib/store/store.ts`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.8.1 | Store persists to localStorage | Dispatch setUser | localStorage has serialized state | **Control Flow**: persist→storage |
| 3.8.2 | Store rehydrates from localStorage | Refresh page | Redux state restored from persist | **State**: empty→hydrated |
| 3.8.3 | Migration (version 3) | Old localStorage format | Data migrated to new schema | **Control Flow**: migrations array |
| 3.8.4 | useIsStoreHydrated returns false | Before rehydration | false | **Control Flow**: rehydrated check |
| 3.8.5 | useIsStoreHydrated returns true | After rehydration | true | **Control Flow**: rehydrated check |

### 3.9 NotificationPage — Listing & Actions

**Methodology:** State Transition, Black-box

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.9.1 | Notification list rendered | API returns list | Each notification with type icon, title, message, timestamp | **Black-box**: list rendering |
| 3.9.2 | Unread indicator | Notification.isRead=false | Bold text + dot indicator | **Control Flow**: isRead branch |
| 3.9.3 | Mark as read | Click unread notification | isRead→true, style updated, API call | **State Transition**: unread→read |
| 3.9.4 | Mark all as read | Click button | All notifications show as read | **State**: bulk→read |
| 3.9.5 | Delete notification | Click delete → confirm | Removed from list | **State**: exists→deleted |

### 3.10 ExamCreation — Builder UI

**Methodology:** State Transition, Control Flow, Domain Analysis

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.10.1 | Create new exam | Fill title+description → submit | Exam created, redirected to edit | **State**: draft→created |
| 3.10.2 | Add root section | Click "Add section" | Section editor appears | **State**: empty→section |
| 3.10.3 | Add nested section | Click on existing section → "Add child" | Nested section created | **Control Flow**: recursive section |
| 3.10.4 | Add MCQ question | Fill content + 4 choices + mark correct | Question added to section | **Domain Analysis**: question types |
| 3.10.5 | Submit for approval | Click "Submit" → confirm | Status changes, published event | **State Transition**: draft→pending |
| 3.10.6 | Approve exam (admin) | Click "Approve" | Status→APPROVED, exam public | **State**: pending→approved |

### 3.11 SpeakingSession — Recording Flow

**Methodology:** State Transition, Control Flow

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.11.1 | Audio permission denied | Browser blocks mic | Error state with instructions | **Control Flow**: MediaRecorder error |
| 3.11.2 | Start recording | Click record button | Recording indicator, timer starts | **State**: idle→recording |
| 3.11.3 | Stop recording | Click stop | Audio blob created, transcript shown | **State**: recording→processing |
| 3.11.4 | Speech-to-text result | STT returns text | Transcript displayed in real-time | **Control Flow**: speech-to-text pipeline |
| 3.11.5 | ElevenLabs fallback to Web Speech | ElevenLabs fails | Falls back to browser SpeechSynthesis | **Control Flow**: fallback chain |
| 3.11.6 | AI question generation | Gemini returns question | Question displayed | **State**: listening→question shown |
| 3.11.7 | Max session duration | Timer hits max time | Auto-ends session | **BVA**: time limit boundary |
| 3.11.8 | End session dialog | Click end | Stats summary in dialog | **Control Flow**: endSession |

---

## 4. E2E Test Cases (Critical User Journeys)

### 4.1 Authentication Flow

```
Register → Redirect → Login → Refresh → Logout → Locked → Unlock
```

| # | Scenario | Steps | Verifications | Method |
|---|---|---|---|---|
| 4.1.1 | Full register → login → browse | 1. Visit /auth?mode=register, fill form, submit 2. Navigate to /test-selection | User registered, redirected, can browse exams | **State**: full lifecycle |
| 4.1.2 | Login → attempt exam → submit → review | 1. Login 2. Select exam 3. Answer questions 4. Submit 5. View results | All steps succeed, correct score | **State**: attempt lifecycle |
| 4.1.3 | Token refresh on 401 | Intercept API with 401, then valid | Request retried with new token | **Control Flow**: refresh interceptor |

### 4.2 Exam Authoring Flow

```
Create Exam → Add Sections → Add Questions → Submit → Approve → Practice
```

| # | Scenario | Steps | Method |
|---|---|---|---|
| 4.2.1 | Mod creates and publishes exam | Login as mod → create exam → add section → add MCQ → submit → approve → verify in practice listing | **State**: full authoring lifecycle |

### 4.3 Moderation Flow

```
Create Room → Schedule → Ban → Unban → Delete
```

| # | Scenario | Steps | Method |
|---|---|---|---|
| 4.3.1 | Full chat room lifecycle | Login as mod → create room → set schedule → ban user → unban → delete room | **State**: room lifecycle |

### 4.4 Writing Evaluation Flow

```
Select Exam → Write → Start Attempt → Submit → Wait → See Results
```

| # | Scenario | Steps | Method |
|---|---|---|---|
| 4.4.1 | Full writing practice | Login → writing page → select exam → write essay → evaluate → poll → see corrections | **State**: full writing pipeline |

---

## 5. Cypress Custom Commands

```typescript
// cypress/support/commands.ts

/// <reference types="cypress" />

// --- Auth ---
Cypress.Commands.add('login', (role: Role = 'learner') => {
  cy.intercept('POST', '/api/v1/auth/login', {
    fixture: `auth/login-${role}-response.json`,
  }).as('login');

  cy.visit('/auth');
  cy.get('input[placeholder*="Email"]').type('user@test.com');
  cy.get('input[placeholder*="Mật khẩu"]').type('password123');
  cy.get('button[type="submit"]').click();
  cy.wait('@login');
});

Cypress.Commands.add('setStore', (state: Partial<RootState>) => {
  cy.window().its('store').invoke('dispatch', {
    type: 'REPLACE_STATE',
    payload: state,
  });
});

// --- API Intercepts ---
Cypress.Commands.add('interceptExams', () => {
  cy.intercept('GET', '/api/v1/exams/practice*', {
    fixture: 'exams/list.json',
  }).as('getExams');
});

Cypress.Commands.add('interceptAttempt', (fixtureName: string) => {
  cy.intercept('POST', '/api/v1/exams/practice/new/**', {
    fixture: `attempts/${fixtureName}.json`,
  }).as('createAttempt');
});
```

---

## 6. Test Data Fixtures

```
cypress/
└── fixtures/
    ├── auth/
    │   ├── login-learner-response.json
    │   ├── login-mod-response.json
    │   ├── login-admin-response.json
    │   └── register-response.json
    ├── exams/
    │   ├── list.json                   (10+ exam list)
    │   ├── exam-detail.json            (full exam with sections)
    │   └── exam-counts.json
    ├── attempts/
    │   ├── created.json
    │   ├── saved-data.json             (sections + questions)
    │   ├── review-before-score.json
    │   └── review-scored.json
    ├── chat/
    │   ├── rooms.json
    │   ├── logs.json
    │   └── user-hydration.json
    ├── writing/
    │   ├── review-with-feedback.json   (additionalData JSON)
    │   └── review-plain-text.json
    ├── notifications/
    │   ├── list.json
    │   └── preferences.json
    ├── progress/
    │   ├── stats.json
    │   ├── calendar.json
    │   └── history.json
    └── store/
        ├── auth-store.json             (Redux hydrate fixture)
        └── mod-store.json
```

---

## 7. Visual Regression Tests

For shadcn UI components (51 files), use Cypress visual testing:

```typescript
describe('UI Components — Visual', () => {
  it('Button variants', () => {
    cy.mount(
      <div className="flex gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
    );
    cy.matchImageSnapshot('button-variants');
  });

  it('Dialog open/close', () => {
    cy.mount(<DialogExample />);
    cy.contains('Open Dialog').click();
    cy.matchImageSnapshot('dialog-open');
    cy.contains('Close').click();
    cy.matchImageSnapshot('dialog-closed');
  });
});
```

---

## 8. Coverage Targets

| Element | Target | Measurement |
|---|---|---|
| Components with CT | ≥70% (28/40 major components) | Code coverage + manual audit |
| E2E user journeys | 5 critical flows | Manual tracking |
| Branches in key components | ≥80% | `@cypress/code-coverage` + Istanbul |
| Auth-related branches | 100% MCDC (AuthForm, middleware) | Manual verification |
| Loading/Error/Empty states | 100% of components with API calls | Manual audit |
| Responsive layouts (mobile/desktop) | Key pages tested at 375px + 1280px | Viewport parameterized |

---

## 9. Test Execution

### Commands

```bash
# Component tests (headless)
npx cypress run --component

# E2E tests (headless)
npx cypress run --e2e

# Open Cypress UI
npx cypress open

# Run with specific browser
npx cypress run --browser chrome

# Code coverage
npx cypress run --component --env coverage=true
```

### CI Integration

Add to the existing CI workflow or create a separate frontend workflow:

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npx cypress run --component
      - run: npx cypress run --e2e
        env:
          CYPRESS_BASE_URL: http://localhost:3000
```

---

## 10. File Organization

```
cypress/
├── component/
│   ├── AuthForm.cy.tsx                          (3.1)
│   ├── Dashboard.cy.tsx                         (3.3)
│   ├── TestInterface.cy.tsx                     (3.2)
│   ├── WritingTest.cy.tsx                       (3.4)
│   ├── ChatPage.cy.tsx                          (3.5)
│   ├── ProgressTracker.cy.tsx                   (3.6)
│   ├── NotificationPage.cy.tsx                  (3.9)
│   ├── SpeakingSession.cy.tsx                   (3.11)
│   └── ui/                                      (Section 7)
│       ├── Button.cy.tsx
│       ├── Dialog.cy.tsx
│       └── Card.cy.tsx
├── e2e/
│   ├── auth-flow.cy.ts                          (4.1)
│   ├── exam-authoring.cy.ts                     (4.2)
│   ├── chat-moderation.cy.ts                    (4.3)
│   ├── writing-evaluation.cy.ts                 (4.4)
│   └── middleware-protection.cy.ts              (3.7)
├── fixtures/
│   └── ...                                       (Section 6)
├── support/
│   ├── commands.ts                               (Section 5)
│   └── component.ts                              (mount + providers)
└── tsconfig.json
```

---

## Appendix A: Methodology Reference

| Method | Description | Application in UI Tests |
|---|---|---|
| **ECP** | Partition input domain into classes | Form validation: valid/invalid/empty email |
| **BVA** | Test boundaries of equivalence classes | Password min length=6, pagination {0,1,default,N,100} |
| **Decision Table** | Systematic multi-condition coverage | Role-based rendering, guard decisions |
| **MCDC** | Each condition independently affects outcome | Complex conditional: `role===X && (permY\|\|permZ)` |
| **Control Flow** | Exercise all code paths | Loading→success→error states, all if/else branches |
| **State Transition** | Test state machines | Attempt lifecycle, writing evaluation wizard, recording states |
| **Domain Analysis** | Complex domain logic | URL validation, streak computation, heatmap generation |
| **Visual Regression** | Snapshot comparison | shadcn UI component visual testing |

---

## Appendix B: Priority Matrix

| Priority | Features | Count | Rationale |
|---|---|---|---|
| **P0** | Auth, Middleware, Store | ~30 tests | Blocks everything else |
| **P1** | TestInterface, WritingTest, ChatPage | ~50 tests | Core user-facing features |
| **P2** | Dashboard, ProgressTracker, Notifications | ~25 tests | Secondary features |
| **P3** | ExamCreation, SpeakingSession, Admin pages | ~20 tests | Admin/AI features |
| **P4** | Visual regression (UI components) | ~15 tests | Polish/cosmetic |
