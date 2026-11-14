# English Application Server

![TypeScript](https://img.shields.io/badge/TypeScript-%233178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2024-%23339933?style=flat-square&logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-%23E0234E?style=flat-square&logo=nestjs&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-%235B4EE1?style=flat-square&logo=grpc&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-%23FF6600?style=flat-square&logo=rabbitmq&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-%23DC382D?style=flat-square&logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%234169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-%232D3748?style=flat-square&logo=prisma&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-%23C72E49?style=flat-square&logo=minio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-%232496ED?style=flat-square&logo=docker&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-%23F69220?style=flat-square&logo=pnpm&logoColor=white)

A microservices-based backend for an English-learning application, built with **NestJS**, **gRPC** (protobuf), **RabbitMQ**, **Redis**, **PostgreSQL**, and **MinIO**. The system is composed of a single HTTP **gateway** that fans out to multiple **gRPC microservices**, each handling its own domain.

It powers **Lingriser**, an IELTS & TOEIC practice app: web frontend [HDkit/meowlish-fe](https://github.com/HDkit/meowlish-fe), live at [meowlish-fe.vercel.app](https://meowlish-fe.vercel.app) (demo account below).

## Features

What the API offers, and which service owns it:

| Feature                   | What the backend does                                                                                                                                                                | Service                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **Mock tests**            | IELTS and TOEIC exams as a tree of sections and questions with media and tags; staff create them and moderators review/approve them                                                  | `exam`, `file-service`              |
| **Taking a test**         | Timed attempts (one unfinished attempt per user and exam), per-question answers saved as you go, **notes** and **flags** per question, saved data to resume, review after submitting | `exam`                              |
| **Writing scoring**       | Essays go to an AI writing scorer over RabbitMQ and the band and feedback come back asynchronously (`mock-ai-scorer` in dev, the real scorer under the Docker `ai` profile)          | `exam`, `mock-ai-scorer`            |
| **Progress**              | Score history, per-day practice activity (for streaks and the heatmap), per-skill and per-question-type stats, and a target-score goal                                               | `exam`                              |
| **Gamification**          | 17 badges in five families (tests completed, good scores, perfect scores, days studied, day streaks) at bronze/silver/gold, awarded from attempt and login events                    | `achievement`                       |
| **Flashcards**            | Cards and lists, public lists to discover, **forks** of someone else's list that can pull upstream changes, and **change proposals** the owner accepts or rejects                    | `resource`                          |
| **Forum**                 | Categories, threads and replies with quotes; moderators pin, lock and delete threads                                                                                                 | `resource`                          |
| **Blog**                  | Posts with tags and two-level comments                                                                                                                                               | `resource`                          |
| **Chat**                  | Chat rooms over Socket.IO with history, scheduled live sessions and bans                                                                                                             | `live`                              |
| **Notifications**         | Badges earned, blog comments and replies, forum replies, flashcard proposals and their decisions, reports; streamed over SSE, with per-type preferences                              | `notification`                      |
| **Moderation & accounts** | Reports on content with attachments, roles and permissions, account locking, mail and Google sign-in, Google Calendar linking                                                        | `resource`, `auth`, `authorization` |

## Architectural diagram

<img width="1113" height="824" alt="Architecture" src="https://github.com/user-attachments/assets/2bc5ce0b-ff57-4d9f-9e7b-776b89cb0644" />

## Architecture

Detailed architecture docs (services, data, authorization, messaging, operations): [docs/architecture/README.md](docs/architecture/README.md).

```
                       ┌──────────────────────────────────────────────┐
                       │                 Gateway (HTTP)                │
                       │  /api/v1/*   (Swagger @ /reference)          │
                       └──────────────────────────────────────────────┘
                              │            │            │
                    ┌─────────┴──┐   ┌──────┴──────┐   ┌┴──────────┐
                    │  gRPC      │   │  gRPC       │   │ gRPC      │
                    ▼            ▼   ▼             ▼   ▼           ▼
                 ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
                 │ auth   │  │ exam   │  │ file   │  │ live   │  │ ...    │
                 └────────┘  └────────┘  └────────┘  └────────┘  └────────┘
                      │            │           │           │
                 ┌────┴─────┐ ┌────┴──────┐ ┌──┴────┐ ┌────┴───┐
                 │PostgreSQL│ │  RabbitMQ │ │ Redis │ │ MinIO  │
                 └──────────┘ └───────────┘ └───────┘ └────────┘
```

- **Gateway** — the only HTTP entry point. Authenticates/authorizes requests (JWT + roles/permissions) and proxies them to the appropriate gRPC microservice. Exposes OpenAPI docs at `/reference`.
- **Microservices** — each is an independent NestJS application exposing one or more **gRPC** services. They communicate between themselves over **RabbitMQ** (events) and call each other over gRPC.
- **Envoy sidecars** (Docker) — expose each gRPC service over HTTP/gRPC-web for external clients, independently of the gateway.

### Auth flow (JWT, RS256)

Authentication uses **asymmetric RS256** JWTs:

- The **auth service** **signs** both access and refresh tokens with the **private key**.
- The **gateway** only **verifies** tokens with the **public key** (it never sees the private key).

This means the private key must only exist in the auth service environment, while the public key is shared with the gateway (and anywhere else that needs to validate a token).

| Env var           | Used by      | Purpose                                                       |
| ----------------- | ------------ | ------------------------------------------------------------- |
| `JWT_PRIVATE_KEY` | auth service | Private key used to **sign** access & refresh tokens (RS256)  |
| `JWT_PUBLIC_KEY`  | gateway      | Public key used to **verify** access & refresh tokens (RS256) |

## Tech Stack

- **Language / Runtime:** TypeScript, Node.js (`node:24-alpine` in Docker)
- **Framework:** NestJS 11
- **Monorepo:** Nx + pnpm workspaces
- **Communication:** gRPC (protobuf, generated via `ts-proto`), RabbitMQ (CQRS/events), Socket.IO (websockets)
- **Data:** PostgreSQL (Prisma ORM), Redis (caching / tokens revocation)
- **Object storage:** MinIO (S3-compatible)
- **Validation / Schemas:** Zod, class-validator
- **Auth:** Passport (JWT, Google OAuth2), `@nestjs/jwt`
- **API docs:** Swagger + Scalar (`/reference`)

## Repository Structure

```
.
├── apps/                     # Application services (Nx projects)
│   ├── gateway/              # HTTP gateway (single entry point)
│   ├── auth/                 # Identity, credentials, roles/permissions, JWT
│   ├── authorization/        # Resource ownership checks
│   ├── exam/                 # Exam management, practice, tags, goals
│   ├── mock-ai-scorer/       # Dev-only random writing scorer (no DB, no gRPC)
│   ├── achievement/          # Badges and user progress
│   ├── resource/             # Blogs, flash cards, reports
│   ├── file-service/         # Presigned URLs & file metadata (MinIO)
│   ├── live/                 # Chat rooms, Socket.IO + gRPC
│   └── notification/         # Notifications & preferences (gRPC + SSE)
├── libs/                     # Shared libraries
│   ├── generated/            # Generated gRPC client/server code (from proto)
│   ├── database/             # Prisma/Postgres module helpers
│   ├── logger/               # Winston-based logger
│   ├── utils/                # Shared pipes, filters, interceptors, types
│   └── typing/               # TypeScript utility types
├── proto/                    # protobuf (*.proto) contracts
├── docker/                   # Dockerfiles, docker-compose, Envoy configs, env examples
├── migrations.json           # Nx package migration config
└── package.json              # pnpm workspace root
```

### Services (apps)

| App              | gRPC services                                                                                                                                | Responsibility                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `gateway`        | — (HTTP)                                                                                                                                     | API routing, JWT verification, role/permission guards, docs                                                                   |
| `auth`           | `AuthService`                                                                                                                                | Registration/login (mail & Google), token issuance & refresh, roles/permissions, identity management, Google Calendar linking |
| `authorization`  | `AuthorizationService`                                                                                                                       | Ownership registration/checking (`is owner?`) for resources                                                                   |
| `exam`           | `ExamManagementService`, `ExamPracticeService`, `TagService`, `GoalService`                                                                  | Create/manage/review exams, sections & questions; attempts, answers, notes & flags; stats, activity, skill stats; tags; goals |
| `achievement`    | `AchievementService`                                                                                                                         | Badges catalog (17), user badges, login/attempt/score progress fed by RabbitMQ events                                         |
| `resource`       | `BlogService`, `BlogCommentService`, `FlashCardService`, `FlashCardListService`, `FlashCardProposalService`, `ForumService`, `ReportService` | Blogs and comments, flash cards and lists (forks, upstream pulls, proposals), forum, moderation reports                       |
| `file-service`   | `FileService`                                                                                                                                | Presigned upload/download URLs, file metadata (MinIO)                                                                         |
| `live`           | `ChatService`                                                                                                                                | Chat rooms, chat logs, room scheduling, bans; Socket.IO real-time                                                             |
| `notification`   | `NotificationService`, `NotificationPreferencesService`                                                                                      | Notifications built from other services' events, mark read, preferences; SSE streaming                                        |
| `mock-ai-scorer` | — (RabbitMQ only)                                                                                                                            | Dev stand-in for the external AI writing scorer: random scores after a random delay (see below)                               |

### Libraries (libs)

| Lib                 | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `@server/generated` | Auto-generated gRPC types/clients from `proto/*.proto`                    |
| `@server/database`  | Prisma/PostgreSQL module utilities                                        |
| `@server/logger`    | Shared Winston logger integration                                         |
| `@server/utils`     | Validation pipes, exception filters, interceptors, shared types & schemas |
| `@server/typing`    | Reusable TypeScript utility types                                         |

## Prerequisites

- **Node.js** 24 (see `.nvmrc`)
- **pnpm** (the workspace is pnpm-only — `corepack` is recommended)
- **Docker** (optional — required to run the dev infrastructure: Postgres, Redis, RabbitMQ, MinIO) and `docker compose`
- **protoc** (only if regenerating gRPC code)
- **Nx CLI** (installed via `npx` / workspace)

## Getting Started (Local Development)

### 1. Start the infrastructure

The repo contains `docker-compose` files under `docker/`. The application **Dockerfile builds are not required for local dev**; you only need the infrastructure services.

```
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.db.yaml --env-file docker/.env up -d
```

This starts **PostgreSQL, Redis, Adminer, MinIO, and RabbitMQ**. Each service gets its **own database** (`auth_db`, `exam_db`, ...), created by `docker/postgres/init-databases.sql` the first time the Postgres volume starts. Host ports come from `docker/.env` (Postgres `5433`, Redis `6380`, RabbitMQ `5672`, MinIO `9000`, Adminer `8090`); change them there if they clash with something else on your machine, and mirror the change in the apps' `.env` files.

> Already ran an older version of this compose file? Its Postgres volume has the pre-18 layout and no per-service databases. Recreate it with `docker compose -f docker/docker-compose.db.yaml --env-file docker/.env down -v` (this deletes local data).

### 2. Install dependencies

```
corepack enable   # uses the pnpm version pinned in package.json "packageManager"
pnpm install
```

### 3. Set up environment variables

Every app ships an `.env.example` with working local values (unique ports, its own database). Copy them all, then paste your RSA keys into `apps/auth/.env` and `apps/gateway/.env` (see **JWT / RSA Keys** below):

```
for f in apps/*/.env.example; do cp -n "$f" "${f%.example}"; done
```

Each app loads `apps/<app>/.env` (falling back to `.env` in the working directory), so this works with `nx serve` from the workspace root.

### 4. Create schemas and seed data

```
git lfs install && git lfs pull   # once: the exam media in scripts/eng-media is stored with Git LFS
pnpm db:setup                     # or: pnpm db:setup --no-seed
pnpm db:setup --reset             # drop all local data and seed from scratch
```

For every service this generates the Prisma client, applies migrations (`migrate deploy`, or `db push` for services without migrations), and runs the seed. It is safe to re-run. `--reset` instead drops every service's data first (`migrate reset` / `db push --force-reset`); it refuses non-local database hosts unless `DB_SETUP_ALLOW_REMOTE_RESET=1`.

Before seeding it builds the media the seeds reference (`scripts/dev-media/generate.mjs`) into `apps/file-service/eng-media/` (generated, git-ignored) and uploads it to MinIO's `public` bucket:

- the real TOEIC/IELTS audio and scans come from `scripts/eng-media/<exam>/{audio,images}/` (Git LFS; add new media there, named by the `fileId` the seed uses);
- any referenced file without real media gets a labelled placeholder (ffmpeg/espeak-ng when installed), and so does a file that is still an LFS pointer because `git lfs pull` wasn't run;
- outputs that are no longer referenced are deleted, locally and from the bucket (`SYSTEM_*` objects only).

Seeded login: `admin@gmail.com` / `admin` (plus test users, see `apps/auth/prisma/seed.ts`).

### 5. Start the development servers

```
nx run-many -t serve
```

Or start individual services:

```
nx serve gateway
nx serve auth
```

The gateway will be available at `http://localhost:3000`, with interactive API docs at `http://localhost:3000/reference`. Point the frontend's `NEXT_PUBLIC_API_URL` at it.

## Demo account

The seed creates a shared account for public testers: `demo@lingriser.test` / `Demo@12345` (student role). These credentials are public by design.

Because everyone shares it, the account can't change its password, add or remove sign-in methods, change its username or phone number, log out every session (`/auth/logout-all`) or connect Google Calendar; those requests get 403. Full name, bio and avatar stay editable. `GET /api/v1/auth/my/identity` returns `isDemo: true` so the frontend can hide those controls. Re-running the auth seed (`pnpm db:setup`) restores its password.

So the app looks used when testers sign in, the other seeds give the account (user id `demo`) some history:

| Service      | What the demo account gets                                                                                                                                                                                                                                                                                                                          | Seed                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| exam         | 15 submitted attempts over the last five weeks (IELTS Listening/Reading/Writing, TOEIC LR, grammar), scores trending up, a 4-day practice streak up to the seed day, real answers to the seeded questions (the writing one with AI-style feedback, band 6.0); one unfinished TOEIC LR 2 attempt started just before the seed ran; an IELTS 7.0 goal | `apps/exam/prisma/seed/attempt-plans.ts`, `goals.ts`       |
| achievement  | attempt and login counters to match (15 attempts, 3 scores of 80 %+, 26 login days, current streak up to yesterday) and the 5 badges those earn                                                                                                                                                                                                     | `apps/achievement/prisma/seed.ts`                          |
| notification | the "badge earned" notifications for those badges                                                                                                                                                                                                                                                                                                   | `apps/notification/prisma/seed.ts`                         |
| resource     | 3 own flashcard lists (15 cards), a forum reply and a blog comment                                                                                                                                                                                                                                                                                  | `apps/resource/prisma/seed/demo-flashcards.ts`, `forum.ts` |

Seeded attempts have ids `seed-attempt-*`. Each run replaces them with fresh dates (so the open attempt is again within its 2-hour limit), respecting the attempt rule: per user and exam, at most one unfinished attempt, numbered after the submitted ones. A user/exam pair that also has attempts someone really made is left alone. Counters, goal, lists and notifications are only added or raised, never reset, so what testers did on the account is kept. Run the authorization seed after the resource seed so the demo lists get their ownership rows.

## JWT / RSA Keys (Important)

Since the auth service signs tokens with **RS256**, you must generate an **RSA key pair** and provide the **private key** to the auth service and the **public key** to the gateway.

Generate a new key pair (macOS/Linux/WSL, or use an online/`openssl` tool on Windows):

```
# Private key (PEM)
openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048

# Public key derived from the private key (PEM)
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
```

Paste the **entire contents** of the PEM files into your env (a PEM file includes the `-----BEGIN ... KEY-----` / `-----END ... KEY-----` lines; keep them and the newlines intact).

- `apps/auth/.env`:
  ```
  JWT_PRIVATE_KEY="<contents of jwt_private.pem>"
  ```
- `apps/gateway/.env` (and the shared `docker/.env.services`):
  ```
  JWT_PUBLIC_KEY="<contents of jwt_public.pem>"
  ```

Keep the double quotes so the multi-line value survives `.env` parsing.

> Security: keep the private key out of source control and only in the auth service's environment. The gateway (and any token validator) should only ever receive the public key.

## Environment Variables

### Auth service (`apps/auth/.env.example`)

- `NODE_ENV`, `PORT`, `HOST`
- `POSTGRES_*` — database connection
- `REDIS_*` — Redis connection
- `RMQ_*` — RabbitMQ connection
- `FILE_SERVICE_HOST` / `FILE_SERVICE_PORT` — file service location
- `JWT_PRIVATE_KEY` — RSA private key for **signing** tokens
- `JWT_ACCESS_TOKEN_EXPIRATION` (default 15 min) / `JWT_REFRESH_TOKEN_EXPIRATION` (default 7 days)
- `GOOGLE_OA2_CLIENT_ID` / `GOOGLE_OA2_CLIENT_SECRET`
- `POSTGRES_URL` — optional full connection string; when unset it is assembled from the `POSTGRES_*` values

### File service (`apps/file-service/.env.example`)

- `MINIO_HOST` / `MINIO_PORT` / `MINIO_USER` / `MINIO_PASSWORD` — object storage
- `MINIO_USE_SSL` — TLS to MinIO (default: on only when `NODE_ENV=production`)
- `MINIO_PUBLIC_URL` — browser-facing MinIO address: base of public file links, and the host presigned upload/download URLs are signed for. Set it whenever `MINIO_HOST` is an internal name (e.g. `min-io` in docker). Default: `http(s)://MINIO_HOST:MINIO_PORT`

### Mock AI scorer (`apps/mock-ai-scorer/.env.example`)

Dev stand-in for the external AI writing scorer. It consumes `exam.writing.submitted` and, after a random delay, publishes `exam.writing.scored` with random IELTS bands (4.0-8.5 in 0.5 steps, no real AI, feedback text says it is a mock). It has no database and no gRPC API.

- `RMQ_HOST`, `RMQ_PORT`, `RMQ_USER`, `RMQ_PASS` — RabbitMQ, same as the other apps
- `MOCK_SCORER_MIN_DELAY_MS` / `MOCK_SCORER_MAX_DELAY_MS` — uniform random delay per submission (defaults `60000` / `180000`, i.e. 1-3 minutes; min must be <= max)
- `HOST`, `HEALTH_PORT` — bind address and port for `/health/live` and `/health/ready`

Run it with `nx serve mock-ai-scorer` (also started by `nx run-many -t serve`), or in Docker with `docker compose --profile mock-ai up`. **Do not run it next to the real AI scorer** (profile `ai`, below): both would consume `exam.writing.submitted` and race to score each submission.

### Real AI scorer (Docker profile `ai`)

Two containers in `docker/docker-compose.app.yaml`, started with `docker compose --profile ai up -d`:

- `ai-llm`: [llama.cpp server](https://github.com/ggml-org/llama.cpp) running the fine-tuned model [`linhma139/Phi-3-IELTS-Scorer`](https://huggingface.co/linhma139/Phi-3-IELTS-Scorer) (Phi-3-mini, Q4_K_M GGUF, 2.2 GB, downloaded into the `ai-models` volume on first start). CPU only, one essay at a time: about 1-2 minutes per essay on 8 threads. `AI_LLM_THREADS` and `AI_LLM_CPUS` (default 8) tune it. Answers are capped at 512 tokens with a mild repetition penalty, because the model otherwise repeats its feedback until the scorer's 1024-token limit.
- `ai-scorer`: the Python worker from [`linhma139/ai-language-evaluator`](https://github.com/linhma139/ai-language-evaluator), built from a pinned commit (`docker/ai-scorer/Dockerfile`, build arg `EVALUATOR_REF`). It consumes `exam.writing.submitted` from its own queue `writing.evaluate` (dead letters: `writing.evaluate.dlq`), sends the essay to `ai-llm` and publishes `exam.writing.scored`. Essays under the IELTS minimum word counts are scored by its word-count rules without the model.

Switching from the mock: stop `mock-ai-scorer` **and delete its queues** (`mock-ai-scorer.writing.submitted`, `.retry.1-5`, `.dlq`). The queue is durable and stays bound to `exam.writing.submitted`, so it keeps collecting submissions, and a restarted mock would overwrite the real feedback with random scores.

Local fixes on top of upstream are applied at build time from `docker/ai-scorer/patches/` (see its README); the build runs their tests. The main one: upstream saved essays as **band 0** whenever the model wrote its score in another format (`Scoring: 8.0`). The patched worker reads those formats, asks the model again when it finds no band, and reports `LLM_PARSE_ERROR` instead of a fake 0; a real band 0 is still reported. Still missing upstream: `corrected_version` and `corrections` are always empty.

### Gateway (`apps/gateway/.env.example`)

- `NODE_ENV`, `PORT`, `HOST`, `BASE_URL`, `FE_LOGIN_REDIRECT_URL`
- `JWT_PUBLIC_KEY` — RSA public key for **verifying** tokens
- `*_SERVICE_HOST` / `*_SERVICE_PORT` (and optional `*_SERVICE_URL`) — gRPC service discovery for `auth`, `authorization`, `exam`, `file`, `achievement`, `live`, `notification`, `resource`
- `GOOGLE_OA2_CLIENT_ID` / `GOOGLE_OA2_CLIENT_SECRET`

## Running with Docker (Full Stack)

The Docker setup builds each app separately and adds **Envoy** sidecars so each gRPC service is reachable over HTTP.

1. Configure infrastructure + service env:

   ```
   cp docker/.env.example docker/.env
   cp docker/.env.services.example docker/.env.services   # fill in, incl. JWT_PRIVATE_KEY & JWT_PUBLIC_KEY
   ```

   Schemas and seed data are not applied by the containers; run `pnpm db:setup` from the host against the published Postgres port (step 4 above).

2. Build & start everything:
   ```
   docker compose -f docker/docker-compose.yaml --env-file docker/.env up --build
   ```

This brings up the database infrastructure, all application services, and the Envoy sidecars (ports defined in `docker/.env.example`, e.g. gateway `8080`, auth `8081`, exam `8082`, achievement `8083`, resource `8084`, notification `8085`/`8095`, file `8086`, live `8087`/`8088`).

Upgrading an existing environment? Follow [docs/operations/upgrade-notes.md](docs/operations/upgrade-notes.md) (deploy order, migrations, queues to recreate, new env vars).

## Observability

Every app exports traces, metrics, and logs over OTLP and serves `/health/live` and `/health/ready`. A local Grafana stack with a platform status dashboard and alerts runs separately from the app stack:

```
docker compose -f docker/docker-compose.observability.yaml up -d
```

Grafana is at http://localhost:3001 (`admin` / `admin`). Set `OTEL_SDK_DISABLED=true` to turn telemetry off. See [docs/operations/observability.md](docs/operations/observability.md) for ports, health endpoints, metrics, and alert runbooks.

## Regenerating gRPC Code

Protobuf contracts live in `proto/`. After editing them, regenerate the client/server code:

```
nx run generated:generate          # runs `pnpm proto:gen` (Windows: `pnpm proto:gen:window`)
```

The generated code is written to `libs/generated/src`.

## Common Commands

| Command                        | Description                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `pnpm install`                 | Install workspace dependencies                                                                 |
| `pnpm db:setup`                | Migrate + seed every service database (and upload exam media); `--reset` to start from scratch |
| `nx run-many -t serve`         | Run all services in dev mode                                                                   |
| `nx serve <app>`               | Run a single app in dev mode (e.g. `nx serve gateway`)                                         |
| `nx run <app>:build`           | Build an app (e.g. `nx run auth:build`)                                                        |
| `nx run <app>:test`            | Run tests for an app                                                                           |
| `nx run <app>:lint`            | Lint an app                                                                                    |
| `nx run <app>:prisma:generate` | Generate the Prisma client                                                                     |
| `nx run <app>:prisma:push`     | Push the Prisma schema to the DB                                                               |
| `nx run <app>:prisma:migrate`  | Run Prisma migrations                                                                          |
| `nx run <app>:prisma:seed`     | Seed the database                                                                              |
| `nx run generated:generate`    | Regenerate gRPC code from `proto/`                                                             |
| `nx graph`                     | Visualize the project dependency graph                                                         |

Use `nx show project <name>` to see every available target for a given project.

## Code Style & Quality

- ESLint + Prettier are configured at the repo root.
- Run `nx run <app>:lint` to lint an app, or `pnpm eslint <path>` to lint a specific path.
- Jest is configured per project (`nx run <app>:test`).
