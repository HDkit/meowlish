# Operations

Everything an operator needs to run Meowlish: where the consoles are, how to read the dashboards, what to do when an alert fires, and how to deploy an upgrade. Open issues are in [`roadmap.md`](roadmap.md); past fixes are in [`fixed-issues.md`](fixed-issues.md).

All commands are run from the repository root. Ports below are the **compose defaults**. Your host may override them in `docker/.env` (template: `docker/.env.example`); to see what a running stack actually uses, run:

```sh
docker ps --format '{{.Names}} {{.Ports}}'
```

## Open the panels

Start the stacks first:

```sh
docker compose -f docker/docker-compose.observability.yaml --env-file docker/.env up -d   # Grafana (LGTM)
docker compose -f docker/docker-compose.yaml --env-file docker/.env up -d --build          # infra + apps + Envoy
# infra only (local dev with nx serve):
docker compose -f docker/docker-compose.db.yaml --env-file docker/.env up -d
```

`docker/docker-compose.yaml` includes `docker-compose.app.yaml` and `docker-compose.db.yaml`. The observability stack is a separate file but the same compose project (`name: meowlish`), so it shares the `meowlish_api-network` network. Never pass `--remove-orphans`: each file sees the other's containers as orphans and would remove them (the "orphan containers" warning itself is harmless).

| Panel                    | Default URL                                                                                               | Port set by                                              | Login (where it is configured)                                                                                                                                                                     | Started by                                              | Use it for                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grafana: dashboards      | <http://localhost:3001/dashboards>                                                                        | `LGTM_GRAFANA_PORT` (`docker/.env`)                      | Built-in default of the `grafana/otel-lgtm` image (`admin` / `admin`); no env var in compose sets it. Change the password in Grafana after the first login; it is stored in the `lgtm-data` volume | `docker-compose.observability.yaml` (`lgtm`)            | "Platform status" and "Messaging" dashboards (folder "Meowlish")                                                                                                |
| Grafana: alerting        | <http://localhost:3001/alerting/list>                                                                     | same                                                     | same                                                                                                                                                                                               | same                                                    | Alert rules and their state. No contact point is configured, so alerts are only visible here                                                                    |
| Grafana Explore: metrics | <http://localhost:3001/explore>                                                                           | same                                                     | same                                                                                                                                                                                               | same                                                    | PromQL on the Prometheus data source (app metrics, RabbitMQ queue metrics)                                                                                      |
| Grafana Explore: logs    | <http://localhost:3001/explore>                                                                           | same                                                     | same                                                                                                                                                                                               | same                                                    | Loki data source: every app's logs, filter by `service_name`                                                                                                    |
| Grafana Explore: traces  | <http://localhost:3001/explore>                                                                           | same                                                     | same                                                                                                                                                                                               | same                                                    | Tempo data source: a request's path across gateway and services                                                                                                 |
| RabbitMQ management      | <http://localhost:15672>                                                                                  | `RABBITMQ_MNGMNT_PORT`                                   | `RABBITMQ_USER` / `RABBITMQ_PASSWORD` in `docker/.env` (compose has weak fallbacks if unset: always set them). RabbitMQ applies them only when its data is first created                           | `docker-compose.db.yaml` (`rabbit-mq`)                  | Queues, DLQs (`*.dlq`), moving dead letters back, deleting queues on upgrades                                                                                   |
| MinIO console            | <http://localhost:9001>                                                                                   | `MINIO_CONSOLE_PORT`                                     | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` in `docker/.env`                                                                                                                                         | `docker-compose.db.yaml` (`min-io`)                     | Browse buckets (e.g. `public`) and uploaded files                                                                                                               |
| RedisInsight             | <http://localhost:8002>                                                                                   | `REDIS_INSIGHT_PORT`                                     | None (Redis has no password in this setup)                                                                                                                                                         | `docker-compose.db.yaml` (`redis`, redis-stack)         | Inspect keys, e.g. the gateway's rate-limit counters `throttle:*`                                                                                               |
| Adminer (Postgres)       | <http://localhost:8090>                                                                                   | `ADMINER_PORT`                                           | System "PostgreSQL", server `db`, user `POSTGRES_USER`, password `POSTGRES_PASSWORD` (`docker/.env`), database e.g. `exam_db`                                                                      | `docker-compose.db.yaml` (`adminer`)                    | Browse and query the per-service databases (`auth_db`, `authorization_db`, `exam_db`, `achievement_db`, `resource_db`, `file_db`, `live_db`, `notification_db`) |
| Scalar API reference     | <http://localhost:8080/reference> (Docker, through Envoy); <http://localhost:3000/reference> (`nx serve`) | `ENVOY_GATEWAY_PORT` (Docker); gateway `PORT` (local)    | None to open it. Protected routes need a session: log in through the API first, or paste an access token as Bearer                                                                                 | `docker-compose.app.yaml` (`gateway` + `envoy-gateway`) | Every HTTP route, with schemas and a "try it" client                                                                                                            |
| Gateway health           | <http://localhost:8080/health/ready>                                                                      | `ENVOY_GATEWAY_PORT`                                     | None                                                                                                                                                                                               | `docker-compose.app.yaml`                               | Quick check that the gateway is up and ready (see [Health endpoints](#health-endpoints) for the other apps)                                                     |
| Envoy admin (gateway)    | <http://localhost:9900>                                                                                   | `ENVOY_GATEWAY_ADMIN_PORT` (always bound to `127.0.0.1`) | None, which is why it is never published                                                                                                                                                           | `docker-compose.app.yaml` (`envoy-gateway`)             | `/stats`, `/clusters`, `/ready` of the Envoy in front of the gateway                                                                                            |

Notes:

- Loki, Tempo and Prometheus run inside the `lgtm` container and have no published ports of their own. Reach them through Grafana > Explore (pick the data source at the top). Only Grafana (3001) and the OTLP ingest ports (4317 gRPC, 4318 HTTP, `LGTM_OTLP_GRPC_PORT` / `LGTM_OTLP_HTTP_PORT`) are published.
- The Envoy sidecars (auth, exam, …) also have admin listeners (`ADMIN_PORT` 9901-9907), but these are not published at all.
- The frontend proxies only `/api/*` and `/socket.io/*` to the gateway, so `/reference` and `/health/*` are not reachable through the frontend's public URL. Use the gateway host (or a tunnel).
- `docker-compose.db.yaml` sets `MINIO_BROWSER_REDIRECT_URL` to the public `https://meowlish.servebeer.com/minio`, i.e. the console is meant to be served under `/minio` by the host's reverse proxy. If the console redirects there or renders blank through a tunnel, use that public URL instead.
- `PGADM_MAIL` / `PGADM_PASS` in `docker/.env.example` are not read by any compose file (there is no pgAdmin service). Use Adminer.

### From another machine: SSH tunnel

Every infrastructure port (Postgres, Redis, RedisInsight, Adminer, MinIO, RabbitMQ, Grafana, OTLP) is published on `127.0.0.1` only (`INFRA_BIND_ADDRESS`, default `127.0.0.1`, S20). The Envoy ports are on `127.0.0.1` too (`ENVOY_GATEWAY_BIND_ADDRESS`, `ENVOY_SIDECAR_BIND_ADDRESS`; the Envoy admin is hard-wired to `127.0.0.1`). So from your laptop you can't open them directly: forward them over SSH.

```sh
ssh -N \
  -L 3001:127.0.0.1:3001 \
  -L 15672:127.0.0.1:15672 \
  -L 9001:127.0.0.1:9001 \
  -L 8002:127.0.0.1:8002 \
  -L 8090:127.0.0.1:8090 \
  -L 8080:127.0.0.1:8080 \
  -L 9900:127.0.0.1:9900 \
  user@host
```

Then open the URLs from the table on your laptop. Each `-L` is `<local port>:127.0.0.1:<port on the server>`:

- The **server** port must be what the server's `docker/.env` sets. Check it on the server with `docker ps --format '{{.Names}} {{.Ports}}'` (the part before `->` is the host port).
- If a **local** port is already taken on your laptop, pick another one, e.g. `-L 13001:127.0.0.1:3001`, then open `http://localhost:13001`.
- Forward only what you need. Grafana alone: `ssh -N -L 3001:127.0.0.1:3001 user@host`.

| Forward | For                                            |
| ------- | ---------------------------------------------- |
| 3001    | Grafana (dashboards, alerts, Explore)          |
| 15672   | RabbitMQ management                            |
| 9001    | MinIO console                                  |
| 8002    | RedisInsight                                   |
| 8090    | Adminer                                        |
| 8080    | Envoy → gateway: `/reference`, `/health/ready` |
| 9900    | Envoy admin                                    |

Don't set `INFRA_BIND_ADDRESS=0.0.0.0` to "make it easier": RedisInsight, Adminer and Envoy admin have no login of their own, and the Envoy sidecars skip the gateway's auth checks (S16).

### Provisioned dashboards

Dashboards and alert rules come from files in `docker/observability/`, each mounted one by one (`:ro`) into the `lgtm` service. Edit the files and restart `lgtm` rather than editing in the UI (`allowUiUpdates: false`). A new file in the directory is **not** picked up by itself: add a `:ro` mount for it in `docker/docker-compose.observability.yaml`, then `docker compose -f docker/docker-compose.observability.yaml up -d`.

| Dashboard                                        | File                                                   | Shows                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Platform status (uid `meowlish-platform-status`) | `docker/observability/dashboards/platform-status.json` | Per service (drop-down `service`): ready, restarts in the last hour, request rate, error rate, p95 latency |
| Messaging (uid `meowlish-messaging`)             | `docker/observability/dashboards/messaging.json`       | Outbox backlog and age, publish errors, inbox duplicates, DLQ depth, consumer failures                     |

**Platform status** panels:

- **Ready**: current `service_ready` for the service. 1 is ready, 0 is not.
- **Restarts (1h)**: distinct instances seen in the last hour minus one, so it goes up by one per restart or redeploy.
- **Request rate (HTTP + gRPC)**: requests per second, one series per protocol.
- **Error rate (HTTP 5xx, gRPC code != 0)**: share of failed requests. gRPC counts every non-zero status as an error, including client errors such as NOT_FOUND.
- **p95 latency (HTTP + gRPC)**: 95th-percentile latency in seconds.

gRPC-only apps have no business HTTP traffic, so their HTTP panels only show the health listener. The gateway has no gRPC server, so its gRPC panels are empty. Both are expected.

**Messaging** panels (every service publishes through a transactional outbox and consumes through an inbox, `@server/messaging`):

- **Outbox pending events** (`outbox_pending_events{service}`): rows in `outbox_events` not yet published. Normally 0 or a few.
- **Outbox oldest pending age** (`outbox_oldest_pending_age_seconds{service}`): age of the oldest unpublished row. A growing value means the relay can't reach the broker or keeps failing.
- **Outbox publish errors (5m increase)** (`outbox_publish_errors_total{service}`): failed publish attempts. The relay retries with back-off, so a short burst during a broker restart is normal.
- **Inbox duplicates skipped (5m increase)** (`inbox_duplicates_total{service,consumer}`): redeliveries the inbox recognised and ignored. Occasional values are normal (at-least-once delivery); a steady stream means a consumer keeps failing after commit, or a queue keeps redelivering.
- **Dead-letter queue depth** (`rabbitmq_detailed_queue_messages{queue=~".*\\.dlq"}`): messages in each `<queue>.dlq`. Comes from RabbitMQ, not the apps.
- **Consumer failures (5m rate)** (`consumer_failures_total{consumer}`, grouped by `job` = the service): handler errors. Every failed delivery counts, including those that are then retried, so one message that never succeeds counts 6 times (first delivery + 5 retries) before it lands in `<queue>.dlq`.

The DLQ panel and the `DeadLetters` alert need the RabbitMQ scrape: `docker/observability/otelcol-rabbitmq.yaml` is an extra collector config passed to `lgtm` through `OTELCOL_EXTRA_ARGS`. It scrapes `rabbit-mq:15692/metrics/detailed?family=queue_coarse_metrics` every 15 s, which needs the `rabbitmq_prometheus` plugin. `docker/rabbitmq/enabled_plugins` enables it (with `rabbitmq_management`, `rabbitmq_shovel`, `rabbitmq_shovel_management`), but the file only takes effect when the container is recreated:

```sh
docker compose -f docker/docker-compose.db.yaml --env-file docker/.env up -d --force-recreate rabbit-mq
```

Until then the DLQ panel and `DeadLetters` have no data.

### Provisioned alert rules

All rules are in Grafana folder "Meowlish", evaluated every minute. Response steps are in [Alerts](#alerts).

| Rule                                                                                                                            | File                                           | Severity | Fires when                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServiceNotReady`                                                                                                               | `docker/observability/alerting/platform.yaml`  | critical | Any service's `service_ready` is below 1 for 2 minutes (label `service` names it)                                                           |
| `ServiceMissing` (one per service: auth, authorization, exam, achievement, resource, file-service, gateway, live, notification) | `docker/observability/alerting/platform.yaml`  | critical | No `service_ready` sample from that service for 2 minutes, held 1 minute                                                                    |
| `ServiceMissing` (mock-ai-scorer)                                                                                               | `docker/observability/alerting/platform.yaml`  | warning  | mock-ai-scorer reported in the last hour but not in the last 2 minutes (so it stays quiet when the `mock-ai` profile is simply not running) |
| `OutboxStuck`                                                                                                                   | `docker/observability/alerting/messaging.yaml` | critical | A service's oldest unpublished outbox row is older than 60 s                                                                                |
| `DeadLetters`                                                                                                                   | `docker/observability/alerting/messaging.yaml` | warning  | Any `*.dlq` queue holds at least one message (label `queue` names it)                                                                       |

No contact point is configured: alerts are not sent anywhere, look at Grafana > Alerting.

## Health endpoints

Served by `HealthModule.forRoot` from `@server/telemetry` (`libs/telemetry/src/lib/health/`):

- `GET /health/live`: liveness. Always 200 `{"status":"ok"}` while the process runs.
- `GET /health/ready`: readiness (terminus JSON). 200 when every check passes, 503 naming the failing check otherwise.

Readiness checks, each time-boxed to 1 s: database (`SELECT 1`, when the app has Prisma), RabbitMQ connection (when `rabbitmq: true`, i.e. every app except gateway), and anything registered through `ReadinessRegistry`.

| App            | Health address inside its container                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| gateway        | HTTP port 3000, outside `/api`, never throttled (also via Envoy: `http://localhost:8080/health/ready`) |
| auth           | `HEALTH_PORT` 9101                                                                                     |
| exam           | `HEALTH_PORT` 9102                                                                                     |
| achievement    | `HEALTH_PORT` 9103                                                                                     |
| resource       | `HEALTH_PORT` 9104                                                                                     |
| file-service   | `HEALTH_PORT` 9106                                                                                     |
| authorization  | `HEALTH_PORT` 9108                                                                                     |
| mock-ai-scorer | `HEALTH_PORT` 9110 (profile `mock-ai`)                                                                 |
| live           | `HTTP_PORT` 1511                                                                                       |
| notification   | `HTTP_PORT` 50061                                                                                      |
| ai-llm         | 8080 `/health` (llama.cpp; healthy once the model is loaded; profile `ai`)                             |
| ai-scorer      | 8081 `/health` (RabbitMQ connection only; profile `ai`)                                                |

gRPC-only apps run a small HTTP listener on `HEALTH_PORT` just for health. None of these ports is published to the host. Docker healthchecks call `/health/ready` inside each container (15 s interval, 30 s start period; `docker-compose.app.yaml`), so `docker compose ps` shows `healthy` / `unhealthy`. To query one by hand:

```sh
docker compose -f docker/docker-compose.yaml exec auth wget -qO- http://127.0.0.1:9101/health/ready
```

## Logs, metrics, traces

Every app sends traces, metrics and logs over OTLP to the Grafana LGTM container (`grafana/otel-lgtm:0.38.1`: Loki, Grafana, Tempo, Prometheus, plus an OpenTelemetry collector).

### Where apps send telemetry

- Apps in Docker: `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`, set in `docker/.env.services` (template `docker/.env.services.example`).
- Apps run locally (`nx serve`): no variable needed; the SDK default `http://localhost:4318` applies.
- If you changed `LGTM_OTLP_HTTP_PORT` (because something else uses 4318), point local apps at it: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:<LGTM_OTLP_HTTP_PORT>`. Apps inside Docker are not affected (they use the container port).
- If the collector is unreachable, the app still starts and runs; telemetry is dropped.

### Disable telemetry

Set `OTEL_SDK_DISABLED=true`. `startTelemetry()` then returns without creating an SDK, so nothing is exported. CI sets it for tests. Health endpoints keep working, but `service_ready` and the RPC metrics are no longer exported (and `ServiceMissing` will fire for that app).

### How it is wired

- `apps/<app>/src/main.ts` calls `startTelemetry({ serviceName })` from `@server/telemetry`, then dynamically imports `./bootstrap.js`. Telemetry must start before Nest and the instrumented libraries load. `bootstrap.ts` holds the normal Nest bootstrap.
- `startTelemetry` starts the Node SDK with OTLP trace, metric (exported every 15 s) and log exporters plus the Node auto-instrumentations. `fs` is disabled, and incoming `/health/*` requests are excluded from HTTP traces and metrics so probes don't add noise. Logs reach Loki through `@opentelemetry/winston-transport`, imported by `startTelemetry` so it is bundled into each app's production dependencies.
- On `SIGTERM` it flushes the SDK (at most 5 s, so a hung collector can't block exit) and re-raises the signal. Every app service in `docker-compose.app.yaml` sets `init: true`, because the kernel ignores default-action signals sent to PID 1; the init process forwards `SIGTERM`, so containers stop promptly instead of waiting for `SIGKILL`.
- `HealthModule.forRoot({ serviceName, prismaToken?, rabbitmq? })`, imported by every app module, provides the health controller, the `service_ready` gauge and the gRPC metrics interceptor.

### Metrics

| Metric                                                                                                                                           | Meaning                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `service_ready{service}`                                                                                                                         | 1 if the last readiness check passed, else 0. Evaluated on each metric export (every 15 s)                       |
| `http_server_request_duration_seconds` (`_count`, `_bucket`)                                                                                     | HTTP server latency histogram (auto-instrumentation). Request, error and latency panels                          |
| `rpc_server_duration_milliseconds{rpc_method, rpc_grpc_status_code}`                                                                             | gRPC handler latency histogram (`RpcMetricsInterceptor`). `rpc_method` is `Controller.handler`; status `0` is OK |
| `outbox_pending_events`, `outbox_oldest_pending_age_seconds`, `outbox_publish_errors_total`, `inbox_duplicates_total`, `consumer_failures_total` | Messaging, see the Messaging dashboard above                                                                     |
| `rabbitmq_detailed_queue_messages{queue}`                                                                                                        | Messages per RabbitMQ queue (scraped from RabbitMQ)                                                              |

Names are as stored in Prometheus (the unit is appended to the OpenTelemetry name, e.g. `rpc_server_duration`). Request metrics are labelled `service_name`; `service_ready` is labelled `service`.

## Dead letters and replay

Consumers don't swallow errors. When a handler throws, the `deadLetterQueue` error handler retries with exponential backoff: it republishes the original message (same content, message id and headers, plus `x-retry-count`) through the default exchange into `<q>.retry.N` and acks the original. `<q>.retry.1` … `<q>.retry.5` hold it for 1, 2, 4, 8 and 16 s (queue TTL, capped at 60 s), have no consumer, and on expiry dead-letter back to `<q>` only, so other subscribers of the same routing key never see the retry. If the republish itself fails, the original is nacked with requeue (after a 1-2 s pause) so it isn't lost. After the 5th retry fails, the message is nacked without requeue to the `eventbus.dlx` exchange, which routes it to `<q>.dlq`.

`exam.writing.submitted` is published bare (no event envelope) because its consumer is the external AI scorer. All other events carry an envelope with an event id that the inbox uses to skip duplicates.

**Inspect** a dead-lettered message: RabbitMQ management (<http://localhost:15672>) > Queues > `<q>.dlq` > Get messages, with "Nack message requeue true" so it stays. The `x-death` header shows the original queue and the reason; the service logs (Grafana > Explore > Loki) have the error.

**Replay** after fixing the cause: on the same page open "Move messages", enter the original queue `<q>` as destination, and move. A shovel from `<q>.dlq` to `<q>` also works. Both need the `rabbitmq_shovel` and `rabbitmq_shovel_management` plugins (in `docker/rabbitmq/enabled_plugins`; active only after the `rabbit-mq` container is recreated, see above). Replays are safe: if the first attempt had already committed, the inbox skips the message as a duplicate.

A replayed message keeps its `x-retry-count` header, so if it fails again it goes straight back to `<q>.dlq` without retries. To get the retries again, publish a copy without that header.

## Alerts

### ServiceNotReady (critical)

A service's `service_ready` stayed below 1 for 2 minutes. The `service` label names the app.

1. Call its `/health/ready` (see [Health endpoints](#health-endpoints)). The 503 body names the failing check (`database`, `rabbitmq`, or a registered check).
2. Check that dependency: `docker compose -f docker/docker-compose.yaml ps`, then the Postgres or RabbitMQ container logs.
3. Read the app's logs: Grafana > Explore > Loki, or `docker compose -f docker/docker-compose.yaml logs <app>`.
4. The alert clears by itself after a passing evaluation.

### ServiceMissing (critical; warning for mock-ai-scorer)

No `service_ready` sample from the service for 2 minutes (held 1 minute). The rule's `service` label names the app.

1. `docker compose -f docker/docker-compose.yaml ps`: is the container running, restarting or exited?
2. Read its logs for a startup crash. A crash before the SDK starts means no metrics at all.
3. If the app is running: check `OTEL_EXPORTER_OTLP_ENDPOINT`, that `lgtm` is up, and that `OTEL_SDK_DISABLED` is not `true`.

The per-service rules use `absent_over_time`, which is true whenever no sample exists, even if the service never reported. So after starting only the observability stack, or while an app is intentionally down, they fire after about a minute: silence them in Grafana. The mock-ai-scorer rule only fires if the scorer reported in the last hour, so not running the `mock-ai` profile doesn't trigger it.

### OutboxStuck (critical)

A service's oldest unpublished outbox row is older than 60 s. The `service` label names the app.

1. Check the service logs for relay errors.
2. Check RabbitMQ is up (`/health/ready` shows the `rabbitmq` check; the RabbitMQ management UI loads).
3. Look at the "Outbox publish errors" panel.
4. Also check for an event with no queue yet: publishes are `mandatory`, so an event whose consumer queue doesn't exist (consumer not started, or started after the publisher) stays in the outbox and is retried with back-off (up to 5 min between tries). Starting the consumer fixes it.

The backlog drains by itself once the broker and queue are reachable.

### DeadLetters (warning)

A `*.dlq` queue holds at least one message; the `queue` label names it.

1. Inspect the message and the service logs (see [Dead letters and replay](#dead-letters-and-replay)).
2. Fix the cause.
3. Move the messages back to `<q>`.

It clears when the DLQ is empty. It needs the RabbitMQ scrape (see [Provisioned dashboards](#provisioned-dashboards)).

## Environment variables that matter across services

| Variable                                                                         | Read by (config schema)                                     | Meaning / failure mode                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ORIGINS`                                                                   | gateway, live (`apps/{gateway,live}/src/configs/config.ts`) | Comma-separated frontend origins, never `*` (credentials are on, `apps/gateway/src/cors.ts`). Also the allow-list of `CookieIssuanceGuard` and of live's socket `allowRequest`. Must contain the frontend origin even behind the frontend proxy, because the browser's `Origin` is checked. Empty means no cross-origin access                                                                        |
| `TRUST_PROXY`                                                                    | gateway (Express `trust proxy`, `bootstrap.ts`)             | `false`, `true`, or a hop count: the number of proxies that **append** to `X-Forwarded-For` (Next's rewrite proxy doesn't). Decides the client IP for rate limiting. `1` behind the bundled Envoy alone. Too high lets clients spoof their IP; too low makes users share one bucket. See the table in [Deploying an upgrade](#2-the-browser-talks-only-to-the-frontend-origin-proxy-api-and-socketio) |
| `CURSOR_SECRET`                                                                  | auth, exam, achievement, live                               | At least 32 chars (`openssl rand -hex 32`); signs pagination cursors (`libs/utils/src/functions/pagination/cursor-pagination.factory.ts`). Unset: random key per process, so cursors break on restart and across replicas (with a warning)                                                                                                                                                            |
| `JWT_PRIVATE_KEY`                                                                | auth only                                                   | RS256 signing key. Never give it to another service                                                                                                                                                                                                                                                                                                                                                   |
| `JWT_PUBLIC_KEY`                                                                 | gateway, live                                               | RS256 verification key. live refuses every socket without it                                                                                                                                                                                                                                                                                                                                          |
| `JWT_ACCESS_TOKEN_EXPIRATION` / `JWT_REFRESH_TOKEN_EXPIRATION`                   | auth                                                        | Seconds; defaults 900 / 604800. Cookie `Max-Age` follows the token `exp`                                                                                                                                                                                                                                                                                                                              |
| `BASE_URL`                                                                       | gateway                                                     | Public origin for the Google OAuth callback (`${BASE_URL}/api/v1/auth/google/callback`). Behind the frontend proxy: the frontend's origin (the `oauth2_state` cookie lives there)                                                                                                                                                                                                                     |
| `FE_LOGIN_REDIRECT_URL`                                                          | gateway                                                     | Frontend page that receives `?loginToken=` and POSTs it to `/auth/google/tokens`, e.g. `https://app.example.com/auth/callback` (locally `http://localhost:6767/auth/callback`). Must not be `/`                                                                                                                                                                                                       |
| `GOOGLE_OAUTH_FRONTENDS`                                                         | gateway                                                     | Optional comma-separated bare origins of extra frontends that may run the Google flow with `?frontend=<origin>` (e.g. staging). Register `<origin>/api/v1/auth/google/callback` in the Google OAuth client for each; the user lands on `<origin>` + the path of `FE_LOGIN_REDIRECT_URL`. Unset = default frontend only                                                                                |
| `REDIS_HOST` / `REDIS_PORT`                                                      | notification, gateway, others                               | notification refuses to start without them (SSE fan-out between replicas). The gateway keeps rate-limit counters there (`throttle:*`) and falls back to in-memory counting with one warning while Redis is down                                                                                                                                                                                       |
| `FILE_SERVICE_HOST` / `FILE_SERVICE_PORT`                                        | auth, exam, resource, gateway                               | file-service gRPC address, used to check file ownership when attaching files                                                                                                                                                                                                                                                                                                                          |
| `MINIO_PUBLIC_URL`                                                               | file-service (`docker/.env` for compose)                    | Browser-facing MinIO base for public links and presigned URLs. Default `http://localhost:9000`; in production the host that reverse-proxies to MinIO                                                                                                                                                                                                                                                  |
| `NODE_ENV`                                                                       | all                                                         | `production` forces `Secure` cookies (and MinIO TLS by default)                                                                                                                                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_API_URL`                                                            | frontend (`meowlish-fe/next.config.ts`), build time         | Gateway origin targeted by the `/api/*` and `/socket.io/*` rewrites                                                                                                                                                                                                                                                                                                                                   |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SDK_DISABLED`                               | all apps (`@server/telemetry`)                              | OTLP target (`http://lgtm:4318` in Docker, SDK default `http://localhost:4318` locally); `true` disables telemetry                                                                                                                                                                                                                                                                                    |
| `MOCK_SCORER_MIN_DELAY_MS` / `MOCK_SCORER_MAX_DELAY_MS`                          | mock-ai-scorer                                              | Random scoring delay, defaults 60000 / 180000 (1-3 min), min <= max                                                                                                                                                                                                                                                                                                                                   |
| `AI_LLM_THREADS` / `AI_LLM_CPUS`                                                 | compose, `ai-llm` (profile `ai`)                            | llama.cpp threads and the container's CPU limit, default 8 each. Grading is one essay at a time                                                                                                                                                                                                                                                                                                       |
| `INFRA_BIND_ADDRESS`, `ENVOY_GATEWAY_BIND_ADDRESS`, `ENVOY_SIDECAR_BIND_ADDRESS` | compose (`docker/.env`)                                     | Host address the ports are published on, default `127.0.0.1`. Keep it; use an SSH tunnel or the host reverse proxy                                                                                                                                                                                                                                                                                    |

Every app also needs its database settings (`POSTGRES_*`) and `RMQ_*`; see each `apps/<svc>/.env.example` and `docker/.env.services.example`. Docker apps read `docker/.env.services`; the per-app `POSTGRES_DB`, ports and service hosts are set in `docker-compose.app.yaml`.

## Ports

Default compose host ports (all published on `127.0.0.1`). The variable in `docker/.env` overrides the port.

| What                            | Host port          | Variable                                                            |
| ------------------------------- | ------------------ | ------------------------------------------------------------------- |
| Envoy → gateway (HTTP)          | 8080               | `ENVOY_GATEWAY_PORT`                                                |
| Envoy gateway admin             | 9900               | `ENVOY_GATEWAY_ADMIN_PORT`                                          |
| Envoy gRPC-web: auth            | 8081               | `ENVOY_AUTH_PORT`                                                   |
| exam                            | 8082               | `ENVOY_EXAM_PORT`                                                   |
| achievement                     | 8083               | `ENVOY_ACHIEVEMENT_PORT`                                            |
| resource                        | 8084               | `ENVOY_RESOURCE_PORT`                                               |
| notification gRPC / SSE         | 8085 / 8095        | `ENVOY_NOTIFICATION_GRPC_PORT` / `ENVOY_NOTIFICATION_SSE_PORT`      |
| file-service                    | 8086               | `ENVOY_FILE_SERVICE_PORT`                                           |
| live gRPC / WebSocket           | 8087 / 8088        | `ENVOY_LIVE_GRPC_PORT` / `ENVOY_LIVE_WS_PORT`                       |
| Postgres                        | 5432               | `POSTGRES_PORT` (`.env.example` sets 5433)                          |
| Redis / RedisInsight            | 6379 / 8002        | `REDIS_PORT` (`.env.example` sets 6380) / `REDIS_INSIGHT_PORT`      |
| MinIO API / console             | 9000 / 9001        | `MINIO_PORT` / `MINIO_CONSOLE_PORT`                                 |
| RabbitMQ AMQP / management      | 5672 / 15672       | `RABBITMQ_PORT` / `RABBITMQ_MNGMNT_PORT`                            |
| Adminer                         | 8090               | `ADMINER_PORT`                                                      |
| Grafana / OTLP gRPC / OTLP HTTP | 3001 / 4317 / 4318 | `LGTM_GRAFANA_PORT` / `LGTM_OTLP_GRPC_PORT` / `LGTM_OTLP_HTTP_PORT` |

The Envoy sidecars bypass the gateway's checks, so they must never be reachable from other machines (S16 in [`fixed-issues.md`](fixed-issues.md)). authorization has no Envoy sidecar. The gateway (3000) and the app health ports are not published.

`docker/.env.example` lists `ENVOY_NOTIFICATION_PORT`, but compose reads `ENVOY_NOTIFICATION_GRPC_PORT` and `ENVOY_NOTIFICATION_SSE_PORT`; set those to move the notification sidecar.

## Deploying an upgrade

Steps to take when deploying a build over an existing environment, newest release first. General rules that hold for every release:

- Back up the databases before migrating (see [Backups](#backups)).
- Migrate/push schemas **before** starting the new build (e.g. the outbox/inbox tables must exist, or logins fail).
- Start **consumers before publishers**: achievement, notification, file-service and authorization first, then auth, exam, live and resource. Publishes are `mandatory`, so an event that arrives before its queue exists stays in the outbox and is retried (and `OutboxStuck` fires) rather than lost; starting consumers first avoids the delay. This applies to any fresh broker too.
- A queue whose arguments changed must be deleted once (RabbitMQ answers `PRECONDITION_FAILED` otherwise). Check it is empty first (0 ready, 0 unacked): deleting a queue discards its messages. Delete via RabbitMQ management > Queues > the queue > Delete, or `docker exec meowlish-rabbit-mq-1 rabbitmqctl delete_queue <name>`, after stopping the old containers and before starting the new build.

### Flash card images in file-service (November 2026)

Details in [`fixed-issues.md`](fixed-issues.md#flash-card-images-in-file-service-november-2026).

1. **Database:** `prisma db push` for **resource** (`nx run resource:prisma:push`): adds the nullable `flash_cards.image_file_id`. Nothing is rewritten; old cards keep their `image` URL and still show it.
2. **Deploy order:** resource (after the push), then gateway together with the frontend. Mixed versions fail safe: the card is saved without its image (an old gateway's `image` URL is ignored by the new resource, a new gateway's `image_file_id` by an old one). file-service needs no change; it already consumes `resource.file.added` / `resource.files.removed` (report attachments).
3. **Behaviour you will see:** `POST/PATCH /flash-cards` no longer accept an image URL (`image` is silently dropped); they take `imageFileId` from `POST /files` (`isPublicFile: true`). Attaching someone else's upload is 403 unless admin. Card images now count in file-service's `ref_count` (one per card, copies included), and a file no card holds any more is removed by the orphan cleanup 24 h later.

### November 2026 backlog decisions (S21–S25, C23–C40)

Details in [`fixed-issues.md`](fixed-issues.md#backlog-decisions-november-2026).

1. **Configuration:** notification now needs `REDIS_HOST` / `REDIS_PORT` (SSE fan-out between replicas) and refuses to start without them. Docker already passes them through `.env.services`; add them to any `apps/notification/.env`.
2. **Database** (back up first):
   - `prisma migrate deploy` for **exam** (`20261115100000_goal_target_decimal`: `goals.target` becomes a double, every value is kept).
   - `prisma db push` for **notification** (`forum_quote_enabled`, `flashcard_enabled`, default true) and **resource** (`flash_cards.position`, nullable). Both only add columns.
3. **Deploy order:**
   - **notification before resource**: resource now publishes `resource.flashcard-proposal.withdrawn`, which is unroutable (it stays in the outbox and trips `OutboxStuck`) until notification's queue exists.
   - **resource before gateway**: flash card update/delete moved to the requester pattern; a new gateway with an old resource would leave card edits without an owner check, while the other way round fails safe (400).
   - **gateway with exam** (goal `target` changed from int32 to double, not wire-compatible) and **gateway with live** (`GetChatLogRequest.requester_id` is required).
   - auth and gateway can go in either order (refresh rotation just doesn't rotate in a mixed pair).
4. **Behaviour you will see:**
   - Every Google login needs the `oauth2_state` cookie on the callback, so `BASE_URL` (and every `GOOGLE_OAUTH_FRONTENDS` origin) must be the frontend origin that proxies `/api`. Callbacks without a state were accepted until `LEGACY_STATE_ACCEPTED_UNTIL` (2026-11-15 06:00 UTC); remove that constant in the next release.
   - Refresh tokens rotate (see the release below); a refresh token reused after the 30 s grace revokes its session.
   - New usernames must match `^[a-z0-9._-]{3,30}$`; existing ones are kept until changed.
   - Approved exams and resolved/rejected/dismissed/closed reports are frozen (409 for any change); an approved exam can still be deleted (cascades to its attempts).
   - Rate-limit counters live in Redis (`throttle:*` keys), shared by every gateway replica; while Redis is down the gateway counts in memory and logs one warning.
   - Unreferenced uploads are kept 24 h (was 1 h) before the orphan cleanup deletes them.

### November 2026 backlog release (branch `chore/local-dev-fixes`)

Covers cookie sessions, requester-scoped authorization on exam/live/files, consumer retries with backoff, attempt versioning, tag IDs, Google Calendar tokens kept server-side, and UTC login streaks.

#### 1. Release backend and frontend together

The HTTP contract changed in ways an old frontend can't handle, and an old backend can't serve the new frontend:

- **Cookie auth**: login, register, refresh and Google token exchange return `data: null` and set HttpOnly `access_token` / `refresh_token` cookies. The frontend must send credentials (`credentials: 'include'` / `withCredentials`), refresh with `POST /auth/refresh` and no body, and log out with `POST /auth/logout`. `POST /auth/logout` only clears this browser's cookies: the refresh token stays valid until it expires. `POST /auth/logout-all` revokes every token of the identity (use it for "log out everywhere" or a suspected token leak).
- **Google login exchange** is `POST /auth/google/tokens` with a JSON body `{ "loginToken": "…" }` (was `GET ?loginToken=`). Non-JSON bodies get 415, so a cross-site form can't trigger it.
- **Password change** requires `currentPassword` (401 "Wrong password" otherwise).
- **Exam tags** are added and removed by tag **ID**, not name.
- **Google Calendar**: `GET .../google/calendar/token` returns `{ accessToken, expiresAt }`; connect/exchange return `{ connected, expiresAt }`. Refresh tokens no longer leave the server.

**Refresh tokens rotate**: every `POST /auth/refresh` returns a new `refresh_token` cookie and the old one stops working (30 s grace for concurrent tabs; a later reuse revokes that session). Browsers keep the new cookie on their own; API clients using `Authorization: Bearer` must store the new token. Existing refresh tokens keep working once. Gateway and auth may be deployed in either order for this change (a mixed pair simply doesn't rotate).

Also deploy **gateway and auth together**: the three Google Calendar RPCs changed their return types, so a mixed-version pair fails those routes.

#### 2. The browser talks only to the frontend origin (proxy `/api` and `/socket.io`)

The frontend and the API **may be on different sites** (e.g. `app.servebeer.com` and `meowlish.servebeer.com`, which are cross-site because `servebeer.com` is a public suffix, or two unrelated domains). This works because the browser never calls the API host directly: the frontend proxies to the gateway, so the session cookies are first-party cookies of the **frontend host**, and `SameSite=Lax` never comes into play.

- `/api/*` -> gateway `/api/*`. This also carries `GET /api/v1/auth/google/callback`, so set `BASE_URL` to the **frontend's** public origin: Google must redirect back through the proxy, where the `oauth2_state` cookie of every Google flow lives.
- `/socket.io/*` -> gateway `/api/v1/chat/ws/socket.io/*`. WebSocket upgrades need a proxy that forwards them (nginx/Envoy, or `next start` itself); without one socket.io falls back to long-polling.

The frontend's Next.js config does both rewrites (target: `NEXT_PUBLIC_API_URL`, which may be any host). Calling the API host directly from the browser is **not supported** when it is cross-site: the cookies would be third-party, which Safari and Firefox block and `SameSite=Lax` refuses on fetch. (Same-site direct calls, e.g. `app.example.com` -> `api.example.com`, still work.)

**`CORS_ORIGINS` (gateway and live) must include the frontend origin.** Behind the proxy the browser still sends `Origin: <frontend>`, which `CookieIssuanceGuard` and live's socket handshake check against that list.

**Client IPs and `TRUST_PROXY`.** Rate limits key on the client IP (strict auth routes: 10/min per IP and account, plus 100/min per IP). Next's rewrite proxy forwards the incoming `X-Forwarded-For` unchanged and does not append its own entry, so set `TRUST_PROXY` to the number of proxies that **append** to `X-Forwarded-For` (nginx, Envoy, Caddy, a load balancer); Next does not count:

| Path from the browser                                                      | `TRUST_PROXY` | Gateway sees                    |
| -------------------------------------------------------------------------- | ------------- | ------------------------------- |
| reverse proxy (routes `/api`, `/socket.io` straight to gateway) -> gateway | `1`           | the real client                 |
| reverse proxy -> Next -> gateway                                           | `1`           | the real client                 |
| reverse proxy -> Next -> bundled Envoy -> gateway                          | `2`           | the real client                 |
| Next -> bundled Envoy -> gateway (nothing in front of Next)                | `1`           | the Next server, for every user |
| Next -> gateway (nothing in front of Next)                                 | `false`       | the Next server, for every user |

Never set it higher than the number of appending proxies: the gateway would then believe an `X-Forwarded-For` the client wrote itself, and anyone could pick their own rate-limit bucket. When every user shows up as the Next server, all of them share one bucket (100 logins a minute in total), so put a reverse proxy in front of Next in production.

#### 3. Configuration

Set these before starting the new build (`docker/.env.services`, or each app's `.env`):

| Variable                 | Where                         | Value                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ORIGINS`           | gateway, live                 | Comma-separated frontend origins (no `*`, credentials are on). **Unset in production means no cross-origin access**, so the frontend is refused, and live refuses socket handshakes from other origins.                                                                   |
| `TRUST_PROXY`            | gateway                       | The number of proxies that append to `X-Forwarded-For` (Next's rewrite proxy doesn't); see the table in section 2. `1` behind the bundled Envoy alone.                                                                                                                    |
| `CURSOR_SECRET`          | auth, exam, achievement, live | At least 32 chars (`openssl rand -hex 32`). Unset means a random key per process, so pagination cursors break on restart and differ between replicas.                                                                                                                     |
| `JWT_PUBLIC_KEY`         | live (new), gateway           | The RS256 public key. live now verifies socket tokens itself and refuses every connection without it.                                                                                                                                                                     |
| `FE_LOGIN_REDIRECT_URL`  | gateway                       | The frontend's Google login callback page, e.g. `https://app.example.com/auth/callback` (locally `http://localhost:6767/auth/callback`). The frontend root redirects and drops `?loginToken`, so Google login fails if this points at `/`.                                |
| `GOOGLE_OAUTH_FRONTENDS` | gateway                       | Optional. Extra frontend origins for Google login/linking, e.g. `https://staging.example.com`. For each one, register `<origin>/api/v1/auth/google/callback` in the Google OAuth client and have the frontend open the Google routes with `?frontend=${location.origin}`. |
| `FILE_SERVICE_HOST/PORT` | resource (new)                | file-service gRPC address. Resource now checks file ownership when attaching files to reports.                                                                                                                                                                            |

#### 3a. Mock AI scorer (dev and staging only)

`apps/mock-ai-scorer` is a stand-in for the external AI writing scorer. It consumes `exam.writing.submitted` from the `mock-ai-scorer.writing.submitted` queue and publishes random IELTS scores (4.0-8.5, no real AI) on `exam.writing.scored` after a random delay. Docker starts it only with `--profile mock-ai`.

| Variable                   | Default  | Meaning                                                        |
| -------------------------- | -------- | -------------------------------------------------------------- |
| `MOCK_SCORER_MIN_DELAY_MS` | `60000`  | Lower bound of the random delay before scoring (<= max).       |
| `MOCK_SCORER_MAX_DELAY_MS` | `180000` | Upper bound of the random delay.                               |
| `RMQ_*`, `HEALTH_PORT`     | -        | Same as the other services; health is served on `HEALTH_PORT`. |

**Never run it in production or alongside the real AI scorer.** Both would consume `exam.writing.submitted` (each with its own queue), so every submission is scored twice and the later result overwrites the earlier one.

#### 3b. Real AI scorer (Docker profile `ai`)

`docker compose -f docker/docker-compose.yaml --env-file docker/.env --profile ai up -d` starts `ai-llm` (llama.cpp with the Phi-3 IELTS model) and `ai-scorer` (the evaluator worker); see the README section "Real AI scorer" and [`apps/mock-ai-scorer/README.md`](../apps/mock-ai-scorer/README.md).

1. Check disk: the llama.cpp image is about 1.2 GB and the model 2.2 GB (volume `ai-models`, downloaded on first start; `ai-llm` is healthy once loaded, allow up to 15 min).
2. Stop `mock-ai-scorer`, check its queues are empty, then **delete** `mock-ai-scorer.writing.submitted`, `.retry.1`-`.5` and `.dlq`. The queue is durable and stays bound to `exam.writing.submitted`: left in place it keeps collecting submissions, and a restarted mock would overwrite real feedback.
3. Start `ai-scorer`; it declares `writing.evaluate` (TTL 1 h) and `writing.evaluate.dlq`.

| Variable         | Default | Meaning                             |
| ---------------- | ------- | ----------------------------------- |
| `AI_LLM_THREADS` | `8`     | llama.cpp threads                   |
| `AI_LLM_CPUS`    | `8`     | CPU limit of the `ai-llm` container |

Essays are graded one at a time (about 1 minute each on CPU); simultaneous submissions queue.

#### 4. Database

Run in this order:

1. **Stop the achievement consumers** (the achievement container). Migration `20261112152409_count_first_login_day` adds +1 to every `login_criteria` row's `total` and `longest_streak` (the first login day was never counted). Logins processed by the old consumer while or after it runs use the old counting rules on corrected rows, so stop it first. Queued `user.login` events wait in RabbitMQ and are processed by the new build.
2. `prisma migrate deploy` for **achievement**, **exam** (`attempt_version_scorer_data_cascade`: attempt version column, cascading scorer data), **file-service** (`add_file_uploaded_by`, `add_file_is_system`) and **auth** (`add_identity_is_demo`: additive `identities.is_demo` flag, default `false`; re-run the auth seed afterwards to create the shared demo account). `pnpm db:setup` does all of it locally.
3. `prisma db push` for **live** (`Room.createdBy`), then re-run the **authorization seed**, which backfills `createdBy` from the authorization service's room ownership rows. Rooms without an ownership row stay `NULL`, so only admins can moderate them.
4. `prisma db push` for **notification** (`blog_comment_enabled`, `comment_reply_enabled`, `forum_reply_enabled`, all default true) and **resource** (blog comments and forum tables).
5. Start the new build.

After the release:

- Files uploaded before it have no `uploadedBy`. Only admins can attach them. The current avatar keeps working.
- Achievement login badges catch up at each user's next login.

#### 5. RabbitMQ

- Delete `exam.events.writing.scored` once (check it is empty first). Its dead-letter arguments changed (it used to dead-letter to `exam.dlx` / `writing.result.dlq` and now carries `x-dead-letter-exchange=eventbus.dlx`, `x-dead-letter-routing-key=exam.events.writing.scored`), so redeclaring it fails with `PRECONDITION_FAILED` and exam won't consume. Its DLQ is now `exam.events.writing.scored.dlq` (was `exam.writing.result.dlq`); move any messages still in the old one to `exam.events.writing.scored` first if you want them replayed.
- No longer used, safe to delete once empty: the exchanges `exam.retry` and `exam.dlx`, and the queues `exam.retry.writing-scored.1`, `.2`, `.3` and `exam.writing.result.dlq`. (The old retry queues dead-lettered back through `eventbus`, so other subscribers of `exam.writing.scored` could receive duplicates.)
- The new retry queues `<q>.retry.1` … `<q>.retry.5` (TTL 1, 2, 4, 8, 16 s; `x-dead-letter-exchange=""`, `x-dead-letter-routing-key=<q>`) are created on startup, for every consumer queue including `exam.events.writing.scored`. Nothing to do.
- If you are upgrading from a build **before the outbox/inbox change**, also do the one-time queue recreation below.

### One-time: outbox/inbox and consumer queue recreation

Only for environments still running a build from before the transactional outbox/inbox. Do these steps in order:

1. Apply the schema first: `pnpm db:setup` (or, per service, `prisma migrate deploy` / `prisma db push`) so the `outbox_events` and `inbox_events` tables exist. Without them logins fail (the outbox insert throws) and consumed messages dead-letter (the inbox table is missing).
2. Delete the queues below (after stopping the old containers, before starting the new build; check each is empty first). Consumer queues now carry `x-dead-letter-exchange=eventbus.dlx` and `x-dead-letter-routing-key=<queue>`, and RabbitMQ refuses to redeclare an existing queue with different arguments. The services recreate them on startup. They were all empty when checked:
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
3. Start the consumers first: achievement, notification, file-service and authorization. This creates their queues and bindings.
4. Then start the publishers: auth, exam, live and resource.

Afterwards the old `achievement.dlx` and `notification.dlx` exchanges and their bindings are unused and can be removed (optional).

## Backups

There is no automated backup in this repository. Back up by hand before every migration (the deploy steps above say "back up first").

Each service has its own database in the one Postgres container (`db`, container `meowlish-db-1`): `auth_db`, `authorization_db`, `exam_db`, `achievement_db`, `resource_db`, `file_db`, `live_db`, `notification_db` (created by `docker/postgres/init-databases.sql`). Dump one database:

```sh
mkdir -p ~/meowlish-db-backups
docker exec meowlish-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d exam_db' \
  > ~/meowlish-db-backups/exam_db-$(date +%Y%m%d-%H%M%S).sql
```

All of them:

```sh
for db in auth_db authorization_db exam_db achievement_db resource_db file_db live_db notification_db; do
  docker exec meowlish-db-1 sh -c "pg_dump -U \"\$POSTGRES_USER\" -d $db" \
    > ~/meowlish-db-backups/$db-$(date +%Y%m%d-%H%M%S).sql
done
```

Restore one into an existing (empty) database:

```sh
docker exec -i meowlish-db-1 sh -c 'psql -U "$POSTGRES_USER" -d exam_db' < ~/meowlish-db-backups/exam_db-<stamp>.sql
```

Keep backups **outside the repository** (e.g. `~/meowlish-db-backups/`, as earlier fixes did). Dumps contain user data and password hashes; never commit them. `$POSTGRES_USER` is expanded inside the container, so no credentials appear on your command line.

Other state lives in Docker volumes: `minio-data` (uploaded files), `redis-data`, `lgtm-data` (Grafana, metrics, logs, traces) and `ai-models` (re-downloadable). MinIO files can be copied out from the MinIO console or by archiving the `minio-data` volume while `min-io` is stopped.

## Adding a new app

1. Split the entry point: `main.ts` calls `startTelemetry({ serviceName })` from `@server/telemetry`, then `void import('./bootstrap.js')`; `bootstrap.ts` holds the Nest bootstrap.
2. Import `HealthModule.forRoot({ serviceName, ... })` in the app module.
3. Add a healthcheck for it in `docker/docker-compose.app.yaml` (and `init: true`).
4. Add a `ServiceMissing` rule for it in `docker/observability/alerting/platform.yaml`.
5. A new dashboard is a JSON file in `docker/observability/dashboards/` plus its own `:ro` mount in the `lgtm` service of `docker/docker-compose.observability.yaml`; it appears in Grafana next to "Platform status". (An "Authz sync health" dashboard is planned this way.)
