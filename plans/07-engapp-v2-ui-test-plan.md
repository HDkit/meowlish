# engapp-v2 UI Test Plan — Frontend (Cypress)

**Project:** engapp-v2 Frontend (React 18, Vite, shadcn/ui, Tailwind, React Router v6)  
**Framework:** Cypress 13+ (Component + E2E), Vitest for unit tests  
**Date:** 2026-05-25  

---

## 1. Testing Strategy

### Two-Layer Approach

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Component Tests (Cypress CT / Vitest)             │
│  └─ Isolated component mount with mocked AuthContext + API   │
│  └─ Fast, no real backend                                    │
│  └─ Coverage: rendering, user events, state branches         │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: E2E Tests (Cypress E2E)                            │
│  └─ Full page in browser with real React rendering           │
│  └─ API calls intercepted via `cy.intercept()`               │
│  └─ Coverage: page flows, navigation, role-based routing     │
└──────────────────────────────────────────────────────────────┘
```

### Methodology Selection

| Methodology | When Applied |
|---|---|
| **Black-box (ECP)** | Form inputs, login/register validation |
| **Boundary Value Analysis** | Pagination limits, search string lengths |
| **Decision Table** | Role-based rendering (ProtectedRoute), multi-role pages |
| **Control Flow** | Component state machines (loading→error→success→empty) |
| **MCDC** | `ProtectedRoute` conditions: `isAuthenticated && (!allowedRoles || roles.some(...))` |
| **State Transition** | Auth state (unauthenticated→authenticated), booking flow |
| **Domain Analysis** | i18n translation switching, theme switching |
| **Visual Regression** | shadcn UI component snapshots |

---

## 2. Test Infrastructure

### Setup

```bash
# Install Cypress
pnpm add -D cypress @cypress/react @cypress/vite-dev-server

# Frontend/package.json additions
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open"
  },
  "devDependencies": {
    "cypress": "^13.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0"
  }
}
```

### Test Doubles

| Dependency | Approach |
|---|---|
| **Auth state** | Wrap in `AuthProvider` with pre-configured mock user |
| **API calls** | `cy.intercept()` for E2E; `vi.fn()` for Vitest unit |
| **React Router** | `MemoryRouter` for component tests |
| **Translation** | `LanguageProvider` with known language state |
| **Theme** | `ThemeProvider` with known theme |
| **localStorage** | `cy.setCookie()`, `cy.clearCookie()`, `localStorage.setItem()` |
| **Google OAuth** | Stub `window.location.href` assignment |
| **Chat WebSocket** | Not real-time in tests; poll-based UI updates |

### AuthContext Mock Fixture

```typescript
// cypress/fixtures/auth/student-user.json
{
  "user": {
    "id": "test-student-id",
    "username": "teststudent",
    "fullName": "Test Student",
    "role": "student",
    "roles": ["student"],
    "email": "student@test.com",
    "profileId": 1,
    "legacyUserId": 1
  },
  "accessToken": "mock-jwt-token",
  "isAuthenticated": true,
  "isLoading": false
}
```

---

## 3. Component Test Cases

### 3.1 Login Page

**Methodology:** Black-box (ECP), BVA, Domain Analysis, Control Flow

**File:** `src/pages/Login.tsx`

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.1.1 | Login form renders | Visit /login | Email + password fields visible | **Black-box**: form render |
| 3.1.2 | Empty fields validation | Click submit with empty | Browser validation (required) | **Domain**: HTML required attr |
| 3.1.3 | Invalid email | Type invalid email | HTML validation blocks | **Domain**: type=email |
| 3.1.4 | Valid credentials → success | Fill valid → submit | login() called, navigates to /dashboard | **State**: idle→submitting→redirect |
| 3.1.5 | Invalid credentials → error | API returns 401 | Error alert `{error}` visible | **Control Flow**: catch→setError |
| 3.1.6 | Loading state during submit | Click submit | Button disabled, spinner shown | **Control Flow**: isLoading true |
| 3.1.7 | Google login button | Click "Sign in with Google" | `window.location.href = '.../auth/google'` | **Control Flow**: loginWithGoogle |
| 3.1.8 | Google callback processing | URL has `?loginToken=xxx` | Loading spinner, handleGoogleCallback | **State**: processing→redirect |
| 3.1.9 | Google callback failure | Invalid token | Error message visible | **Control Flow**: catch→setError |
| 3.1.10 | Toggle to register | Click "Sign up" link | Navigate to /register | **Black-box**: link |
| 3.1.11 | i18n — Vietnamese | language="vi" | Labels in Vietnamese | **Domain**: translation switch |
| 3.1.12 | i18n — English | language="en" | Labels in English | **Domain**: translation switch |

### 3.2 Register Page

**Methodology:** Black-box, BVA, Domain Analysis

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.2.1 | Register form renders | Visit /register | Email, password, fullName, phone fields | **Black-box**: form render |
| 3.2.2 | Valid register (student) | Fill all fields → submit | register() called, user created, redirect | **State**: form→loading→redirect |
| 3.2.3 | Duplicate email error | API returns 409 | Error message "Email đã được sử dụng" | **Control Flow**: catch→error |
| 3.2.4 | Register without fullName | Skip fullName | Validation blocks | **Domain**: required field |
| 3.2.5 | Switch to login | Click "Sign in" link | Navigate to /login | **Black-box**: link |

### 3.3 ProtectedRoute — Role-Based Access

**Methodology:** Decision Table, MCDC, Control Flow

| Authenticated? | allowedRoles? | user.roles matches? | Loading? | Result |
|---|---|---|---|---|
| F | — | — | F | 🔀 redirect to /login |
| T | undefined | — | F | ✅ children |
| T | defined | T | F | ✅ children |
| T | defined | F | F | 🔀 redirect to role dashboard |
| — | — | — | T | ⏳ loading skeleton |

| # | Test Case | Conditions | Expected | Method |
|---|---|---|---|---|
| 3.3.1 | Not authenticated | isAuth=F, loading=F | Navigate to /login | **Decision Table**: R1 |
| 3.3.2 | Loading state | isLoading=T | Skeleton UI | **Control Flow**: loading branch |
| 3.3.3 | Authenticated, no allowedRoles | isAuth=T, allowedRoles=undefined | Children rendered | **Decision Table**: R2 |
| 3.3.4 | Authenticated, matching role | student visits /student-dashboard | Children rendered | **Decision Table**: R3 |
| 3.3.5 | Authenticated, wrong role | student visits /teacher-dashboard | Redirect to /student-dashboard | **MCDC**: roles.some returns false |
| 3.3.6 | Authenticated with multiple roles | user has [teacher, mentor], allowed=[mentor] | Children rendered | **MCDC**: roles.some matches secondary role |

### 3.4 Dashboard (Redirect Page)

| # | Test Case | User Role | Expected Redirect | Method |
|---|---|---|---|---|
| 3.4.1 | Student user | student | /student-dashboard | **Decision Table** |
| 3.4.2 | Parent user | parent | /parent-dashboard | **Decision Table** |
| 3.4.3 | Teacher user | teacher | /teacher-dashboard | **Decision Table** |
| 3.4.4 | Admin user | admin | /admin-dashboard | **Decision Table** |
| 3.4.5 | Not authenticated | null | /login | **Decision Table** |
| 3.4.6 | Loading state | isLoading | Spinner + "Redirecting..." | **Control Flow** |

### 3.5 Navigation Component

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.5.1 | Navbar renders for student | Auth: student | Student nav links visible | **Decision Table**: role-based links |
| 3.5.2 | Navbar renders for admin | Auth: admin | Admin nav links visible | **Decision Table**: role-based links |
| 3.5.3 | Theme switcher | Click theme toggle | Theme cycles default→mint→forest | **State**: theme transition |
| 3.5.4 | Language toggle | Click language button | Language switches vi↔en | **State**: language transition |
| 3.5.5 | Notification badge | Unread count > 0 | Badge with count displayed | **Control Flow**: count>0 branch |
| 3.5.6 | Mobile menu toggle | Click hamburger menu | Mobile nav expands | **State**: closed→open |

### 3.6 Student Dashboard

**Methodology:** Control Flow, Domain Analysis

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.6.1 | Loading state | API calls pending | Skeleton/spinner | **Control Flow**: loading |
| 3.6.2 | Dashboard with data | API returns stats+enrollment | Overview cards + heatmap + quick actions | **Black-box**: data display |
| 3.6.3 | Empty state (no enrollment) | No enrollment found | Empty enrollment message | **Control Flow**: null→empty |
| 3.6.4 | Error state | API fails | Error message + retry | **Control Flow**: error handling |
| 3.6.5 | AI practice stats chart | Stats returned | Weekly bar chart with sessions+minutes | **Domain Analysis**: chart rendering |
| 3.6.6 | Streak display | streak=5 | "5 ngày" displayed | **Domain**: streak≥0 |

### 3.7 Teacher Dashboard

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.7.1 | Teacher dashboard loads | Auth: teacher | Upcoming sessions + students + teaching courses | **Black-box**: role-specific |
| 3.7.2 | Upcoming bookings | Bookings returned | List of upcoming sessions | **Domain**: date filter |
| 3.7.3 | Teaching courses | Courses returned | Course cards with student counts | **Domain**: cohort course display |
| 3.7.4 | Weekly focus form | Fill + submit | Weekly focus created | **State**: form lifecycle |
| 3.7.5 | Start meeting button | Click → confirm | API call, meeting link shown | **State**: CONFIRMED→IN_PROGRESS |

### 3.8 Booking Page

**Methodology:** State Transition, Domain Analysis

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.8.1 | Mentor card rendered | Mentors loaded | Mentor card with avatar, specialties, rating | **Black-box**: data display |
| 3.8.2 | Calendar date picker (weekend only) | Click weekday | Weekday disabled, weekend selectable | **Domain**: weekend constraint |
| 3.8.3 | Time slot selection | Click available slot | Slot highlighted, selected | **State**: idle→selected |
| 3.8.4 | Booked slot shown as unavailable | Slot unavailable | Greyed out, not clickable | **State**: booked→unavailable |
| 3.8.5 | Booking confirmation | Confirm booking | API call, success state displayed | **State**: selected→confirmed |
| 3.8.6 | Booking conflict | Slot taken after selection | Error message "Slot already booked" | **Control Flow**: API 400→error |
| 3.8.7 | Mentor brief (3L) | MentorBrief loaded | Weekly focus + AI count + last feedback | **Domain**: cross-entity aggregation |

### 3.9 AI Practice Page

**Methodology:** State Transition, Control Flow

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.9.1 | Mode selector | Click voice/chat mode | Mode-specific UI shown | **State**: mode selection |
| 3.9.2 | Voice practice — record | Click mic button | Recording state, timer, waveform | **State**: idle→recording |
| 3.9.3 | Voice practice — stop | Click stop | Processing, transcript shown | **State**: recording→processing |
| 3.9.4 | Chat practice — send message | Type + Enter | Message sent, AI response received | **State**: composing→sent→response |
| 3.9.5 | AI feedback display | Feedback received | Score + highlights + suggestions | **Control Flow**: feedback rendering |
| 3.9.6 | Level selector | Change level | Difficulty-adjusted prompts | **State**: level changed |
| 3.9.7 | Loading state (chat) | Waiting for API | Loading indicator | **Control Flow**: loading |

### 3.10 Parent Dashboard

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.10.1 | Child selector | Multiple children | Dropdown to select child | **State**: child selection |
| 3.10.2 | Overview cards | Stats loaded | Attempts, avg score, streak cards | **Black-box**: data display |
| 3.10.3 | Activity feed | History loaded | Timeline of recent activities | **Domain**: chronological display |
| 3.10.4 | Progress videos | Videos exist | Before/after video players | **Control Flow**: video URLs |
| 3.10.5 | Progress videos (none) | No videos | Empty state message | **Control Flow**: null→empty |
| 3.10.6 | Attendance calendar | Calendar data | Month grid with attendance marks | **Domain**: calendar heatmap |
| 3.10.7 | Learning progress summary | Enrollment + modules | Module progress bars | **Domain**: progress computation |
| 3.10.8 | Payment history | Payments exist | Payment list with status badges | **Domain**: status colors |

### 3.11 Admin Dashboard

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.11.1 | Tab navigation | Click tabs | Tab content switches | **State**: tab selection |
| 3.11.2 | User statistics pie chart | Stats loaded | Pie chart with role breakdown | **Domain**: chart rendering |
| 3.11.3 | Visit statistics line chart | Data loaded | Hourly visit chart | **Domain**: line chart |
| 3.11.4 | Practice statistics | Data loaded | AI + video call comparison | **Domain**: dual chart |
| 3.11.5 | User management table | Users loaded | Paginated table with search | **Domain**: CRUD table |
| 3.11.6 | User management — search | Type in search | Filtered results | **ECP**: search filter |
| 3.11.7 | User management — lock/unlock | Click lock | User toggled, UI updated | **State**: locked↔unlocked |
| 3.11.8 | User management — role change | Select new role | Role updated | **State**: role changed |
| 3.11.9 | Course management | Full CRUD interface | Program/cohort/course/module CRUD | **State**: complex CRUD |
| 3.11.10 | Chat support — conversation list | Conversations loaded | List with status, unread | **Domain**: chat UI |
| 3.11.11 | Chat support — send message | Type + send | Message appears in thread | **State**: message sent |

### 3.12 Theme Switcher

| # | Test Case | Current Theme | Action | Expected | Method |
|---|---|---|---|---|---|
| 3.12.1 | Default theme | — | Load page | `data-app-theme="default"` | **State**: initial |
| 3.12.2 | Switch to mint | default | Click mint | `data-app-theme="mint-productivity"` | **State**: transition |
| 3.12.3 | Switch to forest | mint | Click forest | `data-app-theme="forest-focus"` | **State**: transition |
| 3.12.4 | Persist across reload | forest | Refresh | Still forest | **Domain**: localStorage persist |

### 3.13 Language Switcher

| # | Test Case | Current Lang | Action | Expected | Method |
|---|---|---|---|---|---|
| 3.13.1 | Default language | vi | Load | All text in Vietnamese | **State**: initial |
| 3.13.2 | Switch to English | vi | Toggle | All text in English | **State**: transition |
| 3.13.3 | Switch to Vietnamese | en | Toggle | All text in Vietnamese | **State**: transition |
| 3.13.4 | Key lookup — existing key | any | Render | Translated value | **Domain**: key→value |
| 3.13.5 | Key lookup — missing key | any | Render | Falls back to key name | **Domain**: fallback |

### 3.14 Chat Widget

| # | Test Case | Input/Interaction | Expected | Method Reasoning |
|---|---|---|---|---|
| 3.14.1 | Chat widget renders | Auth loaded | Chat bubble icon in corner | **Decision Table**: not for admin |
| 3.14.2 | Open chat | Click bubble | Chat panel opens | **State**: closed→open |
| 3.14.3 | Send message | Type + Enter | Message sent, API called | **State**: message flow |
| 3.14.4 | Receive message | Polled/new message | Message appears in chat | **State**: received |
| 3.14.5 | Unread badge | unreadCount > 0 | Badge on bubble | **Control Flow**: count display |

### 3.15 Rise Meter Component Suite

| # | Test Case | Component | Input | Expected | Method |
|---|---|---|---|---|---|
| 3.15.1 | RiseScoreCard | SVG gauge | score=720 | Circular gauge at 720/1000 | **Domain**: SVG rendering |
| 3.15.2 | RiseScoreCard — CEFR badge | — | score=720 | "C1" badge | **Domain**: score→level mapping |
| 3.15.3 | ThreeLProgress | 3 columns | progress data | Learn/Loop/LevelUp cards | **Domain**: 3L model |
| 3.15.4 | WeeklyGoals | goal list | goals completed | Progress bars + checkmarks | **State**: progress tracking |
| 3.15.5 | SkillsRadar | radar chart | skill data | Recharts RadarChart | **Domain**: multi-skill comparison |
| 3.15.6 | ActivityTimeline | timeline | activities | Chronological list with icons | **Domain**: timeline rendering |
| 3.15.7 | AchievementsPanel | badges | earned/locked | Badge grid with states | **Control Flow**: earned vs locked |

---

## 4. E2E Test Cases (Critical User Journeys)

### 4.1 Authentication Flow

```
Landing → Login → Redirect to Student Dashboard → See Dashboard Data
```

| Step | Action | Verification |
|---|---|---|
| 1 | Visit / | Landing page loads |
| 2 | Click "Đăng nhập" | Navigate to /login |
| 3 | Fill email + password + submit | API called, tokens saved |
| 4 | Redirect to /dashboard → /student-dashboard | Dashboard content visible |

### 4.2 Booking Flow

```
Dashboard → Booking → Select Mentor → Pick Date → Pick Time → Confirm → See Booking
```

| Step | Action | Verification |
|---|---|---|
| 1 | Navigate to /booking | Mentor cards visible |
| 2 | Click mentor | Calendar shown |
| 3 | Select Saturday | Time slots load |
| 4 | Click available slot | Slot highlighted |
| 5 | Confirm booking | Success, booking in list |

### 4.3 Admin User Management Flow

```
Login as Admin → Navigate to Admin → User Management → Search → Lock → Unlock
```

| Step | Action | Verification |
|---|---|---|
| 1 | Login with admin credentials | Redirect to /dashboard → /admin-dashboard |
| 2 | Click "User Management" tab | User table loads |
| 3 | Type search query | Table filters |
| 4 | Click lock icon | User locked, badge changes |
| 5 | Click unlock | User unlocked |

### 4.4 Program Management CRUD Flow

```
Login as Admin → Course Management → Create Program → Add Cohort → Add Course → Enroll Student
```

| Step | Action | Verification |
|---|---|---|
| 1 | Navigate to course management | Program list |
| 2 | Create program | Program added |
| 3 | Add cohort to program | Cohort added |
| 4 | Link course to cohort-course | Course linked |
| 5 | Add module to course | Module added with content |
| 6 | Enroll student | Student appears in enrollment |

### 4.5 Parent Dashboard Flow

```
Login as Parent → See Children → Select Child → View Progress → View Videos
```

| Step | Action | Verification |
|---|---|---|
| 1 | Login with parent role | Redirect to /parent-dashboard |
| 2 | See child selector | Children list |
| 3 | Select child | Child data loads |
| 4 | View overview cards | Stats visible |
| 5 | View progress videos | Before/after videos |

---

## 5. Cypress Custom Commands

```typescript
// cypress/support/commands.ts

Cypress.Commands.add('login', (role: UserRole = 'student') => {
  cy.intercept('POST', '**/auth/login', {
    fixture: `auth/login-${role}-response.json`,
  }).as('login');

  cy.visit('/login');
  cy.get('#email').type('user@test.com');
  cy.get('#password').type('password123');
  cy.get('button[type="submit"]').click();
  cy.wait('@login');
});

Cypress.Commands.add('mockAuth', (fixtureName: string) => {
  cy.intercept('GET', '**/auth/my/identity', {
    fixture: `auth/${fixtureName}.json`,
  }).as('getIdentity');

  cy.intercept('GET', '**/auth/profile-by-email*', {
    fixture: `auth/profile-${fixtureName}.json`,
  }).as('getProfile');
});

Cypress.Commands.add('setTheme', (theme: 'default' | 'mint-productivity' | 'forest-focus') => {
  localStorage.setItem('lingriser_theme', theme);
  cy.document().then((doc) => {
    doc.documentElement.setAttribute('data-app-theme', theme);
  });
});

Cypress.Commands.add('setLanguage', (lang: 'vi' | 'en') => {
  localStorage.setItem('lingriser_language', lang);
  cy.reload();
});
```

---

## 6. Test Data Fixtures

```
cypress/
└── fixtures/
    ├── auth/
    │   ├── login-student-response.json
    │   ├── login-admin-response.json
    │   ├── login-parent-response.json
    │   ├── login-teacher-response.json
    │   ├── identity-student.json
    │   ├── identity-admin.json
    │   └── profile-student.json
    ├── students/
    │   ├── list.json
    │   ├── detail.json
    │   ├── enrollment.json
    │   └── learning-history.json
    ├── teachers/
    │   ├── list.json
    │   ├── detail.json
    │   └── availability.json
    ├── bookings/
    │   ├── create-success.json
    │   ├── create-conflict.json
    │   ├── list.json
    │   └── mentor-brief.json
    ├── programs/
    │   ├── programs.json
    │   ├── cohorts.json
    │   ├── modules.json
    │   └── enrollments.json
    ├── admin/
    │   ├── user-stats.json
    │   ├── visit-stats.json
    │   ├── practice-stats.json
    │   └── users.json
    ├── parent/
    │   ├── children.json
    │   └── child-stats.json
    └── ai-practice/
        ├── chat-response.json
        └── feedback-response.json
```

---

## 7. Visual Regression Tests

For shadcn UI components (51 files), snapshot key variants:

```typescript
describe('UI Components — Visual', () => {
  it('Button variants', () => {
    cy.mount(
      <div className="flex gap-2 flex-wrap">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon"><GraduationCap /></Button>
      </div>
    );
    cy.matchImageSnapshot('button-variants');
  });

  it('Card with content', () => {
    cy.mount(
      <Card className="w-80">
        <CardHeader><CardTitle>Test Card</CardTitle></CardHeader>
        <CardContent>Card content here</CardContent>
      </Card>
    );
    cy.matchImageSnapshot('card-default');
  });
});
```

---

## 8. Coverage Targets

| Element | Target | Measurement |
|---|---|---|
| Major components with CT | ≥70% | Manual + code coverage |
| E2E critical journeys | 5 flows | Manual tracking |
| Control flow branches | ≥80% | Istanbul + `@cypress/code-coverage` |
| Auth-related branches | 100% MCDC | ProtectedRoute, AuthContext |
| Loading/Error/Empty states | 100% in API-dependent components | Manual audit |
| i18n (vi/en) | Key pages tested in both languages | Parameterized tests |
| Theme variants | 3 themes visually checked | Visual regression per theme |

---

## 9. File Organization

```
cypress/
├── component/
│   ├── Login.cy.tsx                          (3.1)
│   ├── Register.cy.tsx                       (3.2)
│   ├── ProtectedRoute.cy.tsx                 (3.3)
│   ├── Dashboard.cy.tsx                      (3.4)
│   ├── Navigation.cy.tsx                     (3.5)
│   ├── TeacherDashboard.cy.tsx               (3.7)
│   ├── BookingDemo.cy.tsx                    (3.8)
│   ├── AIPracticeDemo.cy.tsx                 (3.9)
│   ├── AdminDashboard.cy.tsx                 (3.11)
│   ├── ThemeSwitcher.cy.tsx                  (3.12)
│   ├── LanguageSwitcher.cy.tsx               (3.13)
│   ├── ChatWidget.cy.tsx                     (3.14)
│   ├── rise-meter/
│   │   ├── RiseScoreCard.cy.tsx             (3.15.1)
│   │   ├── ThreeLProgress.cy.tsx            (3.15.3)
│   │   ├── WeeklyGoals.cy.tsx               (3.15.4)
│   │   ├── SkillsRadar.cy.tsx               (3.15.5)
│   │   └── ActivityTimeline.cy.tsx          (3.15.6)
│   └── ui/                                   (Section 7)
│       ├── Button.cy.tsx
│       ├── Card.cy.tsx
│       └── Dialog.cy.tsx
├── e2e/
│   ├── auth-flow.cy.ts                       (4.1)
│   ├── booking-flow.cy.ts                    (4.2)
│   ├── admin-user-mgmt.cy.ts                 (4.3)
│   ├── program-crud.cy.ts                    (4.4)
│   └── parent-dashboard.cy.ts                (4.5)
├── fixtures/                                  (Section 6)
├── support/
│   ├── commands.ts                            (Section 5)
│   └── component.ts                           (mount + providers)
└── tsconfig.json
```

---

## Appendix A: Frontend Route Matrix

| Route | Page Component | Auth Required | Allowed Roles |
|---|---|---|---|
| `/` | Index | No | — |
| `/login` | Login | No | — |
| `/register` | Register | No | — |
| `/inaugural-program` | AllPrograms | No | — |
| `/dashboard` | Dashboard (redirect) | Yes | any authenticated |
| `/student-dashboard` | StudentDashboard | Yes | student |
| `/ai-practice` | AIPracticeDemo | Yes | student |
| `/booking` | BookingDemo | Yes | student |
| `/booking/:bookingId` | BookingDetailPage | Yes | student, teacher, mentor |
| `/curriculum` | CurriculumPage | Yes | student |
| `/curriculum/:moduleId` | ModuleDetailPage | Yes | student |
| `/connections` | ConnectionsPage | Yes | student |
| `/payment/:moduleId` | PaymentPage | Yes | student |
| `/parent-dashboard` | ParentDashboardDemo | Yes | parent |
| `/teacher-dashboard` | TeacherDashboard | Yes | teacher, mentor |
| `/session/:bookingId` | StudentSessionDetailPage | Yes | teacher, mentor |
| `/admin-dashboard` | AdminDashboard | Yes | admin |
| `*` | NotFound | No | — |

---

## Appendix B: Methodology Reference

| Method | Application |
|---|---|
| **ECP** | Form field validation: valid/invalid/empty email |
| **BVA** | Pagination: page=0,1,N, limit=1,20,100 |
| **Decision Table** | ProtectedRoute: isAuth × isAllowed × isLoading |
| **MCDC** | `isAuth && (!roles || roles.some(r => allowed.includes(r)))` |
| **Control Flow** | Loading→error→success→empty state machines |
| **State Transition** | Auth lifecycle, booking lifecycle, modal open/close |
| **Domain Analysis** | i18n keys, theme attribute values, CEFR→score mapping |
| **Visual Regression** | shadcn UI component snapshot comparison |
