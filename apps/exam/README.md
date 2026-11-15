# exam

Exams and their content (nested sections, questions, choices, attached files), the tag tree, study goals, and practice: attempts, answers, notes, flags, submission and scoring. Writing answers are sent to the AI scorer over RabbitMQ and its feedback is stored back on the attempt, which may change the score.

## Tech used

| Technology                                                    | What for                                                                                                                                                            | Where                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| NestJS gRPC (`Transport.GRPC`)                                | Four gRPC services on `HOST:PORT`; HTTP on `HEALTH_PORT` for health only                                                                                            | `src/bootstrap.ts`, `src/presentation/controllers/`                                           |
| CQRS (`@nestjs/cqrs`)                                         | Management and practice commands/queries; tags and goals use plain services                                                                                         | `src/app/commands/`, `src/app/queries/`, `src/app/services/tag.service.ts`, `goal.service.ts` |
| Prisma + Postgres `exam_db` (migrations)                      | All exam data; `prisma/migrations/`. Triggers installed by migrations keep `section_closures` in sync and write released file ids into `deleted_files` (`src/sql/`) | `prisma/schema/{exam,exam-practice,file,goal,tag}.prisma`, `src/infra/repositories/`          |
| `nestjs-cls` + `@nestjs-cls/transactional`                    | Transactions; attempts use an optimistic `version` with conflict retry                                                                                              | `src/exam.module.ts`, `src/app/services/attempt-conflict-retry.ts`                            |
| BullMQ (`@nestjs/bullmq`, queue `exam`, Redis)                | Repeatable job every 60 s: drains `deleted_files` into `exam.files.removed`                                                                                         | `src/app/events/publishers/files-removed.publisher.ts`                                        |
| RabbitMQ (`@golevelup/nestjs-rabbitmq`) + `@server/messaging` | `OutboxPublisher` + `OutboxRelay` (`relay: true`, connection `pub`); two consumers on `sub` with `InboxService`, retry and DLQ                                      | `src/configs/rmq.*.config.ts`, `src/app/events/`                                              |
| file-service gRPC client (`file.FileServiceClient`)           | `GetUrls` (file URLs in section/question/attempt queries), `CheckFilesOwnedBy` (attached files must be the user's; admins skip it)                                  | `src/app/queries/handlers/`, `src/app/services/file-ownership.service.ts`                     |
| Slug backfill                                                 | Gives older exams a slug at start-up (`OnApplicationBootstrap`)                                                                                                     | `src/app/services/exam-slug-backfill.service.ts`                                              |
| OpenTelemetry + health (`@server/telemetry`)                  | `startTelemetry`; `HealthModule` checks Postgres and RabbitMQ                                                                                                       | `src/main.ts`, `src/exam.module.ts`                                                           |

## Talks to

- **Called by**: the gateway (`/api/v1/exams/*`).
- **Calls**: file-service gRPC (`GetUrls`, `CheckFilesOwnedBy`).
- **gRPC** (`proto/exam.proto`):
  - `ExamManagementService`: `CreateExam`, `CreateSection`, `CreateQuestion`, `UpdateExam`, `UpdateSection`, `UpdateQuestion`, `DeleteExam`, `DeleteSection`, `DeleteQuestion`, `MoveSection`, `MoveQuestion`, `ReviewExam`, `FindExams`, `GetExamDetails`, `GetSectionDetails`, `GetQuestionDetails`, `GetExamCounts`. Mutations carry a requester: only the exam's creator or an admin may change it.
  - `ExamPracticeService`: `Attempt`, `EndAttempt`, `Answer`, `RemoveAnswer`, `AddNote`, `ToggleFlag`, `GetUserStats`, `GetUsersAttemptSummary`, `GetUsersAttemptHistory`, `GetUserActivity`, `GetUserSkillStats`, `FindExams`, `GetExamDetails`, `GetExamStats`, `GetAttemptSavedData`, `GetAttemptReview`, `GetDetailedQuestionInfo`.
  - `TagService`: `AddTag`, `DeleteTag`, `UpdateTag`, `MoveTag`, `GetTagTree`, `GetTagList`.
  - `GoalService`: `SetGoal`, `UpdateGoal`, `DeleteGoal`, `GetGoal`.

Events published (outbox):

| Routing key              | Shape    | When                                                                                             | Consumer queue → service                                                                                      |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `exam.exam.created`      | envelope | `CreateExam`                                                                                     | `authorization.events.exam.created` → authorization                                                           |
| `exam.exam.deleted`      | envelope | `DeleteExam`                                                                                     | `authorization.events.exam.deleted` → authorization                                                           |
| `exam.attempt.submitted` | envelope | `EndAttempt`                                                                                     | `exam.events.attempt.submitted` → exam itself (scoring); `achievement.events.attempt.submitted` → achievement |
| `exam.attempt.scored`    | envelope | exam's own `AttemptSubmittedHandler`                                                             | `achievement.events.attempt.scored` → achievement                                                             |
| `exam.attempt.rescored`  | envelope | `WritingScoredHandler`, when the score changed                                                   | `achievement.events.attempt.rescored` → achievement                                                           |
| `exam.writing.submitted` | **bare** | Same transaction as `exam.attempt.scored`, per Writing answer; carries the goal's `target_score` | `writing.evaluate` → AI scorer (profile `ai`) or `mock-ai-scorer.writing.submitted` → mock-ai-scorer          |
| `exam.file.added`        | envelope | Section/question update attaching files                                                          | `file.events.file.added` → file-service                                                                       |
| `exam.files.removed`     | envelope | BullMQ job every 60 s                                                                            | `file.events.files.removed` → file-service                                                                    |

Events consumed (`src/app/events/handlers/`, queues in `src/configs/rmq.sub.config.ts`):

| Routing key              | Queue                           | Effect                                                                                                                                |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `exam.attempt.submitted` | `exam.events.attempt.submitted` | Score the attempt, publish `exam.attempt.scored` and `exam.writing.submitted`                                                         |
| `exam.writing.scored`    | `exam.events.writing.scored`    | Bare message from the scorer: save feedback in `scorer_data`, recompute the score; `status: 'error'` is stored as a failure and acked |

## Data

Postgres `exam_db`:

| Table                                          | Key columns                                                                                                                                                                                         | Purpose                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `exams`                                        | `id`, `slug?` (unique, never changes), `created_by`, `version`, `title`, `description?`, `status`, `duration` (s), timestamps; indexes `status`, `version`, `(updated_at, id)`                      | An exam; `created_by` drives the creator-or-admin rule                                                      |
| `sections`                                     | `id`, `exam_id`, `parent_id?`, `name?`, `directive`, `order`, `content_type`                                                                                                                        | Nested sections (cascade from exam and parent)                                                              |
| `section_closures`                             | PK `(ancestor_id, descendant_id)`, `depth`                                                                                                                                                          | Closure table for the section tree (kept by triggers)                                                       |
| `questions`                                    | `id`, `section_id`, `content`, `type` (default `MCQ`), `points`, `explanation`, `order`                                                                                                             | A question                                                                                                  |
| `choices`                                      | `id`, `key`, `content?`, `is_correct`, `question_id`                                                                                                                                                | Answer options                                                                                              |
| `attempts`                                     | `id`, `attempted_by`, `exam_id`, `started_at`, `ended_at?`, `duration_limit`, `score?`, `total_points?`, `is_strict`, `version` (optimistic lock), `order`; unique `(exam_id, attempted_by, order)` | A practice attempt; `order` prevents two active attempts per user and exam                                  |
| `attempt_sections`                             | PK `(attempt_id, section_id)`                                                                                                                                                                       | Sections included in an attempt                                                                             |
| `attempt_responses`                            | `id`, `attempt_id`, `question_id`, `answers[]`, `is_correct?`, `is_flagged`, `note?`; unique `(attempt_id, question_id)`                                                                            | The user's answer per question                                                                              |
| `scorer_data`                                  | `response_id` PK, `comment` (JSON: feedback or failure object)                                                                                                                                      | AI writing feedback from `exam.writing.scored`                                                              |
| `section_files` / `question_files`             | PK `(section_id \| question_id, file_id)`, `updatedAt`                                                                                                                                              | Files attached to a section or question (ids from file-service)                                             |
| `deleted_files`                                | `file_id` PK, `count`                                                                                                                                                                               | Released file references (written by triggers), drained into `exam.files.removed`                           |
| `goals`                                        | `uid` PK, `date`, `target` (double: score in the type's own scale, e.g. IELTS 6.5), `type` (e.g. `IELTS`, `TOEIC`, `TOEFL`, `VSTEP`)                                                                | A user's study goal; the target is sent to the AI scorer                                                    |
| `tags`                                         | `id`, `name` (unique), `lft`, `rgt`; index `(lft, rgt)`                                                                                                                                             | Tag tree as a nested set                                                                                    |
| `tags_table_lock`                              | `version` PK                                                                                                                                                                                        | Single row updated at the start of each tag-tree change to serialise them (`tag.prisma.repository.impl.ts`) |
| `exam_tags` / `section_tags` / `question_tags` | composite PK `(<owner>_id, tag_id)`                                                                                                                                                                 | Tag assignments                                                                                             |

Plus `outbox_events` and `inbox_events` ([messaging.md](../../docs/architecture/messaging.md#tables)). Redis holds only BullMQ's keys for queue `exam`.

## Configuration

Read in `src/configs/config.ts`; local values in [`.env.example`](.env.example).

- `NODE_ENV`, `HOST`, `PORT` (gRPC), `HEALTH_PORT`.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional `POSTGRES_URL`).
- `REDIS_HOST`, `REDIS_PORT` (BullMQ).
- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS`.
- `FILE_SERVICE_HOST`, `FILE_SERVICE_PORT` (optional `FILE_SERVICE_URL`).
- `CURSOR_SECRET`: signs pagination cursors.
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Running

```sh
pnpm exec nx run exam:prisma:generate
pnpm exec nx run exam:prisma:migrate -- --name <change>
pnpm exec nx run exam:prisma:seed     # sample IELTS/grammar exams and attempts (prisma/seed/)
pnpm exec nx run exam:serve
pnpm exec nx run exam:test
```

Also `prisma:push` and `prisma:migrate:reset`. Ports: gRPC 50053 locally (`.env.example`), 50050 in Docker; health 9102. Docker host access through `envoy-exam` on 8082. Needs Postgres, Redis, RabbitMQ and file-service; Writing scores need the AI scorer or [mock-ai-scorer](../mock-ai-scorer/README.md).

## More

- Flows (including the Writing round trip): [flows/exam.md](../../docs/architecture/flows/exam.md).
- Events: [messaging.md](../../docs/architecture/messaging.md).
