# Observability and Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every app emits OpenTelemetry metrics, traces and logs to a local Grafana stack, and exposes `/health/live` and `/health/ready`. A provisioned "Platform status" dashboard and its alerts show every service at a glance. This is rollout step 1 of the hybrid authorization design.

**Architecture:**

- A new `@server/telemetry` lib provides two things:
  - `startTelemetry()`, which configures the OpenTelemetry Node SDK with OTLP/HTTP exporters.
  - `HealthModule`, which wraps `@nestjs/terminus`, adds a readiness registry that later plans hook into (the authz catch-up), and publishes a `service_ready` gauge.
- Each app's `main.ts` becomes a two-line entry: start telemetry, then dynamically import `bootstrap.ts`. This means instrumentation patches modules before they load, whatever the import sorter does.
- gRPC-only apps become hybrid HTTP + gRPC apps so they can serve the health endpoints.
- `grafana/otel-lgtm` runs in its own compose file.

**Tech Stack:** NestJS 11, `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` + OTLP HTTP exporters (traces, metrics, logs) + `@opentelemetry/winston-transport`, `@nestjs/terminus`, Grafana `otel-lgtm` (Grafana, Prometheus-compatible store, Loki, Tempo), Docker Compose, Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-11-12-hybrid-authorization-design.md` (§8; rollout step 1 in §9)

## Global Constraints

- **Dependencies:** add them with `pnpm add -E <pkg>` at the workspace root. `.npmrc` enforces `save-exact` and `minimum-release-age=7200`, so pnpm will refuse anything too new. Commit `pnpm-lock.yaml`.
- **Endpoints:** `GET /health/live` always returns 200 `{ "status": "ok" }` while the process runs. `GET /health/ready` returns 200 when every check passes and 503 otherwise, using terminus's response shape.
- **Health ports:** apps without HTTP today listen on `HEALTH_PORT`, with these defaults:

  | App           | Default `HEALTH_PORT` |
  | ------------- | --------------------- |
  | auth          | 9101                  |
  | exam          | 9102                  |
  | achievement   | 9103                  |
  | resource      | 9104                  |
  | file-service  | 9106                  |
  | authorization | 9108                  |

  gateway, live and notification serve health on their existing HTTP port.

- **Service names** (the OTel `service.name` and the `service` label) equal the Nx project name: `gateway`, `auth`, `authorization`, `exam`, `achievement`, `resource`, `file-service`, `live`, `notification`.
- **Telemetry config:**
  - `OTEL_EXPORTER_OTLP_ENDPOINT` defaults to `http://localhost:4318`.
  - `OTEL_SDK_DISABLED=true` turns telemetry off entirely, and is used in tests and CI.
  - The metric export interval is 15 s.
- **Grafana image:** `grafana/otel-lgtm:0.38.1`. Grafana is published on host port `3001`, because the gateway uses 3000. OTLP is on 4317 and 4318.
- **No `process.env` reads outside `configs/`** except in the new `telemetry.ts` entry files and `HEALTH_PORT`/`HOST` in `bootstrap.ts`. This mirrors the existing `PORT`/`HOST` exception in AGENTS.md.

## Review Focus

- The Grafana stack isn't running, or the OTLP endpoint can't be reached. Apps must still start and serve traffic, with exporter errors throttled to the logs. _Task 1: `startTelemetry does not throw when the collector is unreachable`._
- A RabbitMQ connection drops after startup. `/health/ready` must flip to 503 and recover by itself. _Task 2: `ready reports 503 while a RabbitMQ connection is down`._
- A readiness check throws instead of returning false. That must be 503 with the check's name, not a 500. _Task 2: `ready treats a throwing check as down`._
- The gateway's global `JwtAuthGuard` and its `/api/v1` prefix would hide health behind auth. The health endpoints must be reachable unauthenticated at `/health/*`. _Task 3: the gateway smoke check, `curl -fsS localhost:3000/health/ready`._
- A health route registered twice in hybrid apps (HTTP + gRPC) must not break gRPC startup. _Task 3: the gRPC smoke check per app._

---

### Task 1: `@server/telemetry` lib with `startTelemetry`

**Files:**

- Create: `libs/telemetry/`, via `pnpm exec nx g @nx/js:lib libs/telemetry --importPath=@server/telemetry --bundler=tsc --unitTestRunner=jest --linter=eslint`. Then rename the generated `jest.config.cts` to `jest.config.ts` with `export default`, since AGENTS.md says Jest ignores `.cts`.
- Create: `libs/telemetry/src/lib/start-telemetry.ts`
- Modify: `libs/telemetry/src/index.ts`, and `tsconfig.base.json` (path `@server/telemetry` → `libs/telemetry/src/index.ts`; the generator may already add it)
- Test: `libs/telemetry/src/lib/start-telemetry.spec.ts`

**Interfaces:**

- Produces:
  - `startTelemetry(options: { serviceName: string }): NodeSDK | undefined`. It returns `undefined` when `OTEL_SDK_DISABLED === 'true'`. Otherwise it starts and returns the SDK:
    - resource `service.name = serviceName`;
    - OTLP HTTP trace, metric (`PeriodicExportingMetricReader`, `exportIntervalMillis: 15000`) and log exporters;
    - `getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })`;
    - Winston log sending enabled through the Winston instrumentation (`logHook` correlation is on by default);
    - an `sdk.shutdown()` on `SIGTERM`.
  - `getMeter(): Meter`, which returns `metrics.getMeter('meowlish')`.

- [ ] **Step 1: Write the failing tests.** Use `jest.mock('@opentelemetry/sdk-node')` to observe the constructor.
  - `returns undefined when OTEL_SDK_DISABLED is true`: with `process.env.OTEL_SDK_DISABLED = 'true'`, the result is `undefined` and `NodeSDK` is never constructed.
  - `starts an SDK named after the service`: the result is defined, `NodeSDK` was constructed once, the resource attribute `service.name` is `'exam'`, and `start` was called.
  - `startTelemetry does not throw when the collector is unreachable`: with `OTEL_EXPORTER_OTLP_ENDPOINT = 'http://127.0.0.1:1'` and the real SDK (unmock for this test), `expect(() => startTelemetry({ serviceName: 'x' })).not.toThrow()`, then `await sdk.shutdown()`.
- [ ] **Step 2: Run** `pnpm exec nx run telemetry:test --skip-nx-cache`. Expected: FAIL, module not found.
- [ ] **Step 3: Add dependencies:**
  ```
  pnpm add -E @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
    @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http \
    @opentelemetry/exporter-logs-otlp-http @opentelemetry/sdk-metrics @opentelemetry/sdk-logs \
    @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/winston-transport
  ```
  Then implement `startTelemetry` and `getMeter`.
- [ ] **Step 4: Run** the same command, then `pnpm exec nx run telemetry:lint -- --fix` so `@nx/dependency-checks` fills in `libs/telemetry/package.json`. Expected: PASS, lint clean.
- [ ] **Step 5: Commit** `feat(telemetry): add @server/telemetry with OTLP exporters`.

### Task 2: `HealthModule`, readiness registry and the `service_ready` gauge

**Files:**

- Create: `libs/telemetry/src/lib/health/health.module.ts`, `health.controller.ts`, `readiness.registry.ts`, `rabbitmq.health.ts`
- Modify: `libs/telemetry/src/index.ts`
- Test: `libs/telemetry/src/lib/health/health.controller.spec.ts`

**Interfaces:**

- Consumes: `getMeter()` (Task 1).
- Produces:
  - `HealthModule.forRoot(options: { serviceName: string; prismaToken?: string | symbol; rabbitmq?: boolean }): DynamicModule`. It's global and exports `ReadinessRegistry`.
    - `prismaToken` is the DI token of the Prisma client. Apps pass `DATABASE_SERVICE` from `@server/database`.
    - `rabbitmq: true` checks every connection from `AmqpConnectionManager.getConnections()` via `AmqpConnection#connected`.
  - `@Injectable() class ReadinessRegistry { register(name: string, check: () => boolean | Promise<boolean>): void }`.
  - `HealthController`, with routes `GET /health/live` and `GET /health/ready`. It's decorated with `@Version(VERSION_NEUTRAL)` and `@SetMetadata('isPublic', true)` so the gateway's global guards (key `isPublic`, see `apps/gateway/src/auth/decorators/public.decorator.ts`) let it through.
  - The observable gauge `service_ready{service}` has value 1 when the last readiness evaluation passed and 0 otherwise. It's re-evaluated on each metric collection.

- [ ] **Step 1: Write the failing tests.** Use a Nest testing module and supertest. Fake the Prisma client as `{ $queryRawUnsafe: jest.fn() }` and fake the `AmqpConnectionManager` with `getConnections()` returning `[{ connected: true }]`.
  - `live returns 200 ok`.
  - `ready returns 200 when database, rabbitmq and registered checks pass`.
  - `ready reports 503 while a RabbitMQ connection is down`: set `connected = false` and expect 503 with `rabbitmq` in `error`. Set it back to `true` and expect 200.
  - `ready reports 503 when the database ping fails`: the ping rejects, giving 503 with `database`.
  - `ready reports 503 when a registered check returns false`: `registry.register('authz-catchup', () => false)` gives 503 with `authz-catchup`.
  - `ready treats a throwing check as down`: the check throws `new Error('boom')`, giving 503 (not 500) with `authz-catchup`.
- [ ] **Step 2: Run** `pnpm exec nx run telemetry:test --skip-nx-cache`. Expected: FAIL.
- [ ] **Step 3: Implement.** Run `pnpm add -E @nestjs/terminus`; it must resolve to a version whose peer range includes `@nestjs/common` 11.
  - Use terminus's `PrismaHealthIndicator.pingCheck('database', prisma)`.
  - Write custom indicators for `rabbitmq` and for each registered check.
  - Wrap every check in try/catch so it reports down rather than throwing.
- [ ] **Step 4: Run** the same command, then lint with `--fix`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(telemetry): add health endpoints, readiness registry and service_ready gauge`.

### Task 3: Wire every app

**Files (per app: `achievement`, `auth`, `authorization`, `exam`, `file-service`, `resource`, `gateway`, `live`, `notification`):**

- Create: `apps/<app>/src/bootstrap.ts`, which gets the current contents of `main.ts`, adapted as below.
- Modify: `apps/<app>/src/main.ts`. It becomes exactly:
  ```ts
  import { startTelemetry } from '@server/telemetry';

  startTelemetry({ serviceName: '<app>' });
  void import('./bootstrap');
  ```
- Modify: `apps/<app>/src/<app>.module.ts` to import `HealthModule.forRoot({ serviceName: '<app>', prismaToken: DATABASE_SERVICE, rabbitmq: <true if the app imports RabbitMQModule> })`. The gateway has no database: `{ serviceName: 'gateway', rabbitmq: false }`.
- Modify: `apps/<app>/.env.example`: add `HEALTH_PORT=<default>` (gRPC-only apps only) and `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.
- Modify: `docker/.env.services.example`: add `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`.
- Modify: `apps/gateway/src/bootstrap.ts`: `setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] })`.
- Modify: `package.json` / CI: the workflow's `Run Tests` step gets `env: OTEL_SDK_DISABLED: 'true'`.

**Interfaces:**

- Consumes: `startTelemetry`, `HealthModule` (Tasks 1–2).
- Produces: every app serves `/health/live` and `/health/ready`.

- [ ] **Step 1: Convert the gRPC-only apps to hybrid in their `bootstrap.ts`.** Replace `NestFactory.createMicroservice(Module, grpcOptions)` with:
  - `NestFactory.create(Module, { bufferLogs: true })`
  - `app.connectMicroservice(grpcOptions)`
  - `await app.startAllMicroservices()`
  - `await app.listen(process.env.HEALTH_PORT ?? <default>, process.env.HOST ?? '127.0.0.1')`

  Keep the existing logger setup and `useGlobal*` calls. Note that `connectMicroservice` needs `{ inheritAppConfig: true }` to keep the global pipes and filters on gRPC.

- [ ] **Step 2: Typecheck and build:** `pnpm exec nx run-many -t lint test build`. Expected: `Successfully ran targets lint, test, build`.
- [ ] **Step 3: Smoke test each app locally.** With the infra compose running, run `nx serve <app>`, then:
  - `curl -fsS localhost:<health-port>/health/ready` returns 200 JSON;
  - the gateway: `curl -fsS localhost:3000/health/ready` returns 200 without a token;
  - `curl -fsS localhost:3000/api/v1/<any existing public route>` still works;
  - one gRPC call per app still works, e.g. through the gateway: `GET /api/v1/blogs`.
- [ ] **Step 4: Commit** `feat: expose health endpoints and OpenTelemetry in every app`.

### Task 4: Grafana stack, compose healthchecks, platform dashboard and alerts

**Files:**

- Create: `docker/docker-compose.observability.yaml`
  - service `lgtm`, image `grafana/otel-lgtm:0.38.1`;
  - ports `3001:3000`, `4317:4317`, `4318:4318`;
  - a named volume for its data;
  - the provisioning mounts below.
- Create: `docker/observability/dashboards/dashboards.yaml` (a Grafana file provider) and `docker/observability/dashboards/platform-status.json`
- Create: `docker/observability/alerting/platform.yaml`
- Modify: `docker/docker-compose.app.yaml`:
  - every app gets `healthcheck: test: ["CMD", "wget", "-qO-", "http://localhost:<port>/health/ready"]`, `interval: 15s`, `timeout: 3s`, `retries: 4`, `start_period: 30s`;
  - `HEALTH_PORT` and `HOST=0.0.0.0` are set for the gRPC-only apps.

**Interfaces:**

- Consumes: the `service_ready` gauge (Task 2), and the HTTP/gRPC server duration histograms from auto-instrumentation (`http_server_request_duration_seconds`, `rpc_server_duration_milliseconds`; check the exact exported names in Grafana Explore before writing the queries).

- [ ] **Step 1: Write the compose file and the mounts.** Find otel-lgtm's provisioning paths in the image (`docker run --rm grafana/otel-lgtm:0.38.1 ls /otel-lgtm/grafana/conf/provisioning`), then mount the dashboards provider and the alerting dir there.
- [ ] **Step 2: Build `platform-status.json`.** One row per service:
  - Ready: `max by (service) (service_ready)`, a stat panel, red at 0;
  - Request rate and error rate, from the HTTP/gRPC duration histograms by `service_name`;
  - p95 latency;
  - Restarts: `changes(process_start_time_seconds[1h])`, or the OTel process start metric if it's named differently.
- [ ] **Step 3: Write the alert rules in `platform.yaml`:**
  - `ServiceNotReady`: `max by (service)(service_ready) == 0` for 2m.
  - `ServiceMissing`: `absent_over_time(service_ready{service="<name>"}[2m])`, one rule per service listed in the Global Constraints.
- [ ] **Step 4: Verify.** Run
  ```
  docker compose -f docker/docker-compose.observability.yaml up -d
  docker compose -f docker/docker-compose.yaml --env-file docker/.env up --build
  ```
  - `docker ps` shows every app as `healthy`.
  - Grafana at `http://localhost:3001` has the "Platform status" dashboard with every service at Ready = 1.
  - Stopping one app (`docker stop meowlish-exam-1`) fires `ServiceMissing` within about 3 minutes.
- [ ] **Step 5: Commit** `feat(docker): Grafana otel-lgtm stack, healthchecks, platform dashboard and alerts`.

### Task 5: Operations documentation

**Files:**

- Create: `docs/operations/observability.md`. It covers:
  - how to start the stack (both commands from Task 4);
  - the Grafana URL and default login (`admin`/`admin` for otel-lgtm);
  - what each metric on the platform dashboard means;
  - what each alert means and its first response;
  - how to disable telemetry (`OTEL_SDK_DISABLED`);
  - where sync and messaging dashboards will appear (later plans).
- Modify: `README.md`: add a short "Observability" section linking the doc.
- Modify: `AGENTS.md`: in "Configuration files", list `docker/docker-compose.observability.yaml` and `docker/observability/`. Under service architecture, add: new apps must use the `main.ts` → `bootstrap.ts` split and import `HealthModule`.

- [ ] **Step 1: Write the doc and the edits,** then run `pnpm exec prettier --write README.md AGENTS.md docs`.
- [ ] **Step 2: Commit** `docs: observability operations guide`.
