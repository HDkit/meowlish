# Messaging Outbox/Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**

- Every RabbitMQ event is written to an outbox in the same database transaction as the change that caused it.
- A relay publishes it with confirms.
- Every consumer is idempotent through an inbox, and failures dead-letter to an explicitly declared DLQ.

This is rollout step 2 of the hybrid authorization design, and closes backlog C2 and C11 plus the duplicate parts of C1 and C13.

**Architecture:**

- A new `@server/messaging` lib provides:
  - the envelope type;
  - `OutboxPublisher`, which writes through the active `@nestjs-cls/transactional` transaction;
  - `OutboxRelay`, which polls with `FOR UPDATE SKIP LOCKED`, publishes on the `pub` connection, and records failures with back-off;
  - `InboxService`, which claims an event id per consumer inside the handler's transaction;
  - DLQ queue options;
  - metrics through `@server/telemetry`.
- Each service copies two Prisma models into its own schema, because every service has its own Prisma client.

**Tech Stack:** NestJS 11, `@golevelup/nestjs-rabbitmq` 7 (publish promises resolve on broker confirm, because `amqp-connection-manager` channels confirm by default), Prisma 6 with `@nestjs-cls/transactional`, PostgreSQL, Jest.

**Spec:** `docs/superpowers/specs/2026-11-12-hybrid-authorization-design.md` (§7; rollout step 2 in §9)

## Global Constraints

- **Envelope:** `{ id: string /* uuid v4 */, type: string /* = routing key */, occurredAt: string /* ISO 8601 */, payload: T }`. It's published as the message body, with AMQP `messageId = id`.
- **Relay:**
  - polls every **1 s**, batch **100**, oldest first;
  - publishes to exchange `eventbus` on connection `pub`;
  - on failure sets `attempts += 1`, `next_attempt_at = now + min(2^attempts, 300) s`, `last_error`, and stops the batch.
- **Cleanup:** published outbox rows and inbox rows older than **7 days** are deleted **daily**.
- **Dead letters:** exchange `eventbus.dlx` (topic, durable). Each consumer queue `<q>` gets `deadLetterExchange: 'eventbus.dlx'` and `deadLetterRoutingKey: '<q>'`, plus a durable queue `<q>.dlq` bound to `eventbus.dlx` with routing key `<q>`.
- **Consumer failure semantics:** a handler that throws is nacked without requeue, so it dead-letters. Handlers must not swallow errors. The exception is the exam writing-scored handler, which keeps its own retry queues and dead-letters only after exhausting them.
- **Rollout compatibility:**
  - Consumers accept both the envelope and a legacy bare payload. A message is an envelope when it has string `id`, string `type` and an `object` `payload`.
  - Legacy messages skip inbox dedup.
  - The legacy path is removed in the last task.
- **Inbox dedup key:** `(event id, consumer name)`. The consumer name equals the queue name.
- **Metrics names** (spec §8):
  - `outbox_pending_events`, `outbox_oldest_pending_age_seconds` and `outbox_publish_errors_total`, labelled `service`;
  - `inbox_duplicates_total` and `consumer_failures_total`, labelled `service` and `consumer`.

## Review Focus

- **The relay starts on two replicas of the same service.** Each event must still be published exactly once per successful publish, with no double send from overlapping batches. _Task 3: `two concurrent relays never publish the same row` (uses `SKIP LOCKED` against the real Postgres in the dev compose; marked as an integration test)._
- **The broker accepts the publish but the process dies before `published_at` is set.** The event is re-sent, and the consumer's inbox drops the duplicate. _Task 4: `claim returns false for an already processed event`. Task 7: one migrated consumer's spec asserts the handler body runs once for two deliveries of the same envelope._
- **`OutboxPublisher.add` is called outside a transaction** (a developer forgets `@Transactional()`). It must throw immediately rather than silently committing the event without the data. _Task 2: `add throws when no transaction is active`._
- **A poison message makes the handler throw every time.** It must land in `<q>.dlq` after one delivery, not loop. _Task 5: `deadLetterQueue returns options binding <q>.dlq`, plus the manual check in Task 8._
- **RabbitMQ is down for minutes.** The outbox backlog grows, and the relay recovers by itself with capped back-off, no restart needed. _Task 3: `backs off after a publish failure and retries later`._

---

### Task 1: `@server/messaging` lib, envelope and `unwrapEvent`

**Files:**

- Create: `libs/messaging/`, via `pnpm exec nx g @nx/js:lib libs/messaging --importPath=@server/messaging --bundler=tsc --unitTestRunner=jest --linter=eslint`. Rename the config to `jest.config.ts` with `export default`.
- Create: `libs/messaging/src/lib/envelope.ts`
- Test: `libs/messaging/src/lib/envelope.spec.ts`

**Interfaces:**

- Produces:
  - `interface EventEnvelope<T> { id: string; type: string; occurredAt: string; payload: T }`
  - `createEnvelope<T>(type: string, payload: T, now?: Date): EventEnvelope<T>`, which uses `randomUUID()`.
  - `unwrapEvent<T>(message: unknown): { id?: string; type?: string; payload: T }`. For an envelope it returns its fields. For anything else it returns `{ payload: message }`.

- [ ] **Step 1: Write the failing tests:**
  - `createEnvelope sets a uuid id, the type and an ISO timestamp`
  - `unwrapEvent returns envelope fields`
  - `unwrapEvent treats a bare payload as legacy`: `unwrapEvent({ uid: 'u1' })` deep-equals `{ payload: { uid: 'u1' } }`
  - `unwrapEvent treats an object with a non-string id as legacy`
- [ ] **Step 2: Run** `pnpm exec nx run messaging:test --skip-nx-cache`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests, then lint with `--fix`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(messaging): add event envelope`.

### Task 2: `OutboxPublisher` + shared Prisma models

**Files:**

- Create: `libs/messaging/src/lib/outbox.publisher.ts`
- Create: `libs/messaging/prisma/messaging.prisma`, the canonical model text that services copy:
  ```prisma
  model OutboxEvent {
    id            String    @id @db.Uuid
    routingKey    String    @map("routing_key")
    payload       Json
    createdAt     DateTime  @default(now()) @map("created_at")
    publishedAt   DateTime? @map("published_at")
    attempts      Int       @default(0)
    nextAttemptAt DateTime  @default(now()) @map("next_attempt_at")
    lastError     String?   @map("last_error")

    @@index([publishedAt, nextAttemptAt, createdAt])
    @@map("outbox_events")
  }

  model InboxEvent {
    id          String   @db.Uuid
    consumer    String
    processedAt DateTime @default(now()) @map("processed_at")

    @@id([id, consumer])
    @@index([processedAt])
    @@map("inbox_events")
  }
  ```
- Test: `libs/messaging/src/lib/outbox.publisher.spec.ts`

**Interfaces:**

- Consumes: `createEnvelope` (Task 1).
- Produces:
  - `@Injectable() class OutboxPublisher { add<T>(routingKey: string, payload: T): Promise<EventEnvelope<T>> }`.
  - It's injected with `TransactionHost` (generic over any Prisma adapter). It writes `txHost.tx.outboxEvent.create({ data: { id, routingKey, payload: envelope } })`, storing the **whole envelope** in `payload`.
  - It throws `Error('OutboxPublisher.add must run inside a transaction')` when `!txHost.isTransactionActive()`.

- [ ] **Step 1: Write the failing tests,** using a fake `txHost` `{ isTransactionActive: () => boolean, tx: { outboxEvent: { create: jest.fn() } } }`:
  - `add writes the envelope to the outbox`: `create` is called with `routingKey: 'exam.attempt.scored'` and `payload.type: 'exam.attempt.scored'`, and the returned envelope's id equals the row id.
  - `add throws when no transaction is active`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(messaging): add transactional OutboxPublisher`.

### Task 3: `OutboxRelay` with back-off, cleanup and metrics

**Files:**

- Create: `libs/messaging/src/lib/outbox.relay.ts`
- Test: `libs/messaging/src/lib/outbox.relay.spec.ts` and `libs/messaging/src/lib/outbox.relay.int-spec.ts` (integration; it runs only when `MESSAGING_IT_DATABASE_URL` is set)

**Interfaces:**

- Consumes: `getMeter()` from `@server/telemetry`.
- Produces:
  - `@Injectable() class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy`. Its constructor takes `(prisma /* DATABASE_SERVICE */, amqp: AmqpConnectionManager, options: { serviceName: string; connectionName: string })`.
  - `relayOnce(): Promise<number>` returns the number published. It runs one Prisma `$transaction`:
    1. `SELECT id, routing_key, payload, attempts FROM outbox_events WHERE published_at IS NULL AND next_attempt_at <= now() ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`
    2. for each row, `await connection.publish('eventbus', routing_key, payload, { persistent: true, messageId: id })`, then set `published_at = now()`
    3. on the first failure, update that row's back-off fields and stop
  - `cleanup(): Promise<void>` deletes `outbox_events` with `published_at < now() - 7 days` and `inbox_events` with `processed_at < now() - 7 days`.
  - Timers: `relayOnce` every 1000 ms, guarded so runs never overlap; `cleanup` every 24 h.
  - Metrics: the observable gauges `outbox_pending_events` and `outbox_oldest_pending_age_seconds`, from one `count(*)`/`min(created_at)` query per collection, and the counter `outbox_publish_errors_total`.

- [ ] **Step 1: Write the failing unit tests,** with a fake prisma exposing `$transaction(fn)` and `$queryRaw`/`$executeRaw`, and a fake connection's `publish`:
  - `publishes pending rows oldest first and marks them published`
  - `backs off after a publish failure and retries later`: the second row fails and the third is not attempted. The failing row is updated with `attempts = 1` and `next_attempt_at` about now + 2 s. On a later call with the clock advanced past that, it's retried.
  - `caps back-off at 300 seconds`: `attempts = 20` gives next_attempt_at ≤ now + 300 s.
  - `does not overlap runs`: two concurrent `relayOnce()` calls on one instance run the query once.
  - `cleanup deletes rows older than 7 days`
- [ ] **Step 2: Write the integration test** `two concurrent relays never publish the same row`. Against a real Postgres (`MESSAGING_IT_DATABASE_URL`): create the table with the model's SQL, insert 50 rows, run two relays concurrently with a fake publish that records ids, and expect 50 unique ids recorded once each.
- [ ] **Step 3: Run** `pnpm exec nx run messaging:test --skip-nx-cache`. Expected: FAIL. The integration test is skipped without the env var.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run the unit tests,** then the integration test:
  ```
  MESSAGING_IT_DATABASE_URL=postgresql://<user>:<pass>@localhost:5433/postgres pnpm exec nx run messaging:test --skip-nx-cache
  ```
  Expected: PASS, including the integration test.
- [ ] **Step 6: Commit** `feat(messaging): add outbox relay with back-off and cleanup`.

### Task 4: `InboxService`

**Files:**

- Create: `libs/messaging/src/lib/inbox.service.ts`
- Test: `libs/messaging/src/lib/inbox.service.spec.ts`

**Interfaces:**

- Consumes: `unwrapEvent` (Task 1).
- Produces:
  - `@Injectable() class InboxService { claim(eventId: string | undefined, consumer: string): Promise<boolean> }`. Callers must be inside a transaction.
    - It returns `true` for a legacy message (`eventId` undefined).
    - Otherwise it inserts `inboxEvent { id, consumer }` and returns `true`, or returns `false` on Prisma `P2002`, incrementing `inbox_duplicates_total`.
    - It throws when no transaction is active.

- [ ] **Step 1: Write the failing tests:**
  - `claim inserts and returns true for a new event`
  - `claim returns false for an already processed event` (the fake create rejects with `{ code: 'P2002' }`)
  - `claim returns true without writing for legacy messages`
  - `claim throws outside a transaction`
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(messaging): add idempotent inbox`.

### Task 5: `MessagingModule` and dead-letter helpers

**Files:**

- Create: `libs/messaging/src/lib/messaging.module.ts` and `libs/messaging/src/lib/dead-letter.ts`
- Modify: `libs/utils/src/configs/rmq.config.ts`: add `{ name: 'eventbus.dlx', type: 'topic', options: { durable: true } }` to `defaultRmqExchanges`.
- Test: `libs/messaging/src/lib/dead-letter.spec.ts`

**Interfaces:**

- Produces:
  - `MessagingModule.forRoot(options: { serviceName: string; prismaToken: string | symbol; connectionName?: string /* default 'pub' */; relay?: boolean /* default true */ }): DynamicModule`. It provides and exports `OutboxPublisher` and `InboxService`, and provides `OutboxRelay` when `relay` is true.
  - `deadLetterQueue(queue: string): { queue: string; queueOptions: { durable: true; deadLetterExchange: 'eventbus.dlx'; deadLetterRoutingKey: string } }`, to spread into `@RabbitSubscribe({...})`.
  - `dlqQueueConfig(queue: string)` returns a `RabbitMQConfig['queues'][number]` declaring `<queue>.dlq` bound to `eventbus.dlx` with routing key `<queue>`. Each app adds one per consumer queue to its `rmq.sub.config.ts`.

- [ ] **Step 1: Write the failing tests:**
  - `deadLetterQueue returns options binding <q>.dlq`: `deadLetterQueue('notification.events.badge.earned')` deep-equals the shape above with `deadLetterRoutingKey: 'notification.events.badge.earned'`.
  - `dlqQueueConfig names the queue <q>.dlq and binds it to eventbus.dlx`.
- [ ] **Step 2: Run** the tests, then implement, then run them again. Expected: FAIL, then PASS.
- [ ] **Step 3: Commit** `feat(messaging): MessagingModule and dead-letter helpers`.

### Task 6: Add the models to every service schema

**Files:**

- Create: `apps/<svc>/prisma/schema/messaging.prisma` (a copy of Task 2's models) for `auth`, `exam`, `live`, `resource`, `achievement`, `file-service`, `notification` and `authorization`.
- Migrations:
  - Services **with** `prisma/migrations` (`auth`, `exam`, `achievement`, `file-service`): `pnpm exec nx run <svc>:prisma:migrate -- --name add_outbox_inbox`, then commit the generated migration.
  - Services **without** migrations (`authorization`, `live`, `notification`, `resource`) keep using `db push` through `pnpm db:setup`.
- Modify: each service module: `MessagingModule.forRoot({ serviceName: '<svc>', prismaToken: DATABASE_SERVICE, relay: <true for publishers: auth, exam, live, resource, authorization; false for consumer-only apps> })`.

- [ ] **Step 1: Copy the models and generate:** `pnpm exec nx run-many -t prisma:generate`. Expected: success.
- [ ] **Step 2: Migrate:** start the infra compose, run the four `prisma:migrate` commands, then `pnpm db:setup`. Expected: `outbox_events` and `inbox_events` exist in every service database (`\dt` in psql).
- [ ] **Step 3: Verify:** `pnpm exec nx run-many -t lint test build`. Expected: success.
- [ ] **Step 4: Commit** `feat: add outbox/inbox tables to every service`.

### Task 7: Migrate publishers and consumers

**Publishers.** Replace `amqpConnection.publish('eventbus', key, payload, …)` with `await this.outbox.add(key, payload)` inside the same `@Transactional()` method that writes the data. Delete any try/catch that only logged publish failures.

| File                                                                      | Notes                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/auth/src/app/commands/handlers/google-register-or-login.handler.ts` |                                                                                                                                                                         |
| `apps/auth/src/app/commands/handlers/mail-login.handler.ts`               |                                                                                                                                                                         |
| `apps/auth/src/app/events/publisher/file-added.publisher.ts`              |                                                                                                                                                                         |
| `apps/auth/src/app/events/publisher/files-removed.publisher.ts`           | fixes backlog C11: files were removed before publishing                                                                                                                 |
| `apps/auth/src/app/events/publisher/identity-locked.publisher.ts`         |                                                                                                                                                                         |
| `apps/auth/src/app/events/publisher/logged-in.publisher.ts`               |                                                                                                                                                                         |
| `apps/exam/src/app/commands/handlers/management/create-exam.handler.ts`   |                                                                                                                                                                         |
| `apps/exam/src/app/commands/handlers/management/delete-exam.handler.ts`   |                                                                                                                                                                         |
| `apps/exam/src/app/events/publishers/attempt-scored.publisher.ts`         |                                                                                                                                                                         |
| `apps/exam/src/app/events/publishers/attempt-submitted.publisher.ts`      |                                                                                                                                                                         |
| `apps/exam/src/app/events/publishers/file-added.publisher.ts`             |                                                                                                                                                                         |
| `apps/exam/src/app/events/publishers/files-removed.publisher.ts`          |                                                                                                                                                                         |
| `apps/exam/src/app/events/publishers/writing-submitted.ts`                |                                                                                                                                                                         |
| `apps/live/src/app/services/chat.service.ts`                              | both `createRoom` and `removeRoom`                                                                                                                                      |
| `apps/resource/src/app/events/resource-events.publisher.ts`               | make each method call `outbox.add`; callers in `blog`, `flashcard`, `flashcard-list` and `report` services get `@Transactional()` on the methods that write and publish |

`exam/.../writing-scored.handler.ts` publishes to its own retry exchange `exam.retry`. It stays on a direct publish, because it's a retry mechanism, not a domain event.

**Consumers.** For each `@RabbitSubscribe` handler:

- spread `...deadLetterQueue('<its queue>')` in place of its current `queue`/`queueOptions`;
- add `@Transactional()`;
- start the body with `const { id, payload } = unwrapEvent<Payload>(message); if (!(await this.inbox.claim(id, '<queue>'))) return;`;
- remove the error-swallowing `try/catch`;
- add the matching `dlqQueueConfig` to the app's sub config.

The handlers:

- `apps/notification/src/app/events/handlers/{achievement-earned,report-status-changed}.handler.ts` (drops the undeclared `notification.dlx`; fixes C2)
- `apps/achievement/src/app/events/handlers/{attempt-submitted,attempt-scored,login}.handler.ts` (fixes the swallowing part of C1)
- `apps/file-service/src/app/events/handlers/{file-added,files-removed}.handler.ts`
- `apps/authorization/src/app/events/handlers/{exam-ownership,resource-ownership,live-ownership}.handler.ts`

- [ ] **Step 1: Write one consumer test first,** `apps/achievement/src/app/events/handlers/login.handler.spec.ts`. `processes an envelope once even when delivered twice`: call `handle(envelope)` twice with an `InboxService` fake whose second `claim` returns `false`, and assert the badge manager ran once. Run `pnpm exec nx run achievement:test`. Expected: FAIL.
- [ ] **Step 2: Migrate every publisher and consumer above.** Then run `grep -rn "amqpConnection.publish\|\.publish('eventbus'" apps --include='*.ts' | grep -v spec | grep -v writing-scored`. Expected: no output.
- [ ] **Step 3: Verify:** `pnpm exec nx run-many -t lint test build`. Expected: success, including the new spec.
- [ ] **Step 4: Manual end-to-end check** with the full compose:
  - Log in twice. The achievement login progress increases once per login, and `outbox_events` rows in `auth_db` get `published_at`.
  - Stop RabbitMQ for 30 s, log in, then start it again. The login event publishes within the back-off window.
  - Publish a malformed message to `achievement.events.login` from the RabbitMQ UI. It appears in `achievement.events.login.dlq`.
- [ ] **Step 5: Commit** `feat: route all events through the outbox and make consumers idempotent`.

### Task 8: Messaging dashboard, alerts, docs, legacy removal

**Files:**

- Create: `docker/observability/dashboards/messaging.json`, with panels for `outbox_pending_events`, `outbox_oldest_pending_age_seconds` and `outbox_publish_errors_total` per service, `consumer_failures_total`, `inbox_duplicates_total`, and the DLQ depth.
- Create: `docker/observability/otelcol-rabbitmq.yaml`, an extra collector config that scrapes RabbitMQ's Prometheus endpoint (`rabbitmq:15692`; enable the `rabbitmq_prometheus` plugin in `docker/docker-compose.db.yaml` if it's off). Mount it into `lgtm` by following otel-lgtm's custom-collector-config instructions.
- Create: `docker/observability/alerting/messaging.yaml`:
  - `OutboxStuck`: `outbox_oldest_pending_age_seconds > 60` for 1m;
  - `DeadLetters`: `rabbitmq_queue_messages{queue=~".*\\.dlq"} > 0`.
- Modify: `docs/operations/observability.md`: add a messaging section explaining each panel and alert, and how to inspect and replay a DLQ message (RabbitMQ UI: move it back to the original queue).
- Modify: `AGENTS.md`. Under "Service architecture": publish only through `OutboxPublisher.add` inside `@Transactional()`; consumers use `deadLetterQueue`, `unwrapEvent` and `InboxService.claim`, and must not swallow errors.
- Modify: `docs/backlog.md`. Delete C2, and C11's outbox and refcount publish parts. Narrow C1 to its P2025 race, and C13 to its streak and time-zone issues.
- Modify: `libs/messaging/src/lib/envelope.ts` and `inbox.service.ts`: **remove the legacy payload path.** `unwrapEvent` now throws on non-envelopes (which dead-letters them), and `claim` requires an id. Update their specs. Only do this after every service has been deployed with Task 7 and the queues have drained; check that the RabbitMQ UI shows 0 ready messages on every queue.

- [ ] **Step 1: Add the dashboard, collector config, alerts and docs.** Verify that Grafana shows the "Messaging" dashboard populated, and that a message in any `.dlq` fires `DeadLetters`.
- [ ] **Step 2: Remove the legacy path, and update the specs:** `unwrapEvent rejects a bare payload` and `claim rejects a missing id`. Run `pnpm exec nx run messaging:test`. Expected: PASS.
- [ ] **Step 3: Verify:** `pnpm exec nx run-many -t lint test build`. Expected: success.
- [ ] **Step 4: Commit** `feat(messaging): dashboard, alerts, docs; drop legacy payload support`.
