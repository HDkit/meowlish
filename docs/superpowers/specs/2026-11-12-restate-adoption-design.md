# Restate adoption: design

Status: proposal, **not approved and not implemented**. No Restate code exists in the repo. This document exists so the decision ("implement Restate repo-wide for every service", backlog C11) can be made on facts. The decision points are collected in section 12.

## 1. Intent

[Restate](https://docs.restate.dev) is a durable execution engine. Handlers run in our own processes, but every step they take (a side effect wrapped in `ctx.run`, a call to another handler, a timer, a wait for an external signal) is journaled by the Restate server. When a process dies or a step throws, Restate re-invokes the handler, replays the journal, and resumes at the step that did not finish. Retries, timers, and "wait for X, with a timeout" become library calls instead of tables, sweepers, and queues that we build by hand.

The question is which of our problems that actually solves, what it costs, and how it would live next to what we just built: transactional outbox + inbox, RabbitMQ with 5× exponential-backoff retries and dead-letter queues, and BullMQ jobs for periodic sweeps.

## 2. Where we are today

| Concern              | Mechanism today                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synchronous calls    | Gateway → services over gRPC. Requester-scoped checks in the owning service (exam creator-or-admin, live room owner-or-admin, file uploader on attach, resource `requesterId`/`privileged`).                                                                                                                                                                |
| Domain events        | `OutboxPublisher.add` inside the business transaction → relay (1 s poll, publisher confirms) → `eventbus` topic exchange → one queue per consumer.                                                                                                                                                                                                          |
| Consumer idempotency | `InboxService.claim(eventId, consumer)` in the handler's transaction.                                                                                                                                                                                                                                                                                       |
| Consumer retries     | `defineConsumerQueue(q)`: `<q>.retry.1..5` (1, 2, 4, 8, 16 s), then `<q>.dlq`. Replay by moving messages back.                                                                                                                                                                                                                                              |
| Periodic work        | BullMQ (Redis): file-service orphan cleanup, exam/auth `files.removed` publishers.                                                                                                                                                                                                                                                                          |
| Multi-step flows     | Ad hoc. Exam scoring after `EndAttempt` runs **in-process** (`AttemptSubmittedHandler`, CQRS event bus) after the commit and is not durable. AI writing scoring is a round trip over RabbitMQ (`exam.writing.submitted` → external scorer → `exam.writing.scored`). The sensitive-delete saga (hybrid authorization design §6.3) is designed but not built. |
| Observability        | OTLP to the Grafana LGTM stack; messaging dashboard (outbox lag, inbox duplicates, DLQ depth, consumer failures).                                                                                                                                                                                                                                           |

Two open backlog rows come straight from the "multi-step flow" gap:

- Scoring after `endAttempt` is not durable: process death or a `score()` failure loses `exam.attempt.scored` and `exam.writing.submitted`.
- `exam.attempt.scored` is sent once, at submit, before any writing feedback, so achievement score badges ignore writing points.

## 3. Restate in brief (what matters here)

- **Restate server**: a single binary (Docker image `docker.restate.dev/restatedev/restate`). Ports: **8080** ingress (HTTP calls into handlers), **9070** admin API + web UI, **5122** node control, including Prometheus `/metrics`. It stores journals and state in `/restate-data` (RocksDB plus its own log), so it is a stateful component that needs a volume and backups.
- **Service kinds**: _Service_ (stateless handlers), _Virtual Object_ (handlers keyed by an id with K/V state and one exclusive writer per key, a per-key lock), _Workflow_ (a `run` handler that executes exactly once per workflow id, plus shared handlers that signal it through durable promises).
- **Endpoints**: a service deployment is an HTTP server built with `restate.createEndpointHandler` (`@restatedev/restate-sdk`). It speaks HTTP/2 (h2c) by default, and HTTP/1.1 when registered with `--use-http1.1`. Node 24, which this repo uses, is supported.
- **Registration**: the server must be told about each deployment (`restate deployments register http://exam:9080`, or `POST :9070/deployments`). It discovers the handlers and pins every new invocation to that deployment revision.
- **Invocation**: over HTTP ingress (`POST :8080/restate/call/<Service>/[<key>/]<handler>`, or `/restate/send/…` for fire-and-forget; servers ≤ 1.6 use `/<Service>/<handler>[/send]`; optional `idempotency-key` header), from another handler (typed clients, `ctx.serviceSendClient`, delayed sends), or from **Kafka** subscriptions. There is **no RabbitMQ ingress**. Other sources need a custom integration (the Integration API client is Java-only today) or a small consumer that calls the ingress.
- **Retries**: every failed attempt is retried with exponential backoff. The retry policy is configurable (max attempts, then pause or kill). `TerminalError` stops retrying and fails the invocation.
- **Introspection**: the UI and `restate invocations …` / SQL over `sys_invocation`, `sys_journal` show every running, backing-off, suspended or paused invocation with its journal.
- **Determinism rule**: code outside `ctx.run` must be deterministic on replay. `Date.now()`, `Math.random()`, uuids and I/O go through `ctx.run`, `ctx.date`, `ctx.rand`.
- **Not transactional with Postgres**: `ctx.run(() => prisma…)` executes, then journals the result. A crash in between runs the step again, so database steps must still be idempotent (upserts, version checks, natural keys).

## 4. Candidate workloads

| #   | Workload                                                                                           | Fit                                                                    | Proposal                                  |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| W1  | Exam scoring after `EndAttempt`, including AI writing round trip                                   | **Strong**: multi-step, waits on an external result, needs a timeout   | **Pilot**                                 |
| W2  | Sensitive delete saga (hybrid authorization §6.3)                                                  | **Strong**: two-phase with compensation, status polling, retry sweeper | Phase 2, if W1 succeeds                   |
| W3  | File cleanup (orphan sweep, `files.removed` publishing)                                            | Weak: periodic batch sweeps, already correct (row lock, Task 14)       | Keep BullMQ                               |
| W4  | Domain event fan-out (`user.login`, `attempt.submitted`, `badge.earned`, authz ownership events …) | **Poor**: pub/sub to N consumers is a broker's job                     | Keep outbox + RabbitMQ                    |
| W5  | Consumer retries and DLQs                                                                          | Only inside Restate-hosted flows                                       | Keep `<q>.retry.N` for RabbitMQ consumers |
| W6  | Plain request/response gRPC (most of the API)                                                      | None: nothing durable to resume                                        | Keep gRPC                                 |

### W1: exam attempt scoring (pilot)

Today: `EndAttemptHandler` commits the attempt and writes `exam.attempt.submitted` to the outbox. The in-process `AttemptSubmittedHandler` then scores, saves, and writes `exam.attempt.scored` and `exam.writing.submitted`. If the process dies between the two transactions, or `score()` throws past its conflict retries, the attempt stays unscored forever. When `exam.writing.scored` arrives later, the stored score is recomputed, but `exam.attempt.scored` is never re-sent.

With Restate, one **Workflow** `AttemptScoring`, keyed by `attemptId`:

```ts
// apps/exam/src/infra/restate/attempt-scoring.workflow.ts (sketch)
export const attemptScoring = (deps: ScoringDeps) =>
	restate.workflow({
		name: 'AttemptScoring',
		handlers: {
			run: async (ctx: restate.WorkflowContext, input: { attemptId: string }) => {
				// 1. Objective score; idempotent (attempt version + recompute from answers).
				const writings = await ctx.run('score-objective', () =>
					deps.scoreObjective(input.attemptId),
				);
				// 2. Ask the AI scorer for each writing answer (bare event, outbox).
				await ctx.run('request-writing', () => deps.requestWritingScores(input.attemptId));
				// 3. Wait for every writing result, at most 24 h.
				await RestatePromise.all(
					writings.map(w => ctx.promise<WritingResult>(`writing:${w.answerId}`).get()),
				).orTimeout({ hours: 24 });
				// 4. Final score, then exam.attempt.scored exactly once (outbox).
				await ctx.run('finalize', () => deps.finalizeAndPublishScored(input.attemptId));
			},
			// Called by the exam.writing.scored consumer.
			writingScored: async (ctx: restate.WorkflowSharedContext, r: WritingResult) => {
				await ctx.run('save-feedback', () => deps.saveFeedback(r));
				await ctx.promise<WritingResult>(`writing:${r.answerId}`).resolve(r);
			},
		},
	});
```

A timeout in step 3 finalizes with the writing answers unscored, the same rule the UI already shows for pending feedback. Which answers timed out is visible in the journal.

What this buys:

- Both backlog rows close: scoring is durable, and `exam.attempt.scored` is published once, after writing points are in. Achievement needs no `rescored` event and no per-attempt upsert.
- A stuck attempt can be found in the Restate UI (`AttemptScoring/<attemptId>`) rather than by reading logs.

How the workflow starts (decision D3):

- **Bridge (recommended):** exam consumes its own `exam.attempt.submitted` from RabbitMQ (new queue `exam.events.attempt.submitted`, inbox + `deadLetterQueue`) and calls the ingress `POST /restate/send/AttemptScoring/<attemptId>/run`. A workflow id runs once, so a redelivery or a replayed DLQ message is a no-op at Restate even without the inbox. The commit → event step stays atomic (outbox), and nothing new is needed in `EndAttempt`.
- **Direct:** `EndAttemptHandler` calls the ingress after its commit. That has the same lost-step window we have today unless a sweeper re-submits "submitted but unscored" attempts. Rejected.

The cheaper non-Restate fix, already in the backlog, is to make the same RabbitMQ consumer score directly. That closes the durability row but not the "scored before writing points" row. The difference between the two options is the Restate pilot's actual value, so measure the pilot against it.

### W2: sensitive delete saga

Hybrid authorization §6.3 specifies: mark tuples `pending_delete`, write a `sensitive_operation` row, publish `authz.resource.deleted`, wait for `authz.operation.applied|failed`, retry unconfirmed operations every 5 minutes up to 5 times, compensate by restoring tuples, and answer `204` if done within 5 s, else `202 { operationId }` + `GET /authz/operations/:id`.

That is a hand-written workflow engine. As a Restate Workflow `DeleteResource`, keyed by `<objectType>:<objectId>`:

1. `ctx.run('lock')`: authorization marks tuples `pending_delete` (its own DB, idempotent).
2. `ctx.run('apply')`: call the owning service's internal delete RPC (gRPC, idempotent by id). Retried by Restate with backoff; `TerminalError` on a non-retryable failure (e.g. constraint).
3. On success, `ctx.run('finalize')` deletes the tuples. On a terminal failure, `ctx.run('compensate')` restores them.
4. The gateway starts it via ingress with `idempotency-key: <objectType>:<objectId>`, waits up to 5 s on the workflow output (attach), and otherwise returns `202` with the workflow id. The status route reads the workflow's output or state.

This removes the `sensitive_operation` table, the 5-minute retry sweeper, the `authz.operation.applied/failed` events and their queues, and the stale-operation alert. Ownership sync (`authz.ownership.*`, snapshots) stays on outbox + RabbitMQ, because it is fan-out (W4).

The decision here comes before the hybrid authorization build starts: build §6.3 on Restate, or as specified. Doing both wastes the work.

### W3: file cleanup

Orphan cleanup is a periodic sweep over many rows that is now correct (`FOR UPDATE SKIP LOCKED`, objects deleted before rows, Task 14). Restate has no cron. A self-rescheduling delayed send would replace a BullMQ repeatable job with something less familiar and add nothing. Keep BullMQ. Revisit only if per-file deletion grows multiple external steps, such as a CDN purge.

### W4/W5: domain events stay on outbox + inbox + RabbitMQ

- Restate is not a broker. Sending to N subscribers from a handler means the publisher must know every subscriber. Today a new consumer only binds a queue.
- The outbox is still required for atomicity. Restate does not join the Postgres transaction, so "commit the row, then call Restate" has the same dual-write gap the outbox closed.
- The inbox is still required: `ctx.run` steps that write to Postgres can run twice.
- RabbitMQ retries/DLQ keep serving the RabbitMQ consumers. Inside Restate-hosted flows, Restate's retry policy replaces them.

"Repo-wide for every service" would mean replacing the outbox relay and every consumer with Restate handlers plus a Kafka cluster (the only native event ingress) or one-way sends from every publisher. That removes the broker but couples publishers to consumers, introduces Kafka as well as Restate, and throws away infrastructure built and tested in the last two weeks. It solves no open problem that W1 and W2 don't already solve.

## 5. Hosting handlers in the NestJS services

A new lib `@server/restate`:

- `RestateModule.forRootAsync({ inject: [ConfigService], … })` with a `RESTATE_ENDPOINT_PORT` (e.g. 9080 internal), `RESTATE_INGRESS_URL` and `RESTATE_ADMIN_URL`.
- Services are defined as factories that close over Nest providers (`attemptScoring(deps)` above). The module resolves them after `app.init()` and serves them with `restate.createEndpointHandler({ services })` on `node:http2.createServer` (h2c) next to the gRPC server and the health listener. The `main.ts` → `bootstrap.ts` split stays. `bootstrap.ts` starts one more listener.
- `RestateIngressClient` (`@restatedev/restate-sdk-clients`) for gRPC controllers and RabbitMQ bridge consumers that start or signal workflows.
- Handlers keep the DDD layering: the Restate definition is an infra adapter. The steps call application services or command handlers. Domain code never sees `ctx`.
- Prisma/CLS: each `ctx.run` that touches the DB runs in its own `@Transactional()` application-service method, so the `TransactionHost` context exists. CLS has no request scope inside a Restate handler, so the adapter opens one per step.
- Logging: use `ctx.console` (replay-aware) in handler bodies, or the Winston logger only inside `ctx.run`, so replays don't duplicate log lines.
- Request identity: configure the endpoint with the server's request-identity public key (`identityKeys`), so only our Restate server can invoke handlers. The endpoint port is never published to the host.
- Lint/knip: the SDK goes in the root `package.json` at an exact version, and in the lib's `package.json` as a matching range.

## 6. Deployment (docker compose)

New file `docker/docker-compose.restate.yaml`, included from `docker/docker-compose.yaml`:

- `restate` service: image `docker.restate.dev/restatedev/restate:<exact version>` (pinned, like every other image), `init: true`, volume `restate-data:/restate-data`, network `api-network`.
- Ports: ingress 8080 stays **internal**, because the host port 8080 is already the gateway Envoy (`ENVOY_GATEWAY_PORT`). Publish only the admin/UI as `RESTATE_ADMIN_PORT` (default 9070) for local development. 5122 stays internal (lgtm scrapes it on the network).
- `RESTATE_TRACING_ENDPOINT=http://lgtm:4317` (OTLP/gRPC) so invocation spans land in Tempo next to the app spans.
- Healthcheck on the admin `/health`. Services that host handlers `depends_on: restate: service_healthy` only for the registration step, not to boot.
- `restate-register`: a one-shot container (`restate-cli` image) that runs after the hosting services are healthy, `restate deployments register http://exam:9080 --yes` (and later `http://authorization:9080`). Re-running it on every deploy registers the new revision. In local development `pnpm restate:register` does the same against `localhost`.
- Single node. A cluster (3 nodes, replicated log) is a production decision (D6).

## 7. Versioning and deploys (the sharp edge)

Restate pins an in-flight invocation to the deployment revision that started it, and replays it against the same handler code. Docker compose replaces a container **in place at the same URL**. If a deploy changes a workflow's step order while invocations are suspended (W1 waits up to 24 h for writing feedback), they replay against the new code and fail with a journal mismatch.

Options (D4):

- **Compatible changes only**, enforced in review: new steps go at the end, existing `ctx.run` names never change, removed steps stay as no-ops until no old invocation is left. This is the cheapest option and fits the pilot.
- **Versioned endpoints**: each release registers a new URL (`http://exam-v42:9080`) and keeps the old container until its invocations drain. This is correct, but compose does not handle it well. It belongs with a real orchestrator.
- **Version field in the input**: `run` branches on `input.v`. Use it only as a stopgap.

## 8. Observability

- **Restate UI** (`:9070`): invocations by status, journals, retries, pause/resume/cancel, and state. The runbook entry for "attempt never scored" becomes "open `AttemptScoring/<id>`".
- **Metrics**: add `docker/observability/otelcol-restate.yaml` (same pattern as `otelcol-rabbitmq.yaml`) to scrape `restate:5122/metrics` every 15 s. A "Restate" dashboard covers ingress request rate and latency, invocations by status (running / backing-off / suspended / paused), and journal and storage size.
- **Alerts** (`docker/observability/alerting/restate.yaml`): `RestateMissing` (no samples for 2 minutes), `RestateInvocationsPaused` (> 0: a flow exhausted its retries, the counterpart of `DeadLetters`), and `RestateBackingOffStuck` (an invocation backing off for > 15 min). Paused-invocation counts come from the metrics where they exist, otherwise from a small exporter that queries `sys_invocation` over the admin SQL API. Confirm which during the pilot.
- **Traces**: server spans via `RESTATE_TRACING_ENDPOINT`. Handler spans come from our existing OpenTelemetry SDK, because the endpoint is a normal HTTP server in the same process. Check that the trace context propagates from gateway → gRPC → ingress → handler.
- The `deadLetterQueue` metrics stay for the RabbitMQ side, including the bridge consumer.

## 9. Failure modes

| Failure                                                    | Effect                                                                               | Mitigation                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restate server down                                        | Ingress calls fail. Running flows stop, and resume when it is back.                  | The bridge consumer throws, so RabbitMQ retries 5× over ~31 s, then dead-letters. For an outage longer than that, replay `exam.events.attempt.submitted.dlq` (the workflow id makes the replay safe), or give the bridge queue a longer schedule (`defineConsumerQueue(q, { maxAttempts, maxDelayMs })`). |
| `restate-data` volume lost                                 | In-flight workflows, their state, and registrations are gone.                        | Back up the volume. Every W1/W2 flow is reconstructible from domain rows (attempt `SUBMITTED` with no final score, tuples `pending_delete`), so a sweep can re-submit them with the same workflow id.                                                                                                     |
| Handler step throws a retryable error forever              | Infinite backoff (default)                                                           | Set a retry policy (max attempts, then **pause**) and alert on paused invocations. Resume from the UI after the fix.                                                                                                                                                                                      |
| `ctx.run` committed in Postgres, crashed before journaling | The step runs again                                                                  | Every DB step is idempotent: attempt version checks, upserts, and outbox events deduplicated downstream by the inbox.                                                                                                                                                                                     |
| Non-deterministic code outside `ctx.run`                   | Journal mismatch on replay, invocation stuck                                         | Lint rule or review checklist: no `Date`/`random`/uuid/I/O outside `ctx.run`. Test with the SDK test harness, which replays on every step.                                                                                                                                                                |
| Deploy changes handler code under in-flight invocations    | Journal mismatch                                                                     | Section 7.                                                                                                                                                                                                                                                                                                |
| Deployment not registered                                  | Ingress returns "service not found". The bridge consumer retries, then dead-letters. | `restate-register` on every deploy, plus a readiness check that the exam endpoint is registered at the current revision.                                                                                                                                                                                  |
| Ingress reachable from outside                             | Anyone could start or signal workflows                                               | Ingress and endpoints are not published. Endpoints verify the request identity key.                                                                                                                                                                                                                       |

## 10. Costs and trade-offs

For:

- Durable multi-step flows with timers and "wait for an external result" become a few lines instead of tables, sweepers, and correlation logic (W1, W2).
- The UI makes stuck flows visible and operable (resume, cancel), which the in-process scoring has no equivalent of.
- Idempotency per workflow id comes free.

Against:

- One more stateful infrastructure component: backups, upgrades, an image to pin, a single node in compose, and a cluster decision for production.
- A new programming model (determinism, journaled steps, compatible-change discipline on deploy) for every contributor and coding agent. AGENTS.md would need a section on it.
- Glue we have to own: there is no official NestJS integration, so DI, CLS/transactions and logging inside handlers are our code.
- Two ways to do asynchronous work (RabbitMQ consumers and Restate flows) need a clear rule for which to use. Proposed rule: one step reacting to an event → RabbitMQ consumer; several steps, waits, or compensation → Restate workflow.
- Licensing: the server is source-available (Business Source License); the SDKs are MIT. Self-hosting for this app is fine. Check the terms before offering it as a service.
- Scope creep risk: "repo-wide" would replace infrastructure that works and is monitored, without a defect that motivates it.

## 11. Migration order

0. **Decide** (section 12). If Restate is declined, fix W1 with the inbox consumer (backlog row) and build W2 as specified.
1. **Infrastructure spike** (no product behaviour): `docker-compose.restate.yaml`, `@server/restate` with a `Ping` service in exam, registration, metrics scrape and dashboard, trace propagation check. Exit: `ServiceMissing`-style alert works, and a redeploy of exam keeps the registration current.
2. **Pilot W1** behind `EXAM_SCORING_ENGINE=inprocess|restate` (default `inprocess`): the bridge consumer, the `AttemptScoring` workflow, and the writing-scored consumer signalling the workflow when the engine is `restate`. Run the existing scoring tests against both paths, plus SDK test-harness tests for replay. Exit criteria: two weeks with no paused invocation that wasn't a real bug, and no lost attempts. Then delete `AttemptSubmittedHandler` and close both backlog rows. Rollback: flip the flag. Attempts already in Restate finish there.
3. **W2**, if the pilot meets its exit criteria: build hybrid authorization §6.3 as the `DeleteResource` workflow hosted in authorization.
4. **Re-evaluate** with real numbers before anything else moves. Candidates would be new multi-step features (scheduled live-room reminders, external integrations with callbacks), not existing consumers.

Not planned: moving domain events, the outbox/inbox, RabbitMQ retries, BullMQ sweeps, or synchronous gRPC to Restate.

## 12. Recommendation and decisions for you

**Recommendation: adopt Restate for multi-step workflows only, and do not migrate repo-wide.** Pilot it on exam attempt scoring (W1), where it fixes two open backlog rows that a plain consumer fixes only one of. Then build the sensitive-delete saga (W2) on it instead of a hand-made state machine. Keep transactional outbox + inbox + RabbitMQ for domain events and fan-out, and keep BullMQ for periodic sweeps. Restate complements that stack; it does not replace it.

Decision points:

- **D1, scope**: workflows only (recommended), or repo-wide (replace RabbitMQ consumers too, which needs Kafka or publisher-side sends; section 4).
- **D2, pilot**: W1 attempt scoring (recommended), or W2 first.
- **D3, how flows start**: RabbitMQ bridge consumer from the outbox event (recommended), or a direct ingress call plus a sweeper.
- **D4, deploy safety**: compatible changes only (recommended for compose), or versioned endpoints.
- **D5, hybrid authorization §6.3**: build on Restate (W2) or as specified. Decide before that work starts.
- **D6, production topology**: single node with volume backups, or a 3-node cluster. Also decide whether the admin UI is exposed and behind what.
- **D7, writing timeout**: how long W1 waits for AI feedback before finalizing (24 h proposed).
