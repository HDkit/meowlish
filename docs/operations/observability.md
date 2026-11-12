# Observability operations guide

Every app ships traces, metrics, and logs over OTLP to a local Grafana LGTM stack (Loki, Grafana, Tempo, Prometheus-compatible metrics, plus an OpenTelemetry collector) and exposes health endpoints. This guide covers running the stack, reading the dashboard, and responding to alerts.

## Start the stack

Start the observability stack first, then the app stack:

```
docker compose -f docker/docker-compose.observability.yaml up -d
docker compose -f docker/docker-compose.yaml --env-file docker/.env up --build
```

Both compose files declare `name: meowlish`, so they share one project and one network (`meowlish_api-network`). That is how the apps resolve the `lgtm` host name. Compose may print a harmless "orphan containers" warning because each file sees the other's containers. Never pass `--remove-orphans`: it would remove the other file's containers.

Grafana is at <http://localhost:3001> (otel-lgtm default login `admin` / `admin`). Dashboards and alert rules are provisioned from files in `docker/observability/`. Each file is mounted individually (`:ro`) into the `lgtm` service in `docker/docker-compose.observability.yaml`, because the container's provisioning directories already hold the image's own files. Edit the files and restart `lgtm` rather than editing in the UI. A new file dropped into the directory is NOT picked up: add a `:ro` mount for it to the `lgtm` service, then run `docker compose -f docker/docker-compose.observability.yaml up -d`.

### Port overrides

Host ports are set in `docker/.env` (see `docker/.env.example`):

| Variable              | Default | Purpose          |
| --------------------- | ------- | ---------------- |
| `LGTM_GRAFANA_PORT`   | `3001`  | Grafana UI       |
| `LGTM_OTLP_GRPC_PORT` | `4317`  | OTLP gRPC ingest |
| `LGTM_OTLP_HTTP_PORT` | `4318`  | OTLP HTTP ingest |

Override the OTLP ports when another stack on the machine already uses 4317/4318. Apps inside Docker are unaffected (they talk to `lgtm` on the container ports). Apps you run outside Docker must then be pointed at the new port:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:<LGTM_OTLP_HTTP_PORT>
```

## Where apps send telemetry

- Apps in Docker: `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`, set in `docker/.env.services` (template: `docker/.env.services.example`).
- Apps run locally (`nx serve`): no variable needed. The OpenTelemetry SDK default `http://localhost:4318` applies.
- If the collector is unreachable the app still starts and runs. Telemetry is simply dropped.

### Disable telemetry

Set `OTEL_SDK_DISABLED=true`. `startTelemetry()` then returns without creating an SDK, so nothing is exported. CI sets it for tests. Health endpoints keep working, but the `service_ready` and RPC metrics are no longer exported.

## How telemetry is wired

Each app splits its entry point in two:

- `apps/<app>/src/main.ts` calls `startTelemetry({ serviceName })` from `@server/telemetry`, then dynamically imports `./bootstrap.js`. Telemetry must start before Nest and the instrumented libraries are loaded.
- `apps/<app>/src/bootstrap.ts` holds the normal Nest bootstrap.

`startTelemetry` starts the Node SDK with OTLP trace, metric (exported every 15 s), and log exporters plus the Node auto-instrumentations (`fs` is disabled, and incoming `/health/*` requests are excluded from HTTP traces and metrics so probes and healthchecks do not add noise). Logs are shipped to Loki from the Docker images too: `@opentelemetry/winston-transport` is imported by `startTelemetry` so it is bundled into each app's production dependencies. On `SIGTERM` it flushes the SDK (waiting at most 5 s so a hung collector cannot block exit) and then re-raises the signal. Every app service in `docker/docker-compose.app.yaml` sets `init: true`, because the kernel ignores default-action signals sent to PID 1; the init process forwards `SIGTERM` and reaps the re-raised one, so containers stop promptly instead of waiting for `SIGKILL`.

`HealthModule.forRoot({ serviceName, prismaToken?, rabbitmq? })` is imported by every app module. It provides the health controller, the `service_ready` gauge, and the gRPC metrics interceptor.

## Health endpoints

Every app serves:

- `GET /health/live`: liveness, always `{"status":"ok"}` with 200 while the process runs.
- `GET /health/ready`: readiness, terminus JSON. 200 when every check is up, 503 with the failing checks otherwise.

Readiness checks, each time-boxed to 1 s: database (`SELECT 1`, when the app has Prisma), RabbitMQ connection (when `rabbitmq: true`; every app except gateway), and anything registered through `ReadinessRegistry`.

Where to find them:

| App           | Address (default compose)                    |
| ------------- | -------------------------------------------- |
| auth          | `HEALTH_PORT` 9101                           |
| exam          | `HEALTH_PORT` 9102                           |
| achievement   | `HEALTH_PORT` 9103                           |
| resource      | `HEALTH_PORT` 9104                           |
| file-service  | `HEALTH_PORT` 9106                           |
| authorization | `HEALTH_PORT` 9108                           |
| gateway       | its HTTP port (3000 in Docker)               |
| live          | its HTTP port (`HTTP_PORT`, 1511)            |
| notification  | its HTTP port (`HTTP_PORT`, 50061 in Docker) |

gRPC-only apps run a small HTTP listener on `HEALTH_PORT` just for health. The gateway serves `/health/*` unauthenticated and outside the `/api/v1` prefix. These ports are not published to the host. Docker healthchecks call `wget http://127.0.0.1:<port>/health/ready` inside each container (15 s interval, 30 s start period), so `docker compose ps` shows `healthy` or `unhealthy`. To query one by hand: `docker compose -f docker/docker-compose.yaml exec auth wget -qO- http://127.0.0.1:9101/health/ready`.

## Metrics

| Metric                                                               | Meaning                                                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `service_ready{service}`                                             | Gauge: 1 if the last readiness evaluation passed, else 0. Evaluated on each metric export (every 15 s).                      |
| `http_server_request_duration_seconds` (`_count`, `_bucket`)         | HTTP server latency histogram from auto-instrumentation. Used for request, error, and latency panels.                        |
| `rpc_server_duration_milliseconds{rpc_method, rpc_grpc_status_code}` | gRPC handler latency histogram, recorded by `RpcMetricsInterceptor`. `rpc_method` is `Controller.handler`; status `0` is OK. |

Metric names above are as stored in Prometheus (the unit is appended to the OpenTelemetry name `rpc_server_duration`). Dashboard queries filter on the `service_name` label for request metrics and `service` for `service_ready`.

## Platform status dashboard

Grafana > Dashboards > "Platform status" (uid `meowlish-platform-status`). Use the `service` drop-down at the top to pick an app. Panels:

- **Ready**: current `service_ready` for the service. 1 is ready, 0 is not.
- **Restarts (1h)**: number of distinct service instances seen in the last hour minus one, so it rises by one per restart or redeploy.
- **Request rate (HTTP + gRPC)**: requests per second, one series per protocol.
- **Error rate (HTTP 5xx, gRPC code != 0)**: share of requests that failed. gRPC treats every non-zero status as an error, including client errors such as NOT_FOUND.
- **p95 latency (HTTP + gRPC)**: 95th-percentile latency in seconds for both protocols.

gRPC-only apps have no business HTTP traffic, so their HTTP panels only show the health listener's requests. The gateway has no gRPC server, so its gRPC panels are empty. That is expected.

### Later dashboards

A dashboard for "Authz sync health" will be added by a later plan. Each will be a JSON file in `docker/observability/dashboards/` with its own `:ro` mount added to the `lgtm` service (see above), and will appear next to "Platform status" in Grafana's Dashboards list.

## Messaging dashboard

Grafana > Dashboards > "Messaging" (uid `meowlish-messaging`, `docker/observability/dashboards/messaging.json`). Every service publishes events through a transactional outbox and consumes them through an inbox (`@server/messaging`). Panels:

- **Outbox pending events** (`outbox_pending_events{service}`): rows in `outbox_events` not yet published. Normally 0 or a few.
- **Outbox oldest pending age** (`outbox_oldest_pending_age_seconds{service}`): age of the oldest unpublished row. A growing value means the relay cannot reach the broker or keeps failing.
- **Outbox publish errors** (`outbox_publish_errors_total{service}`, 5 min increase): failed publish attempts. The relay retries with back-off, so a short burst during a broker restart is normal.
- **Inbox duplicates skipped** (`inbox_duplicates_total{service,consumer}`, 5 min increase): redeliveries that the inbox recognised and ignored. Occasional values are expected (at-least-once delivery); a steady stream means a consumer keeps failing after commit or a queue keeps redelivering.
- **Dead-letter queue depth** (`rabbitmq_detailed_queue_messages{queue=~".*\\.dlq"}`): messages sitting in each `<queue>.dlq`. Comes from RabbitMQ, not the apps.

- **Consumer failures** (`consumer_failures_total{consumer}`, 5 min rate, grouped by `job` = the service): handler errors. The `deadLetterQueue` error handler counts each one and then nacks the message without requeue, so every increment is a message headed for `<queue>.dlq`.

RabbitMQ metrics reach Grafana through `docker/observability/otelcol-rabbitmq.yaml`, an extra collector config passed to `lgtm` through `OTELCOL_EXTRA_ARGS`. It scrapes `rabbit-mq:15692/metrics/detailed?family=queue_coarse_metrics` every 15 s, which needs the `rabbitmq_prometheus` plugin. `docker/docker-compose.db.yaml` enables it with `docker/rabbitmq/enabled_plugins`; the file only takes effect when the `rabbit-mq` container is recreated (`docker compose -f docker/docker-compose.db.yaml up -d --force-recreate rabbit-mq`). Until then the DLQ panel and the `DeadLetters` alert have no data.

## Event bus: dead letters and replay

Every consumer queue `<q>` dead-letters (nack without requeue) to the `eventbus.dlx` exchange, which routes to the queue `<q>.dlq`. Consumers do not swallow errors: a failure nacks the message, so it lands in the DLQ instead of being lost. The one documented exception is the writing-scored handler.

`exam.writing.submitted` is published bare, without the event envelope, because its consumer is the external AI scorer. All other events are wrapped in an envelope with an event id that the inbox uses for deduplication.

To inspect a dead-lettered message: RabbitMQ management UI (<http://localhost:15672>) > Queues > `<q>.dlq` > Get messages (choose "Nack message requeue true" so it stays). The `x-death` header shows the original queue and the reason; the service logs have the error.

To replay it after fixing the cause: on the same page open "Move messages", enter the original queue name `<q>` as destination, and move. Alternatively use a shovel from `<q>.dlq` to `<q>`. "Move messages" and shovels need the `rabbitmq_shovel` and `rabbitmq_shovel_management` plugins; they are listed in `docker/rabbitmq/enabled_plugins` and, like `rabbitmq_prometheus`, only take effect after the `rabbit-mq` container is recreated. The inbox makes a replay safe: if the first attempt had already committed, the message is skipped as a duplicate.

## One-time upgrade: recreate consumer queues

Consumer queues now carry the arguments `x-dead-letter-exchange=eventbus.dlx` and `x-dead-letter-routing-key=<queue>`. RabbitMQ refuses to redeclare an existing queue with different arguments (`PRECONDITION_FAILED`), so the queues that existed before this change must be deleted once. The services recreate them with the new arguments on startup. These were all empty when checked:

- `achievement.events.user.login`
- `achievement.events.attempt.submitted`
- `achievement.events.attempt.scored`
- `notification.events.badge.earned`
- `notification.events.report.status-changed`
- `file.events.file.added`
- `file.events.files.removed`
- `authorization.events.exam.created`
- `authorization.events.exam.deleted`
- `authorization.events.room.created`
- `authorization.events.room.deleted`
- `authorization.events.resource.created`
- `authorization.events.resource.deleted`

How: RabbitMQ management UI > Queues > pick the queue > Delete, or `docker exec meowlish-rabbit-mq-1 rabbitmqctl delete_queue <name>`.

When: after stopping the old containers and before starting the new build. Check that each queue is empty first (0 ready, 0 unacked), because deleting a queue discards its messages.

Afterwards the old `achievement.dlx` and `notification.dlx` exchanges and their bindings are unused and can be removed (optional).

## Alerts

Rules live in `docker/observability/alerting/platform.yaml` (folder "Meowlish", group `platform`, evaluated every minute). Both are severity `critical`. There is no contact point configured, so they show up in Grafana > Alerting > Alert rules rather than being sent anywhere.

### ServiceNotReady

Fires when any service's `service_ready` stays below 1 for 2 minutes. The label `service` names the app.

First response:

1. Call `/health/ready` for that service (see the table above). The 503 body names the failing check (`database`, `rabbitmq`, or a registered check).
2. Check the dependency: `docker compose ps`, then the Postgres or RabbitMQ container logs.
3. Check the app's logs in Grafana (Explore > Loki) or `docker compose logs <app>`.
4. The alert clears on its own after a passing evaluation.

### ServiceMissing

One rule per service (auth, authorization, exam, achievement, resource, file-service, gateway, live, notification). Fires when `service_ready` has had no samples for the service in the last 2 minutes, held for 1 minute. The rule's `service` label names the app.

First response:

1. `docker compose ps`: is the container running, restarting, or exited?
2. Read its logs for a crash at startup. A crash before the SDK starts means no metrics at all.
3. If the app is running, check `OTEL_EXPORTER_OTLP_ENDPOINT`, that `lgtm` is up, and that `OTEL_SDK_DISABLED` is not `true`.

`ServiceMissing` uses `absent_over_time`, which returns 1 whenever no sample exists, even if the service never reported. So after starting only the observability stack (or when an app is intentionally not running), these rules fire after about a minute. Silence them in Grafana in that case. Add a rule for each new app to this file.

## Messaging alerts

Rules live in `docker/observability/alerting/messaging.yaml` (folder "Meowlish", group `messaging`, evaluated every minute).

### OutboxStuck

Severity `critical`. Fires when `outbox_oldest_pending_age_seconds` of a service is above 60 for 1 minute. The `service` label names the app. First response: check the service logs for relay errors, check that RabbitMQ is up (`/health/ready` shows the `rabbitmq` check), and look at the "Outbox publish errors" panel. The backlog drains by itself once the broker is reachable.

### DeadLetters

Severity `warning`. Fires as soon as `rabbitmq_detailed_queue_messages{queue=~".*\\.dlq"}` is above 0; the `queue` label names the DLQ. First response: inspect the message and the service logs, fix the cause, then replay (see "Event bus: dead letters and replay"). It clears when the DLQ is empty. It needs the RabbitMQ scrape described above.

## Adding a new app

Follow the `main.ts` to `bootstrap.ts` split, import `HealthModule.forRoot(...)` in the app module, add a `ServiceMissing` rule for it in `docker/observability/alerting/platform.yaml`, and add a healthcheck to `docker/docker-compose.app.yaml`.
