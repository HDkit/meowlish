# goal.md — findings and fixes

Status: ✅ fixed and deployed (backend live on meowlish.servebeer.com, frontend on
meowlish-fe-share.vercel.app). All 20 problems are done.

Backend = `~/meowlish` (branch `chore/local-dev-fixes`), frontend = `~/meowlish-fe` (branch
`feat/backlog-goal`). Nothing is pushed. The main frontend (meowlish-fe.vercel.app) still runs the
old code until `feat/backlog-goal` reaches `main`.

## Deployment state found along the way

Production ran a **mix of old and new backend images**: auth, gateway and live were current, but
exam, notification, achievement, authorization, resource and file-service were built on 2026-11-12
before the shared event bus (outbox/inbox, retries). Their RabbitMQ queues still used the old
per-service dead-letter exchanges, and there was no writing scorer at all.

Done, following `docs/operations/upgrade-notes.md` + `observability.md`:
- Checked databases: auth/exam/achievement/file migrations already applied; resource, notification,
  authorization, live schemas match (`prisma migrate diff` empty). No DB change needed.
- Rebuilt every backend image from the current branch.
- Deleted the 14 old consumer queues (all had 0 messages) so services recreated them with the new
  dead-letter settings; started consumers first, then publishers.
- Added `CURSOR_SECRET` to `docker/.env.services` (was unset → pagination cursors broke on every
  restart). Backup of the previous file: `~/meowlish.env.services.20261113-231912.bak`.
- All 13 backend containers healthy.

⚠️ `upgrade-notes.md` says the mock AI scorer must never run in production. It now does (see
Problem 10), because there is no real scorer and you asked for the mock with its delay. When a real
scorer exists, stop `mock-ai-scorer`.

⚠️ Not changed: `TRUST_PROXY` is unset, so the gateway may see every user as the proxy's IP and all
users share the per-IP rate limits. The answer routes now use per-account limits (Problem 8), but
other routes still share. See the TRUST_PROXY table in `upgrade-notes.md`.

---

## Problem 1 — images load from `http://localhost:9000` — ✅

**Cause:** compose hard-coded `MINIO_PUBLIC_URL=http://localhost:9000` for file-service; all file
URLs (public and presigned uploads) are built from it.
**Fix:** compose reads it from `docker/.env`, which now has `MINIO_PUBLIC_URL=https://meowlish.servebeer.com`
(Caddy already serves MinIO there). Verified `…/public/SYSTEM_62-64.jpg` → 200, CORS OK for uploads.
The new file-service image first crashed on start (old queues); fixed by the queue recreation above.

## Problem 2 — question panels don't auto-collapse — ✅ (please retest)

The panel state was already "one open at a time", so I couldn't reproduce it from the code. Made it
unambiguous anyway: one toggle path whether details are cached or not, a slow load no longer clears
another question's spinner, and the opened question scrolls into view (when the panel above closes,
the page jumps, which can look like nothing closed). If it still happens, tell me which button.

## Problem 3 — "Phân tích chi tiết" showed only Implication 0/0/2 — ✅

The data was right: in attempt `433f3cab…`, questions **21–34** were unanswered (not
only 23 and 26), and the table has 6 category rows; Implication is the one where both questions were
skipped. Its accuracy showed "–" because skipped questions were excluded. Now accuracy counts every
question (all skipped → 0%), rows are sorted by size, and question numbers are colored
green/red/gray by result.

## Problem 4 — finished attempt at /test/do/<id> — ✅

**Cause:** the lookup only finds unfinished attempts and returned the same 404 as "not yours".
**Fix:** backend answers **409 "Attempt already submitted"** for the owner (others still 404;
verified live). The page shows "Bài thi này đã được nộp" and opens the result; other load errors go
back to the history after a message.

## Problem 5a — tag list on /test-selection — ✅

- Tags load once per session (memory + sessionStorage, 10 min) via `lib/tag-list`.
- The long chip row is now one compact, type-ahead picker grouped by root tag (hides the other exam
  type's tags); selected tags are chips.
- **Bug found and fixed:** the IELTS/TOEIC tabs didn't filter anything (both showed every exam).
  Backend got a `requiredTags` filter (exam must have every listed tag); verified IELTS tab → 9
  IELTS exams, TOEIC → 2.
- **Bug found and fixed:** filtering by a single tag always failed with 400 ("filter.tags must be
  an array").
- Data note: TOEIC exams' sections have no part tags/names, so "Part 1" etc. match nothing yet.

## Problem 5b — own public flashcard list missing from Discover; search — ✅

**Cause:** the frontend removed the user's own lists from Discover (and then paged with the server
total). Own lists now show, marked "Của bạn", with the real count. Discover has search by name (as
you type; new backend `name` filter, case-insensitive) and by tags.

## Problem 7 — flashcard tag suggestions — ✅

**Cause:** suggestions read a Redux slice nothing filled, filtered by a field backend tags don't
have, and a picked suggestion would have been saved as an id. New shared `TagInput` (suggests exam
tags + tags already used, keyboard friendly, stores names) in both the card form and the **list
creation form**. The list page's tag filter now offers the tags its cards actually carry.

## Problems 8 & 13 — answers lost — ✅

**Causes:** every keystroke sent its own racing DELETE/POST pair; they collided on the attempt's
version check (3 retries) and some failed silently; an older text could land last; **submit
cancelled pending saves and didn't wait for in-flight ones**; "Nộp & Bắt đầu mới" ended the old
attempt while its saves were pending and started a new attempt even if ending failed; answer routes
shared a 100/min per-IP limit.
**Fixes:**
- `lib/answer-sync.ts`: one queue per question, only the latest value, strictly in order, retries
  transient errors, reports failures (8 tests).
- Test page shows "Đang lưu… / Đã lưu mọi câu trả lời / Chưa lưu được N câu"; submit waits for every
  save and refuses to submit while answers are unsaved; leaving the page sends what's pending.
- Exam page waits for that attempt's pending saves before "submit and start new", and doesn't start
  a new attempt if ending the old one failed.
- Backend: answer/flag/note routes 300/min per account; conflict retries 3 → 6.

## Problem 10 — writing score instant — ✅

**Causes:** (1) **no scorer ran** (mock scorer was behind an opt-in compose profile), so
submissions were never scored; (2) **the /writing page faked it**: it showed the attempt's
*maximum* points as the score on the first poll.
**Fix:** mock scorer started (`docker compose --profile mock-ai`; waits 1–3 min, random IELTS band);
the page now waits for the real band/feedback. Pipeline verified: `exam.writing.submitted` →
scorer → `exam.writing.scored` → exam. **Verified live end to end:** a test writing submission was
scored **~132 s after submit** (band 6.0), inside the 1–3 min window. While testing I also found the
/writing page would have shown band 0 with no feedback (the result is stored double-encoded) —
fixed. Writing attempts submitted before today were never scored.

## Problem 14 — back button on exam detail — ✅

The list's tab/search/tags live in the URL; an exam opened from the list carries `?from=`; "Quay
lại" returns there (else browser back, else the list).

## Problem 12 — where to set preferences — ✅

The backend had notification preferences but **no page used them**, and the sidebar's only gear
icon opened the profile. New **/settings** ("Cài đặt" in the sidebar): switch each notification
type (Thành tích, Báo cáo, Hệ thống; saved instantly), light/dark theme, links to profile and
sign-in methods. The profile button now has a person icon. E-mail/push switches are left out on
purpose: the app sends neither.

## Problem 15 — design feels flat/inconsistent — ✅

Added the repeating background you described: a soft "storage box" checker (like a game's PC-box
wallpaper) in the app's green/orange palette with study motifs — leaf, open book, "Aa", star,
pencil, speech bubble — drifting slowly on a diagonal behind every app page. Pure CSS/SVG, readable
veil from the top, dark-mode variant, no motion with "reduce motion". Page-level consistency came
with the redesigns of the test list, results, flashcards, settings, progress/dashboard, admin
console, blog and the new forum (all below), and the shared form-error pattern.

## Problem 18 — notifications don't work — ✅

**Causes:**
- Nothing consumed a "report created" event — none existed — so **admins were never notified**
  of reports. (Report *status* notifications to the reporter existed.)
- In the database there was **not a single real notification**: all 30 rows were seed data.
- The seed invented notifications the system never sends ("Tuần này bạn đã học được 5 bài mới", a
  "first lesson" badge, …). Real texts were also in English.
- The half-migrated event setup (see top) also affected the notification queues.

**Fixes:**
- auth: new service-to-service RPC `FindIdentityIdsByRole` (active admins).
- resource: creating a report publishes `resource.report.created` (inside the same transaction).
- notification: new consumer — every admin (except a reporting admin) gets "Có báo cáo mới cần xử
  lý", respecting their preference; badge/status texts in Vietnamese; clicking a notification opens
  its page (admins → /report-management, badges → /progress).
- Seed creates no fake notifications and removes old ones; the 30 fake rows were removed from the
  live database.
- **Verified live:** filed a test report as the demo account → the admin received the notification
  within seconds; then deleted the test report and notification.

## Problem 9 — "Phân tích kỹ năng" chart — ✅

The radar chart is replaced by **four skill cards** (Listening/Reading/Writing/Speaking): level
badge (Cần luyện thêm → Vững vàng), latest score (band for Writing), trend chip, a sparkline of the
last 10 scores, attempts/average/best. Below: **"Tập trung tiếp theo"** and correct/wrong/skipped
bars per question type, weakest first. New backend endpoint `GET /exams/practice/my/skills`
(requester's own data only; verified live).

## Problem 11 — "Lịch luyện tập" / "Hoạt động luyện tập" — ✅

- **Lịch luyện tập** → a Monday–Sunday week view: done/missed/today/upcoming tiles, "3/4 ngày"
  progress against a weekly target (2–7 days, remembered in the browser), and a suggestion for today
  (weakest question type, "Luyện ngay" opens the filtered exam list).
- **Hoạt động luyện tập** → a GitHub-style heatmap (3/6/12 months) with month/day labels, tap/hover
  captions ("Thứ sáu, 13/11/2026 · 2 bài · 35 phút"), current/longest streak, active days, practice
  time. New endpoint `GET /exams/practice/my/activity` (verified live).

**Decisions for you (from this work):**
1. Days and streaks use **UTC** (07:00–07:00 Vietnam time), matching the existing login streak. I
   can switch to local days.
2. The weekly target lives in the browser only (a server copy needs a schema change).
3. Speaking results aren't stored anywhere, so the Speaking card always says "Chưa có dữ liệu".
4. A skill is recognised from tag names (Listening/Reading/…); untagged exams only feed the
   question-type bars.
5. "Luyện ngay" opens the IELTS tab; for a TOEIC-only question type the user must switch tabs.

## Problem 19 — admin pages — ✅

All admin pages (dashboard, exam management, exam approval, user management, reports, blog
management) rebuilt on shared console blocks: page header + actions, clickable stat cards that
filter, toolbar with search and compact filters, tables with sticky headers that become cards on
phones, "…" row-action menus, consistent status badges, pagination, confirmation dialogs that show
errors inline, skeleton/empty/error states, access-denied panel, real user names for
creators/reporters/authors.

**Bugs found and fixed on the way:**
- **Exam editor sent minutes as seconds** (a "60-minute" exam got a 60-second timer). Checked the
  database: all 12 exams are seeded with correct durations, none was created through the editor, so
  no data to repair.
- Removing a role sent the role *name* instead of its id → always 409.
- User list loaded only 20 users; role filter compared names with ids; role labels didn't match
  backend names; empty option could crash the role dialog. Backend also rejected filtering by a
  single role ("must be an array") — fixed in the gateway.
- Reports: filters/counts covered only the current page, reporter names never loaded, mods were
  refused though the API allows them, /report-management wasn't protected when signed out.
- Blog management offered non-admins edit/delete on others' posts (API refuses).
- Exam approval preview showed an invented 70% pass mark.
- Sidebar offered mods "Duyệt đề thi" and "Quản lý User", which the backend refuses them; removed.
- Unused mock components removed (`ExamApproval`, `AdminUploadTool`).

**Limits:** the backend's exam title filter only matches exact titles, so admin exam pages load up to
2,000 exams and search in the browser; report and blog search filter the current page only (no
server search). The exam *editor* (sections/questions) got error handling and the header fix, not a
full redesign.

## Problem 20 — form errors break layouts — ✅

**Causes:** the login/signup alert put its text in a zero-width grid column; toasts overflowed the
left edge on phones and didn't wrap; long or list-shaped server errors (the backend sends `error` as
a string or an array) were dumped inline.
**Fix:** one pattern everywhere — `FieldError` under the field (smooth expand, wraps, aria wired),
`FormErrorSummary` for form-level errors (wraps, lists up to 5), and `lib/api-errors.ts`, which
turns backend messages into Vietnamese ("filter.tags must be an array" → "Nhãn phải là một danh
sách"), maps them to fields and handles network/status fallbacks. Applied to login/signup, profile,
password and add-email dialogs, goal dialogs (merged into one, with score-range checks), report
dialog, flashcard list and card dialogs, exam info form, blog editor. Dialogs stay open on failure.
Checked 200+ character errors at 360px and 1280px: nothing overflows.
Also: the frontend allowed 6-character passwords while the backend requires 8+ with upper, lower,
digit and symbol, so signups failed with an English error — rules now match.

## Problem 6 — blog redesign + richer seeded blogs — ✅

- **/blog:** featured newest post, cards with cover image (the post's first Markdown image),
  excerpt, author, date, reading time, tag filters.
- **/blog/[id]:** readable article typography, cover, author/date/tags, related posts, comments.
- **Seed:** 8 posts (5 rewritten, 3 new) with cover images (Unsplash CDN, all checked to load) and
  real formatting: headings, tables, lists, quotes, code. Re-runnable; existing seeded posts kept
  their ids. Applied to the live database (backup first: `~/meowlish-resource_db.20261114-001320.sql.gz`).

## Problem 16 — forum (MangaDex-style) with reporting — ✅

- **/forum:** categories with thread counts and latest thread. **/forum/[category]:** threads (pinned
  first, then latest activity), title search, new-thread dialog. **/forum/thread/[id]:** thread,
  paginated replies, quoting another reply, Markdown editor, edit/delete own posts, moderator
  pin/lock/delete, report buttons. "Diễn đàn" in the sidebar.
- Backend in the resource service (`ForumService`), routes under `/api/v1/resources/forum/…`, rules
  enforced in the service: only the author edits; author or moderator deletes; others get 404;
  only moderators pin/lock, post in "Thông báo", or write in a locked thread.
- Reports: forum threads, forum replies and blog comments are new report targets; the admin report
  page links straight to the reported reply/comment.
- Seeded: 7 categories, 11 Vietnamese threads, 21 replies.
- **Found while deploying:** every forum/comment route answered 501 — the resource service never
  registered the two new gRPC services. Fixed; then verified live: list, create thread, reply,
  read, delete, and comment create/delete (test data removed).

## Problem 17 — nested blog comments — ✅

**Structure: materialized path.** Each comment stores its top-level comment (`rootId`) and a `path`
of fixed-width base36 segments (one per level, from an atomic per-parent counter).
- Insert = one row + one counter increment (concurrent replies can't collide).
- Reading a page of threads = one indexed query, already in display order (sort by path).
- Nested set was rejected: every insert renumbers later rows, bad for an insert-heavy table. Closure
  table needs an extra table and several rows per insert. Parent-id only needs recursive SQL.
- Trade-off: moving a subtree would rewrite paths, but comments never move.

Replies render nested (beyond 8 levels they're stored next to their parent). Deleting a comment that
has replies leaves "[đã xóa]"; otherwise it's removed. Edit/delete own, moderators delete any,
report a comment. Top-level comments paginated newest first.

---

## Decisions for you

1. **Streak/calendar days use UTC** (07:00–07:00 Vietnam time), matching the login streak.
2. **Weekly practice target** is stored in the browser only.
3. **Speaking** results aren't stored anywhere, so its progress card stays empty.
4. **Forum/comment moderation** is given to both `mod` and `admin`. Admin-only is one constant per
   gateway controller.
5. **Forum view counts** go up on every page load (no de-duplication). Forum replies are deleted
   outright (a reply quoting one loses the quote); comments keep a "[đã xóa]" placeholder.
6. Not built: notifications when someone replies to you (forum/comments).
7. **Mock AI scorer runs in production** (no real scorer exists). Stop it when there is one.
8. **`TRUST_PROXY` is unset**, so all users may share per-IP rate limits on most routes.
9. Admin exam search is client-side (backend title filter is exact match); report/blog search
   filters the current page only.

## Not done / out of scope

- **Nothing is pushed.** The main frontend (meowlish-fe.vercel.app) still runs old code until
  `feat/backlog-goal` reaches `main`, and pushing the backend needs `git-lfs` reinstalled
  (`sudo pacman -S git-lfs`).
- Husky isn't installed in the backend clone (`pnpm exec husky`), so pre-commit hooks don't run; I
  ran lint/test/build myself before each commit (latest: all 17 backend projects pass; frontend 162
  tests pass, build passes, `tsc` 53 pre-existing errors, none new).

## Commits (this round)

Backend `chore/local-dev-fixes`: 4e3fb34 … 4836a9c (MinIO URL, finished-attempt 409, autosave
limits, required tags, single-value filters, flashcard name search, role lookup, report-created
event, admin notifications, progress endpoints, forum, nested comments, seed, gRPC registration).
Frontend `feat/backlog-goal`: 4873021 … f04c168 (answer sync, writing score, results page, tag
picker + URL filters, flashcards, settings, notifications, background, progress/calendar redesign,
admin console, form errors, forum, blog redesign + comments).

---

## Follow-ups after the list (all ✅, deployed)

- **Chat room buttons:** "Tạo phòng" only for mods/admins; delete, schedule and ban only for admins
  and the mod who created the room (the backend's rules). Failures show a message. Seeded rooms
  have no recorded creator, so only admins can delete them.
- **Chat previews / "Ẩn danh":** causes found in the backend: the preview came from each room's chat
  log, whose first page is the **oldest** 20 messages (stale previews in busy rooms, one request per
  room), and sender names were only loaded inside a room. The room list now returns each room's
  newest message (one query) and creator; names load in one request with a placeholder; first load
  shows a skeleton. Also fixed: room schedules were never sent to the frontend (field named
  `scheduledTime` internally, `scheduledDate` in the API).
- **Flashing on filter changes:** /progress (3/6/12 months), /test-selection (tags), blog tags, forum
  search and flashcard Discover swapped their content for loading states on every change, and the
  test list re-created all its cards on every render. They now keep the current content dimmed
  while the new data loads; /progress loads the year once and switches ranges instantly.
- **"Làm full test":** the notice moved from the page header (it pushed the page down when switching
  tabs) into the full-test card; the slide-in and bouncing icon are gone.
- **Blog comments:** two levels on screen, Facebook style; deeper replies show "Đang trả lời <name>",
  which scrolls to and highlights the parent comment.
- **Blog management:** admins can filter posts by any author (username search, server-side).
- **TOEIC exams "gone":** they were hidden, not deleted — the removed IELTS/TOEIC tabs had left a
  hidden IELTS default that my tab filter turned into a real filter. All exams show again, with an
  optional "Tất cả / IELTS / TOEIC" switch. Tag picker popup is wider; "Tạo bộ mới" hover fixed.
- **Flashcard review mode** (`/flashcards/review`, "Ôn tập" on /flashcards, "Ôn tập bộ này" on your
  own lists): pick any of **your own** lists and the prompt types (Từ → Nghĩa, Nghĩa → Từ, Ghi chú →
  Từ; a card without a note falls back to Từ → Nghĩa) and whether to shuffle; **every card** of the
  chosen lists is asked. You type what you remember; the reveal shows your answer next to the saved
  card — **no scoring or grading** — and you can edit the card right there. The end screen says how
  many cards you went through ("Ôn lại từ đầu", "Chọn bộ khác"). Survives a refresh.
- **Avatar not loading on /user (rate limited):** two causes. (1) A loop: the profile page
  reloaded its data whenever the user object changed — and its own update changed it — so it
  refetched identity, credentials, badges, stats, goal and history endlessly (Envoy logs: exactly
  100 identity calls per minute, then 429). Fixed; identity calls also go through a small cache
  (shared request, 30 s, cleared after profile/avatar edits). (2) The gateway counted every user as
  the proxy's IP (all traffic arrives from one Vercel address), so everyone shared one 100/min
  budget per route. Signed-in users are now limited per account; anonymous traffic stays per IP.
- **Avatar request blocked (`https://https//…`):** the profile header added a second "https://"
  in front of an address that already had one. Fixed.
- **Save a copy of a public list / propose changes:** live. "Lưu về bộ của tôi" makes your own
  private copy (with all cards); "Đề xuất thay đổi cho bản gốc" shows what you changed and sends it
  to the owner, who accepts (choosing per card if both changed it) or rejects; "Cập nhật từ bản
  gốc" pulls the owner's later changes into your copy. Owners/proposers get notifications.
  Verified live (copy, diff, count, delete).
- **"Lọc theo chủ đề" button jumping:** picked tags now sit on their own row below; the button,
  its counter and "Xóa bộ lọc" keep their space.
- **Back to the same place:** the exam list uses numbered pages now (backend page mode with a
  total), and the page is in the address with type, search and tags, so returning from an exam
  lands on the same page. Flashcards keep tab, page, search and tags the same way.
  Decision: numbered pages for catalogues you browse and come back to (exams, flashcard lists,
  blog, forum, admin tables); "load more"/cursor for time-ordered feeds (chat, notifications,
  attempt history), where page numbers would shift as new items arrive.
- **Skeleton loading:** every page shows a placeholder shaped like its content while loading
  (including the app frame on first load), keeps content dimmed while refreshing, and reserves image
  boxes so nothing jumps. /user now loads its sections in parallel; /progress no longer loads its
  history twice.
- **Changelog:** rewritten for learners in plain Vietnamese (no technical terms), grouped as Tính
  năng mới / Cải thiện / Sửa lỗi, with a separate box for admin changes; new 0.10.0 release covers
  the recent work. A test fails if developer jargon slips back in.
- **Seeded attempts / demo account:** the seed broke the "one unsubmitted attempt per exam" rule
  (admin had several open attempts on the same exam). Fixed and reseeded the live databases (backups
  in `~/meowlish-db-backups/`, 20261114-014822): no user now has more than one open attempt per exam;
  testers' real attempts were left untouched. The demo account now has ~5 weeks of finished
  IELTS/TOEIC/writing attempts (progress cards, heatmap and weekly plan have data), one open attempt,
  a goal, streak and 5 badges with their notifications, 3 flashcard lists, a forum reply and a blog
  comment. Note: the seeded open attempt expires ~2 h after seeding; reseeding refreshes it.
- **Attempt links:** unfinished attempts open the test screen (`/test/do/…`), finished ones the
  results (`/results/…`), on /progress, history, profile and the exam page ("Tiếp tục" on open ones).
- **Badges:** the "Danh hiệu" tab is now a medal collection: all 17 badges grouped by family
  (luyện đề, điểm tốt, điểm tuyệt đối, ngày học, chuỗi ngày học), hexagon medals in bronze / silver /
  gold / diamond with a family icon, Vietnamese names, date earned, progress bars on locked ones,
  a collection counter, "Sắp đạt được" and the latest earned badges.
- **Hoạt động luyện tập:** stat labels no longer cut off (they wrap; 4-in-a-row only on very wide
  screens), and days without practice are plain grey instead of a pale green.
- **Heatmap colours (/dashboard, /progress):** empty days are a light grey with a thin outline
  (the darker grey was too strong); the green scale starts darker, so days with a little practice
  are easy to see.
- **Review game:** the previous card's answer no longer stays in the box when the next card comes
  (each card is now its own fresh component). After Enter, the answer box moves to the left and the
  saved card slides in on the right.
- **More seed data for paging:** 22 blog posts, 25 public flashcard lists and 26 chat rooms.
- **"Dịch nghĩa" (translate):** when you make a flashcard from highlighted text during an exam, and
  in the "Tạo flashcard" dialog on /flashcards, a button fills "Định nghĩa" with a Vietnamese
  translation of the word. The translation is **added after** what you already typed ("; "), never
  replacing it and never added twice. It uses Gemini, with the free MyMemory API as fallback.
- **/chat search + prev/next:** the frontend never sent the search to the backend. It filtered the
  20 rooms already loaded, and prev/next paged the full list, so search results changed or
  disappeared when you changed page. The backend also had no name filter and always returned a
  "next" link. Now the search runs on the server (case-insensitive, any part of the name), the
  links keep the search, and prev/next only appear when a page exists. Verified live: "e" gives 18
  rooms over 4 pages of 5, and going back works.
- **Badges "Đang trao danh hiệu…" + "Nhà khám phá" (14 days):** the label was mine, not a backend
  state: a badge whose target was reached but not awarded. The real bug was in the backend: the
  login badges only checked 7, 30 and 365 days, so **both 14-day badges** (Nhà khám phá, Chú ong
  chăm chỉ) could never be earned. Fixed: every login now checks all thresholds against your total
  days and your best streak, so badges that were already due arrive on the next login. The demo
  account got Nhà khám phá after one login. Its best streak is 12, so "Chú ong chăm chỉ" isn't due
  yet, which is correct. The label now says when the badge arrives, e.g. "Nhận ở lần đăng nhập
  tiếp theo".
- **Review game, "Xem thẻ đã lưu" animation:** it animated the column widths, so the answer box
  re-wrapped its text on every frame, its buttons disappeared and the footer popped in (the page
  jumped). Now the two columns have a fixed size: the answer box starts centred and slides left in
  one smooth move, and the saved card fades in on the right. The footer row stays in place and
  only its buttons change.
- **Heatmap grey (/progress, /dashboard):** empty days are lighter again and no longer have an
  outline, which made the grid look heavy.
- **Blog tag filter:** there was no backend endpoint for blog tags, so the page only knew the tags
  of the posts it had loaded and the list grew as you changed page. New `GET
  /resources/blogs/tags` returns every tag (most used first); /blog and /blog-management use it.
  The seeded posts also mixed tag styles ("IELTS" and "ielts", "Writing" and "viet-lach"), so some
  tags showed twice. All tags are now slugs (live data fixed too; backup
  `~/meowlish-db-backups/resource_db-20261114-093343.sql`).
- **Collapsed sidebar can't scroll:** the icon-only sidebar hid anything below the window. It
  scrolls now (no visible scrollbar).
- **New notifications (+ settings):** "Bình luận bài viết" (someone comments on your blog post),
  "Trả lời bình luận" (someone replies to your blog comment or quotes your forum reply), "Trả lời
  chủ đề diễn đàn" (someone replies in your forum thread). Each can be turned off in /settings.
  You're never told about your own messages, and if you are both the owner and the person replied
  to you get one notification. Clicking opens the comment, or the forum page the reply is on.
  Verified live with the demo and admin accounts (comment, reply, forum reply, and opting out);
  the test posts and notifications were removed afterwards.
- **Real AI writing scorer (replaces the mock):** `docker compose --profile ai up -d` starts
  `ai-llm` (llama.cpp running linhma139/Phi-3-IELTS-Scorer on CPU) and `ai-scorer` (the
  ai-language-evaluator worker, pinned commit). The mock is stopped and its queues deleted. Tested
  end to end as the demo account on "IELTS Writing 6" (attempt 12910f3b…): both essays scored in
  ~1–1.5 min, feedback saved, attempt score recomputed, results page shows the AI feedback.
  Problems found in the worker (upstream): when the model skips the "Overall Band Score: x" lines,
  it saves **band 0 as a success** (happened to the Task 1 essay); an empty HF_TOKEN crashes every
  request; the model repeats itself (capped server-side). The frontend no longer says Writing
  gives random scores.
- **Band 0 from the AI scorer — fixed with a build-time patch:** the Task 1 zero was not an IELTS
  band-0 judgement (the model wrote "Scoring: 8.0 … an 8 out of 9 band score"); the worker only
  understood "Overall Band Score: x" and saved 0 for anything else. The patch reads the model's
  other formats, re-asks it with a format reminder when no band is found, and reports an error
  instead of 0; a real band 0 written by the model is still saved as 0. Re-scored the same essay:
  band 8.0 with all four criteria, attempt score 2/2. Also fixed: empty-token crash, password in
  logs, retries leaking to other queues. Disk: cleared old Docker build cache (4 GB → 38 GB free).
- **Backlog cleared (details in `docs/fixed-issues.md`), all deployed and checked live:**
  S18 access tokens no longer work as refresh tokens (live: 401); S19 bans can't be dodged by
  leaving one's own socket room (live: refused); S17 sockets check revocation at connect and a
  lock disconnects the user; S16 Envoy ports only on localhost; C20 report attachments are
  reference-counted; C21 AI scoring failures are stored and shown ("Chưa chấm được") instead of
  lost; scoring is durable (exam consumes its own submit event through the inbox); writing points
  now reach the score badges (`exam.attempt.rescored`; live: demo got its first perfect-score
  badge from an AI-graded attempt); unroutable events are kept and retried; every service runs
  the relay; legacy bare payloads removed; exam DTOs implement the proto types; config read only
  through ConfigService. New open items: S20 (database ports public, needs your decision), C22.
- **TOEIC LR 2:** the seed only had Reading parts 5–7 (32 questions) but was called "LR" with
  Listening tags and 2 hours, and parts 6–7 had no passages (17 questions unanswerable). Added the
  passages and instructions; renamed "TOEIC Reading 2 (Part 5–7)", Reading tag, 25 minutes;
  fixed in place on the live database.
- **Blog comments:** no depth limit any more (replies were flattened below level 8).
- **S20 (database ports) and C22 (first websocket connection) fixed too:** every infrastructure
  port (Postgres, Redis, RedisInsight, Adminer, MinIO, RabbitMQ, Grafana) and every Envoy port
  is now localhost-only; checked from the LAN that all are closed, and the site, files and chat
  still work through Caddy. The gateway now proxies websocket upgrades from start-up (checked
  live straight after a restart). The backlog has no open items.
- **Results page formatting:** question text and passages are HTML but were shown as plain
  text; they now render like in the test (headings, italics, tables), sanitized.
- **Flow-doc findings pass:** the confirmed findings from docs/architecture/flows were fixed and
  documented in docs/fixed-issues.md (outbox relay publishes `mandatory`, malformed pagination
  cursors give 400, limit > 100 gives 400, presign validation, achievement duplicate-badge
  migration, stale authorization rows cleaned). Deployed and smoke-tested. The 23 findings that
  need a decision are in docs/backlog.md (S21–S25, C23–C40).
- **Readable URLs (slugs):** exams, blog posts and forum threads now have slugs made from their
  titles (`/test/toeic-lr-1`, `/blog/5-loi-thuong-gap-khi-phat-am-tieng-anh`). A slug never
  changes after it is created, old id links still work and switch to the slug in the address
  bar, and lookups accept the id or the slug. Existing rows were backfilled on deploy (13 exams,
  22 posts, 13 threads), after a DB backup in ~/meowlish-db-backups. Forum categories already
  had slugs; lists and private pages (attempts, flash cards) don't need them. Checked live on
  the share site.
- **AI scorer:** switched to the mock scorer.
- **Backlog decisions (S21–S25, C23–C40), all closed:**
  - **Kept as decided:** S24 (explanations public), C23 (deleted users still hydrate), C27 (deleting an approved exam cascades), C34 (every view counts), C36 (unused switches stay).
  - **Done as decided:**
    - C28: an approved exam is frozen for everyone, status included; only delete is allowed (tag changes were the one gap).
    - C30: a report is resolved once, by one person, then nobody can change it (409).
    - C40: orphan files are kept 24 h, and a late `file.added` logs a warning.
  - **Fixed with the suggested solution:**
    - S21: Google login state is bound to the browser by a cookie.
    - S22: refresh tokens rotate with reuse detection (checked live: reusing an old token after 30 s revokes the session).
    - S23: rate-limit counters are in Redis, in memory while Redis is down.
    - S25: users banned from a room can't read its history.
    - C24: username rule `[a-z0-9._-]{3,30}`.
    - C25: half-band goals, each test with its own scale.
    - C26: writing feedback is encoded once.
    - C29: cards have an order in their list.
    - C31: concurrent comment deletes are locked.
    - C32: flash card edits are checked by the resource service, so a new card can be edited at once.
    - C33: withdrawing a proposal removes the owner's notification.
    - C35: SSE goes through Redis, with heartbeat and replay.
    - C37/C38: forum quote and flash card notification switches.
    - C39: forum reply links don't depend on the page size.
  - **Frontend:** matching changes (settings switches, username checks, goal scales, report page, chat 404). The profile dialog also had a bug: it pre-filled the e-mail instead of the real username.
  - **Docs:** fixed-issues.md, flow pages, AGENTS.md and upgrade notes updated.
  - **Deploy:** DBs backed up, migration and db push applied, deployed in the required order, smoke-tested in production and on the share site.
- **Flash card images in file-service:** cards take an uploaded image (`imageFileId`) instead of a typed-in URL. Every card using a file is one reference, copies included, and replacing, removing or deleting releases it. Old URL-only cards still show their image. Checked live: upload, copy (2 references), deleting the original (1), replace and remove (0), list and card delete, and a 403 for someone else's file. The upload form was checked on the share site.
- **Settings switches:** the off state was invisible (a Tailwind 4 token in a Tailwind 3 project); fixed.
- **Badge names:** the backend and the notifications use the same Vietnamese names as the badge page, and existing notifications were rewritten.
