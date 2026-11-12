# Hybrid authorization with synced local snapshots: design

Status: agreed in conversation, pending final read-through. It supersedes the "retire the authorization service" direction in `docs/architecture/authorization.md`. That file will be rewritten from this design once this design is approved.

## 1. Intent

The authorization service becomes the **single source of truth for who may do what to which object**. Services keep making fast, local decisions for everyday operations, using a small local snapshot of that truth. **Irreversible operations** (deleting a resource) never rely on a local copy: they go through the authorization service first. Ownership only ever changes there.

Why: today ownership is copied ad hoc through fire-and-forget events.

- A lost event locks a creator out of their own resource permanently.
- Every `@ResourceAccess` check costs a network hop.
- Nothing shows when a service's view of ownership has drifted.

We want correctness on irreversible actions, speed on everything else, and visible sync health.

## 2. Goals, non-goals, anti-goals

**Goals**

- G1. The authorization service owns relationship data (ownership today) and is the only writer of it.
- G2. Each service keeps a **local authz snapshot**, limited to the resource types it serves, synced **incrementally by version**. It never downloads everything on every sync.
- G3. Deleting a top-level object goes **client → gateway → authorization service**. The owning service applies the outcome only by consuming an event from authorization.
- G4. Non-sensitive operations (reads, edits of non-sensitive fields) are authorized **locally** by the service's own policy over its snapshot plus the caller's JWT permissions. They are recorded in a local audit log.
- G5. After downtime a service **catches up automatically** before it reports ready.
- G6. No event is lost between a database write and its publication (**outbox**). Consumers handle duplicates (**inbox**).
- G7. **Observability:** a status for every service, plus a sync-health view for every service, both in one place.

**Non-goals**

- Ownership transfer (no feature needs it). The tuple model allows adding it later as one more sensitive operation.
- Groups and teams. The data model must be able to add them later (§4) without a redesign, but nothing about groups is built now.
- Restate or any new workflow engine (explicitly declined).
- Moving identity (login, tokens, roles) out of the auth service.
- High availability for the authorization service. If it's down, sensitive operations and new syncs stop. That's accepted.

**Anti-goals** (failure even if it "works")

- A service deletes a top-level object, or changes its owner, without authorization having committed that first.
- A service authorizes a top-level delete from its local snapshot.
- Sync drift that nobody can see: a lagging service must show up on a dashboard and raise an alert.
- Full re-downloads as the normal sync path.
- Services calling **other domain services** to make authorization decisions. The only fallback is the authorization service.

## 3. Concepts

| Term                        | Meaning                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Actor**                   | The caller: `{ id, permissions }` from the JWT the gateway forwards. Global capabilities only, no roles. (Same as the earlier Actor plan, tasks 1–3.)                                                                                                                                            |
| **Tuple**                   | One relationship fact: `(objectType, objectId, relation, subjectType, subjectId)`, e.g. `(flashCardList, 7, owner, user, alice)`. The only relation today is `owner`.                                                                                                                            |
| **Change log**              | An append-only log in authorization. Every tuple insert, update or delete gets a monotonically increasing `version`.                                                                                                                                                                             |
| **Snapshot**                | A service's local copy of the tuples for _its_ object types, plus the highest version it has applied.                                                                                                                                                                                            |
| **Sensitive operation**     | Deleting a **top-level owned object** (blog, flash-card list, report, exam, room). Deleting children inside an object you may edit (a card in a list, an exam section or question, a report file) is an ordinary edit: checked locally against the parent's owner and recorded in the audit log. |
| **Non-sensitive operation** | Reads, edits of ordinary fields, creation (see §6.1).                                                                                                                                                                                                                                            |

## 4. Authorization service data model

- `relation_tuple`: `id`, `object_type`, `object_id`, `relation`, `subject_type`, `subject_id`, `state ('active'|'pending_delete')`, `created_at`, `updated_at`. Unique on `(object_type, object_id, relation, subject_type, subject_id)`, and indexed by `(object_type, object_id)` and `(subject_type, subject_id)`. It replaces `resource_ownership`, which is migrated in: each row becomes `(type, id, owner, user, ownerId)`.
- `change_log`: `version BIGSERIAL PK`, `op ('upsert'|'delete')`, the tuple fields, `created_at`. It's written **in the same transaction** as the tuple change. Indexed by `(object_type, version)` so a pull can be filtered by object type.
- `outbox`: see §7. Authorization publishes through it like everyone else.
- `sensitive_operation`: `id`, `kind ('delete')`, `object_type`, `object_id`, `requested_by`, `state ('committed'|'applied'|'failed')`, `attempts`, `created_at`, `applied_at`. It tracks whether the owning service has applied a committed sensitive operation (§6.3).
- Change-log retention: keep at least **30 days**. A service whose `afterVersion` is older than the oldest retained version gets `resetRequired` and re-bootstraps from a snapshot export (§5).
- **Which objects get tuples (my call):** only **top-level owned objects**: `blog`, `flashCardList`, `report`, `exam`, `room`. Flash cards are owned via their list. Exam sections and questions via their exam. Report files via their report. The service policy resolves a child to its parent, using its own `listId` / `examId` / `reportId` column, and checks the parent's tuple. The existing per-card `flashcard` ownership rows are dropped.
- **Initial data (my call):** backfill from each service's **own owner columns**, which are the true data: `blog.authorId`, `flashCardList.authorId`, `report.reportedBy`, `exam.createdBy`. Rooms have no owner column, so they come from the current `resource_ownership`. A one-off reconcile script lists any disagreement between the old `resource_ownership` and the services' columns before cut-over.
- Ready for groups later: a group grant is just another tuple (`subjectType = group`), and membership would be tuples on `group` objects. The pull endpoint would then also send membership tuples for the groups referenced by the service's tuples. Not built now.

## 5. Sync protocol

**gRPC on the authorization service:**

- `PullChanges(objectTypes: string[], afterVersion: int64, limit: int32 = 1000) → { changes: Change[], latestVersion: int64, resetRequired: bool }`. It returns changes with `version > afterVersion` for those object types, in version order. `latestVersion` is the global head, used for lag metrics.
- `DeleteResource(objectType, objectId) → { operationId, state }` (§6.3).
- `GetOperation(operationId) → { state, reason? }`.
- `ExportSnapshot(objectTypes, pageToken) → { tuples[], asOfVersion, nextPageToken }`. It's used for the first bootstrap and after `resetRequired`. The service then pulls changes after `asOfVersion`.
- `Check(actorId, relation, objectType, objectId) → { allowed }`. This is the fallback for decisions a service can't make locally (G4 / §6.4).

**On each service:**

- Local tables: `authz_tuple` (the same columns as `relation_tuple`, including `state`, plus `provisional`, holding only its object types) and `authz_sync_state` (`applied_version`, `last_success_at`, `last_error`, `last_error_at`).
- Applying a page is **one local transaction**: apply the upserts and deletes, then set `applied_version`. That makes a re-applied page harmless.
- **When it syncs:**
  1. **On startup:** catch up until `applied_version` reaches the `latestVersion` seen at the start, then report ready (G5).
     - **First boot (my call):** with no snapshot yet (`applied_version = 0`), the service stays not-ready until the bootstrap succeeds.
     - **Restart:** if a snapshot exists and authorization is unreachable, the service becomes ready after **30 s** with a stale snapshot, sets `authz_sync_stale = 1`, and keeps retrying. Reads and non-sensitive writes continue; sensitive operations fail anyway, because authorization is down.
  2. **On a nudge:** authorization publishes `authz.changed { latestVersion, objectTypes }` on RabbitMQ (topic `authz.changed.<objectType>`). The service pulls immediately. Usual latency is under 1 s.
  3. **Periodic safety net every 30 s**, in case a nudge was lost. Rationale: a lost nudge then costs at most 30 s of staleness on non-sensitive decisions, and an idle pull is one cheap indexed query. Configurable with `AUTHZ_SYNC_INTERVAL_MS`.
- **Policy data source (my call):** authorization decisions and visibility filters use **`authz_tuple`**, joined in repository queries. Denormalized columns such as `authorId` are for display only. Since ownership never transfers, they don't need a sync path. Pilot repository queries that filter by owner are rewritten to join the snapshot.
- Concurrent triggers never overlap: one sync runs at a time per service instance (a mutex). Several replicas may pull independently, because applying is idempotent.

**Staleness budget:** non-sensitive decisions may lag the truth by the sync delay. Sensitive decisions never use the snapshot, so they're never stale.

## 6. Operation flows

### 6.1 Create (non-sensitive)

1. The service inserts the domain row **and** an outbox event `authz.ownership.register { objectType, objectId, ownerId }` in the same transaction.
2. It also inserts a **provisional** local tuple (`provisional = true`), so the creator can edit immediately. This is my call, to avoid a 404 right after creation.
3. The relay publishes. Authorization consumes it idempotently (an upsert keyed by the tuple), writes the tuple and a change-log entry, then sends a nudge.
4. Sync delivers the authoritative tuple, which replaces the provisional one. A provisional tuple never authorizes a sensitive operation. One still unconfirmed after **10 minutes** is surfaced as a metric (`authz_provisional_tuples_stale`).

### 6.2 Non-sensitive operation

`gateway (verifies JWT) → service`. The service's `ActorAuthGuard` verifies the forwarded JWT. A domain policy decides from the `Actor` (global permissions) and the snapshot (`owner` tuple). Allowed write operations are appended to the service's local `audit_log` (`at`, `actor_id`, `action`, `object_type`, `object_id`, `changes` JSON). Deny gives 404 if the actor can't see the object, and 403 if they can see it but may not change it.

### 6.3 Sensitive operation: delete a top-level object

1. The client calls the gateway route, e.g. `DELETE /api/v1/flash-card-lists/:id`. The gateway calls **authorization** `DeleteResource(objectType, objectId)`, forwarding the JWT. The gateway no longer calls the owning service's delete RPC.
2. Authorization decides from **its own data**: the caller owns the object, or holds the object type's moderation permission from the JWT (e.g. `resource:flash-card-list:moderate`).
3. **Delete is two-phase (my call):**
   - In one transaction, authorization marks the object's tuples `state = pending_delete`, appends to the change log, inserts a `sensitive_operation` row (`committed`), and inserts an outbox event `authz.resource.deleted`.
   - A `pending_delete` tuple syncs to the service like any other change, and **locks the object**: local policy denies every write, and reads return 404.
   - The tuples are only removed when the service confirms (step 5). If the service reports failure, or retries are exhausted, authorization **restores** the tuples to `active` (compensation) and marks the operation `failed`. The resource is never left existing without an owner.
4. The owning service consumes the event and applies it idempotently:
   it deletes its domain rows, and publishes its own downstream events (e.g. file release) through its outbox. It then publishes `authz.operation.applied { operationId }`, or `authz.operation.failed { operationId, reason }` if the apply can't succeed (e.g. a database constraint), through its outbox.
5. Authorization finalizes. `applied` deletes the `pending_delete` tuples. `failed` restores them. Operations not confirmed within **5 minutes** are retried by re-publishing the event, up to 5 times, then treated as failed and alerted on.
6. **Response, backward compatible (my call):** the gateway waits up to **5 s** for the operation to reach `applied`. If it does, it returns `204`, as `DELETE` does today. Otherwise it returns `202 { operationId }`. `GET /api/v1/authz/operations/:id` returns the status. It's readable by the requester, and by actors holding the object type's moderation permission.

Owning services lose their **public** delete RPCs for top-level objects; child deletes stay on the service. Domain deletion runs only from the authorization event. Their gRPC delete handlers are removed from the gateway-facing service definitions.

### 6.4 Fallback check

If a policy needs data the snapshot doesn't hold, the service calls `authorization.Check(...)`. It never calls another domain service. Each fallback call is counted (`authz_fallback_checks_total`), so overuse shows up.

## 7. Outbox / inbox (all services)

- Shared library `@server/messaging`:
  - **Prisma models**, copied into each service's schema, because each service has its own Prisma client:
    - `outbox_event` (`id uuid`, `routing_key`, `payload jsonb`, `created_at`, `published_at null`, `attempts`, `last_error`).
    - `inbox_event` (`id uuid PK` = the event id, `consumer`, `processed_at`).
  - **`OutboxPublisher.add(tx, routingKey, payload)`.** It must be called inside the business transaction.
  - **Relay worker:** every **1 s**, `SELECT … WHERE published_at IS NULL ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`. It publishes to the `eventbus` exchange with publisher confirms, then sets `published_at`. Failures back off and increment `attempts`.
  - **Inbox:** consumers wrap handlers with `@Idempotent()`. It inserts into `inbox_event` in the same transaction as the handler's writes, and skips duplicates.
  - **Cleanup:** published outbox rows and inbox rows older than **7 days** are deleted daily.
- **Rollout compatibility (my call):** during the migration, consumers accept both the new envelope and the legacy bare payload. Legacy messages get no inbox dedup. The legacy form is dropped once every publisher is on the outbox, which is the last task of rollout step 2.
- The event envelope carries `id`, `type`, `occurredAt` and `payload`. Every existing `amqpConnection.publish(...)` call is migrated to the outbox (this closes backlog C11). Existing consumers become idempotent (this closes C1 and C13 duplicates).
- Dead-letter exchanges and queues are declared explicitly for every consumer queue (this fixes backlog C2).

## 8. Observability

**Stack (my call):**

- OpenTelemetry SDK in every NestJS app (metrics, traces, logs). The existing Winston logger stays; logs are shipped with trace ids.
- `grafana/otel-lgtm` in `docker/docker-compose.observability.yaml` for local and dev. It gives Grafana, a Prometheus-compatible metrics store, Loki and Tempo in one container. Production can point the same OTLP exporter at separate components later without code changes.

**Health:**

- Every app exposes `GET /health/live` and `GET /health/ready` via `@nestjs/terminus`.
- Readiness covers the database, RabbitMQ, and (where applicable) "initial authz catch-up done".
- gRPC-only apps get a tiny HTTP listener for these.
- Docker compose `healthcheck`s use them.

**Metrics** (every service with a snapshot, labelled by `service` and `object_type`):

- `authz_sync_applied_version`, `authz_sync_latest_version`, and the derived lag `authz_sync_version_lag`
- `authz_sync_last_success_timestamp_seconds`
- `authz_sync_duration_seconds` (a histogram)
- `authz_sync_errors_total`, `authz_sync_resets_total`
- `authz_sync_catchup_duration_seconds` (on startup)
- `authz_provisional_tuples_stale`, `authz_fallback_checks_total`

**Metrics** (every service):

- `outbox_pending_events`, `outbox_oldest_pending_age_seconds`, `outbox_publish_errors_total`
- `inbox_duplicates_total`, `consumer_failures_total`
- standard HTTP/gRPC request rate, error rate and latency

**Metrics** (authorization):

- `authz_sensitive_operations{state}`, `authz_sensitive_operation_age_seconds` for unapplied operations

**Dashboards** (provisioned as JSON in `docker/observability/dashboards/`):

1. **Platform status:** one row per service showing up/ready, request rate, errors, p95 latency, restarts.
2. **Authz sync health:** lag and last success per service and object type, errors, resets, catch-up times.
3. **Messaging:** outbox backlog and age per service, DLQ depth, consumer failures.

**Alerts** (Grafana alerting, provisioned):

- a service not ready for more than 2 min
- `authz_sync_last_success` older than 2 min
- version lag above 0 for more than 2 min
- an outbox oldest pending event older than 1 min
- any sensitive operation in `failed`, or `committed` for more than 10 min
- DLQ depth above 0

**Documentation:**

- `docs/architecture/authorization.md` is rewritten: model, flows, the sync protocol, and what to watch.
- `docs/operations/observability.md` is new: how to run the stack, what each dashboard and alert means, and how to recover a service stuck syncing (force a reset).

## 9. How this fits the existing code

- The **Actor plan** (`docs/superpowers/plans/2026-11-12-actor-permission-authorization.md`) tasks 1–3 stay: Actor, ActorAuthGuard, forwarding the JWT. Its tasks 4–7 are folded into this design. Permissions stay global and come from the JWT; ownership comes from the snapshot.
- These get removed as services migrate:
  - `@ResourceAccess` / `ResourceAccessGuard` (replaced by local policy, or by sensitive routing to authorization)
  - the `requesterId`/`privileged` and `userId`/`recipientId` request fields
  - the `resource.resource.*`, `exam.exam.*`, `live.room.*` ownership events (replaced by `authz.ownership.register` via the outbox)
- `CheckOwnership`/`RegisterOwnership`/`RemoveOwnership` become internal or are removed, in favour of `Check`, `PullChanges`, `ExportSnapshot`, `DeleteResource`, `GetOperation`.
- Rollout order:
  1. Observability stack and health endpoints.
  2. `@server/messaging` (outbox/inbox), first used for the existing events.
  3. Authorization tuples, change log, and sync API, with `resource_ownership` migrated.
  4. Resource service pilot: blogs, flash cards, lists, reports.
  5. exam, then live.
  6. Remove the legacy paths.
- Each step is its own plan.

## 10. Left to the builder

- Exact table and column names, and Prisma mapping, within the shapes above.
- Retry back-off curves, batch sizes (keep within the numbers given), and the HTTP port numbers for the health listeners.
- Dashboard layout details.
- How each service declares its object types for sync (a constant in its domain layer is fine).

## 11. Calls I made (please check)

- Two-phase delete: `pending_delete` locks the object, and the tuple is restored if the owning service can't apply the delete (§6.3).
- Backward-compatible `DELETE`: 204 if applied within 5 s, otherwise 202 plus an operation id (§6.3).
- Tuples only for top-level owned objects; children authorize through their parent (§4).
- Backfill from the services' own owner columns, not from the drifted `resource_ownership` (§4).
- A restarted service with an existing snapshot becomes ready on a 30 s timeout when authorization is down, and flags itself stale (§5).
- Snapshot tuples, not `authorId`, drive authorization and visibility queries (§5).
- Consumers accept the legacy bare payload during rollout (§7).
- Report deletion and room deletion are sensitive operations routed through authorization.
- Decided with you: child deletes are ordinary local edits; ownership transfer is out of scope.
- Provisional local tuple on create, so creators aren't blocked by sync lag (§6.1).
- Sensitive operations are asynchronous with **202 + an operation status endpoint**. The alternative is the gateway waiting until the owning service has applied the change, which is slower and fails when that service is down.
- A 30 s safety-net poll plus RabbitMQ nudges; 30-day change-log retention; 1 s relay interval; 5 min apply timeout.
- Grafana LGTM via OpenTelemetry as the observability stack.
- Roles and permissions stay in the **auth** service and travel in the JWT. Authorization owns relationships, not role definitions.
