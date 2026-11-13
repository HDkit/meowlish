# Operations quick reference

The short version of what an operator needs. Full runbooks: [`docs/operations/observability.md`](../operations/observability.md) (stack, dashboards, alerts, DLQ replay, queue recreation) and [`docs/operations/upgrade-notes.md`](../operations/upgrade-notes.md) (deploy order for this branch). Open issues: [`docs/backlog.md`](../backlog.md).

## Cross-cutting environment variables

| Variable                                                       | Read by (config schema)                                                   | Meaning / failure mode                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CORS_ORIGINS`                                                 | gateway, live (`apps/{gateway,live}/src/configs/config.ts`)               | Comma-separated frontend origins, never `*` (credentials are on, `apps/gateway/src/cors.ts`). Also the allow-list of `CookieIssuanceGuard` and of live's socket `allowRequest`. Must contain the frontend origin even behind the frontend proxy, because the browser's `Origin` is checked. Empty means no cross-origin access |
| `TRUST_PROXY`                                                  | gateway (`trustProxy`, passed to Express `trust proxy` in `bootstrap.ts`) | `false`, `true`, or a hop count. Decides which `X-Forwarded-For` hop is the client IP for rate limiting. `1` behind the bundled Envoy (which sets XFF, `use_remote_address: true`). Next's rewrite proxy doesn't add XFF, so without a proxy in front that does, all users share the Next server's IP bucket                   |
| `CURSOR_SECRET`                                                | auth, exam, achievement, live                                             | ≥ 32 chars; signs pagination cursors (`libs/utils/src/functions/pagination/cursor-pagination.factory.ts`). Unset: random key per process (cursors break on restart and across replicas, with a warning)                                                                                                                        |
| `JWT_PRIVATE_KEY`                                              | auth only                                                                 | RS256 signing key. Never give it to another service                                                                                                                                                                                                                                                                            |
| `JWT_PUBLIC_KEY`                                               | gateway, live                                                             | RS256 verification key. live refuses every socket without it                                                                                                                                                                                                                                                                   |
| `JWT_ACCESS_TOKEN_EXPIRATION` / `JWT_REFRESH_TOKEN_EXPIRATION` | auth                                                                      | Seconds; defaults 900 / 604800. Cookie `Max-Age` follows the token `exp`                                                                                                                                                                                                                                                       |
| `BASE_URL`                                                     | gateway                                                                   | Public origin for the Google OAuth callback (`${BASE_URL}/api/v1/auth/google/callback`). Behind the frontend proxy: the frontend's origin                                                                                                                                                                                      |
| `FE_LOGIN_REDIRECT_URL`                                        | gateway                                                                   | Frontend page that receives `?loginToken=` and POSTs it to `/auth/google/tokens`. Must not be `/`                                                                                                                                                                                                                              |
| `GOOGLE_OAUTH_FRONTENDS`                                       | gateway                                                                   | Comma-separated bare origins of extra frontends that may run the Google flow with `?frontend=<origin>` (e.g. a staging frontend). Google calls back to `<origin>/api/v1/auth/google/callback`, the user lands on `<origin>` + the path of `FE_LOGIN_REDIRECT_URL`. Unset = default frontend only                               |
| `NODE_ENV`                                                     | all                                                                       | `production` forces `Secure` cookies                                                                                                                                                                                                                                                                                           |
| `NEXT_PUBLIC_API_URL`                                          | frontend (`meowlish-fe/next.config.ts`), build time                       | Gateway origin targeted by the `/api/*` and `/socket.io/*` rewrites                                                                                                                                                                                                                                                            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SDK_DISABLED`             | all apps (`@server/telemetry`)                                            | OTLP target (`http://lgtm:4318` in Docker, SDK default `http://localhost:4318` locally); `true` disables telemetry                                                                                                                                                                                                             |
| `MOCK_SCORER_MIN_DELAY_MS` / `_MAX_DELAY_MS`                   | mock-ai-scorer                                                            | Random scoring delay, defaults 2000 / 8000                                                                                                                                                                                                                                                                                     |

Every app also needs its database URL and `RMQ_*` (or `messageQueue`) settings; see each `apps/<svc>/.env.example` and `docker/.env.services.example`.

## Health endpoints

Served by `HealthModule.forRoot` from `@server/telemetry` (`libs/telemetry/src/lib/health/`). `GET /health/live` is always 200 while the process runs; `GET /health/ready` is 200 when every check passes (database `SELECT 1`, RabbitMQ connection when `rabbitmq: true`, registered checks; each time-boxed to 1 s), else 503 naming the failing check.

| App            | Health address (compose)                        |
| -------------- | ----------------------------------------------- |
| gateway        | HTTP port 3000, outside `/api`, never throttled |
| auth           | `HEALTH_PORT` 9101                              |
| exam           | 9102                                            |
| achievement    | 9103                                            |
| resource       | 9104                                            |
| file-service   | 9106                                            |
| authorization  | 9108                                            |
| mock-ai-scorer | 9110                                            |
| live           | `HTTP_PORT` 1511                                |
| notification   | `HTTP_PORT` 50061                               |

Docker healthchecks call `/health/ready` inside each container (`docker/docker-compose.app.yaml`); the health ports are not published to the host.

## Dashboards and alerts

Grafana LGTM (`grafana/otel-lgtm:0.38.1`, `docker/docker-compose.observability.yaml`), Grafana on `LGTM_GRAFANA_PORT` (default 3001). Files are mounted one by one; a new file needs its own `:ro` mount.

| Item                                                                               | File                                                   | Content                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Dashboard "Platform status"                                                        | `docker/observability/dashboards/platform-status.json` | Ready, restarts, request rate, error rate, p95 latency per service                                                 |
| Dashboard "Messaging"                                                              | `docker/observability/dashboards/messaging.json`       | Outbox pending/age/errors, inbox duplicates, DLQ depth, consumer failures                                          |
| Alerts `ServiceNotReady`, `ServiceMissing` (one per service except mock-ai-scorer) | `docker/observability/alerting/platform.yaml`          | `service_ready < 1` for 2 min; no `service_ready` sample for 2 min                                                 |
| Alerts `OutboxStuck`, `DeadLetters`                                                | `docker/observability/alerting/messaging.yaml`         | oldest pending outbox row > 60 s for 1 min (critical); any message in a `*.dlq` (warning)                          |
| RabbitMQ scrape                                                                    | `docker/observability/otelcol-rabbitmq.yaml`           | `rabbit-mq:15692/metrics/detailed?family=queue_coarse_metrics`, needs plugins in `docker/rabbitmq/enabled_plugins` |

No contact point is configured: alerts are visible in Grafana only.

## Ports (default compose)

| What                            | Host port                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Envoy → gateway (HTTP)          | 8080 (admin 9900)                                                                                                      |
| Envoy gRPC-web sidecars         | auth 8081, exam 8082, achievement 8083, resource 8084, notification 8085/8095, file 8086, live 8087 (gRPC) / 8088 (WS) |
| Postgres / Redis / RedisInsight | 5432 / 6379 / 8002                                                                                                     |
| MinIO API / console             | 9000 / 9001                                                                                                            |
| RabbitMQ AMQP / management      | 5672 / 15672                                                                                                           |
| Adminer                         | 8090                                                                                                                   |
| Grafana / OTLP gRPC / OTLP HTTP | 3001 / 4317 / 4318                                                                                                     |

authorization has no Envoy sidecar. See [authorization.md §10](authorization.md#10-risks-visible-in-the-current-design) for why reachable sidecar ports matter.

## Deploy-order reminders (details in upgrade-notes)

- Backend and frontend ship together (cookie sessions, `POST /auth/google/tokens`, tag ids). Gateway and auth ship together.
- Migrate/push schemas before starting the new build (outbox/inbox tables must exist, or logins fail).
- Start consumers (achievement, notification, file-service, authorization) before publishers (auth, exam, live, resource): the relay publishes without `mandatory`.
- Queues whose arguments changed must be deleted once (`PRECONDITION_FAILED` otherwise).
