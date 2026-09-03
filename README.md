# English Application Server

A microservices-based backend for an English-learning application, built with **NestJS**, **gRPC** (protobuf), **RabbitMQ**, **Redis**, **PostgreSQL**, and **MinIO**. The system is composed of a single HTTP **gateway** that fans out to multiple **gRPC microservices**, each handling its own domain.

## Architecture

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

| Env var | Used by | Purpose |
| --- | --- | --- |
| `JWT_PRIVATE_KEY` | auth service | Private key used to **sign** access & refresh tokens (RS256) |
| `JWT_PUBLIC_KEY` | gateway | Public key used to **verify** access & refresh tokens (RS256) |

## Tech Stack

- **Language / Runtime:** TypeScript, Node.js (`node:24-alpine` in Docker)
- **Framework:** NestJS 11
- **Monorepo:** Nx + pnpm workspaces
- **Communication:** gRPC (protobuf, generated via `ts-proto`), RabbitMQ (CQRS/events), Socket.IO (websockets)
- **Data:** PostgreSQL (Prisma ORM), Redis (caching / tokens / pub-sub)
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

| App | gRPC services | Responsibility |
| --- | --- | --- |
| `gateway` | — (HTTP) | API routing, JWT verification, role/permission guards, docs |
| `auth` | `AuthService` | Registration/login (mail & Google), token issuance & refresh, roles/permissions, identity management, Google Calendar linking |
| `authorization` | `AuthorizationService` | Ownership registration/checking (`is owner?`) for resources |
| `exam` | `ExamManagementService`, `ExamPracticeService`, `TagService`, `GoalService` | Create/manage exams, sections & questions; answer attempts, stats, tags, user goals |
| `achievement` | `AchievementService` | Badges catalog, user badges, login/submission progress |
| `resource` | `BlogService`, `FlashCardService`, `FlashCardListService`, `ReportService` | Blogs, flash cards (and lists), moderation reports |
| `file-service` | `FileService` | Presigned upload/download URLs, file metadata (MinIO) |
| `live` | `ChatService` | Chat rooms, chat logs, room scheduling, bans; Socket.IO real-time |
| `notification` | `NotificationService`, `NotificationPreferencesService` | Create/list notifications, mark read, preferences; SSE streaming |

### Libraries (libs)

| Lib | Purpose |
| --- | --- |
| `@server/generated` | Auto-generated gRPC types/clients from `proto/*.proto` |
| `@server/database` | Prisma/PostgreSQL module utilities |
| `@server/logger` | Shared Winston logger integration |
| `@server/utils` | Validation pipes, exception filters, interceptors, shared types & schemas |
| `@server/typing` | Reusable TypeScript utility types |

## Prerequisites

- **Node.js** 20+ (see `.nvmrc`)
- **pnpm** (the workspace is pnpm-only — `corepack` is recommended)
- **Docker** (optional — required to run the dev infrastructure: Postgres, Redis, RabbitMQ, MinIO) and `docker compose`
- **protoc** (only if regenerating gRPC code)
- **Nx CLI** (installed via `npx` / workspace)

## Getting Started (Local Development)

### 1. Start the infrastructure

The repo contains `docker-compose` files under `docker/`. Note that the application **Dockerfile builds are not required for local dev** — you only need the infrastructure services.

```
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.db.yaml --env-file docker/.env up -d
```

This starts **PostgreSQL, Redis, Adminer, MinIO, and RabbitMQ**. You can start everything (including app containers and Envoy sidecars — see Docker section below) with `docker compose -f docker/docker-compose.yaml up`.

### 2. Install dependencies

```
pnpm install
```

### 3. Generate the database client

```
nx run auth:prisma:generate
```

### 4. Set up environment variables

Copy the relevant `.env.example` files and fill in the values (see the **JWT / RSA keys** section below, which is required).

```
cp apps/auth/.env.example apps/auth/.env
cp apps/gateway/.env.example apps/gateway/.env
```

(Other apps have their own `.env.example` files as needed. App containers read a shared `docker/.env.services` — see Docker section.)

### 5. Run the database migration / push

To sync the Prisma schema to a running Postgres instance:

```
nx run auth:prisma:push
```

### 6. Start the development servers

```
nx run-many -t serve
```

Or start individual services:

```
nx serve gateway
nx serve auth
```

The gateway will be available at `http://localhost:3000`, with interactive API docs at `http://localhost:3000/reference`.

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
  JWT_PRIVATE_KEY=<contents of jwt_private.pem>
  ```
- `apps/gateway/.env` (and the shared `docker/.env.services`):
  ```
  JWT_PUBLIC_KEY=<contents of jwt_public.pem>
  ```

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
- `POSTGRES_URL` — full connection string used by Prisma

### Gateway (`apps/gateway/.env.example`)

- `NODE_ENV`, `PORT`, `HOST`, `BASE_URL`, `FE_LOGIN_REDIRECT_URL`
- `JWT_PUBLIC_KEY` — RSA public key for **verifying** tokens
- `*_SERVICE_HOST` / `*_SERVICE_PORT` (and optional `*_SERVICE_URL`) — gRPC service discovery for `auth`, `exam`, `file`, `achievement`, `live`, `notification`, `resource`
- `GOOGLE_OA2_CLIENT_ID` / `GOOGLE_OA2_CLIENT_SECRET`

## Running with Docker (Full Stack)

The Docker setup builds each app separately and adds **Envoy** sidecars so each gRPC service is reachable over HTTP.

1. Configure infrastructure + service env:
   ```
   cp docker/.env.example docker/.env
   cp docker/.env.services.example docker/.env.services   # fill in, incl. JWT_PRIVATE_KEY & JWT_PUBLIC_KEY
   ```

2. Build & start everything:
   ```
   docker compose -f docker/docker-compose.yaml --env-file docker/.env up --build
   ```

This brings up the database infrastructure, all application services, and the Envoy sidecars (ports defined in `docker/.env.example`, e.g. gateway `8080`, auth `8081`, exam `8082`, achievement `8083`, resource `8084`, notification `8085`/`8095`, file `8086`, live `8087`/`8088`).

## Regenerating gRPC Code

Protobuf contracts live in `proto/`. After editing them, regenerate the client/server code:

```
nx run generated:generate          # or the OS-specific variant in package.json
```

The generated code is written to `libs/generated/src`.

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `nx run-many -t serve` | Run all services in dev mode |
| `nx serve <app>` | Run a single app in dev mode (e.g. `nx serve gateway`) |
| `nx run <app>:build` | Build an app (e.g. `nx run auth:build`) |
| `nx run <app>:test` | Run tests for an app |
| `nx run <app>:lint` | Lint an app |
| `nx run <app>:prisma:generate` | Generate the Prisma client |
| `nx run <app>:prisma:push` | Push the Prisma schema to the DB |
| `nx run <app>:prisma:migrate` | Run Prisma migrations |
| `nx run <app>:prisma:seed` | Seed the database |
| `nx run generated:generate` | Regenerate gRPC code from `proto/` |
| `nx graph` | Visualize the project dependency graph |

Use `nx show project <name>` to see every available target for a given project.

## Code Style & Quality

- ESLint + Prettier are configured at the repo root.
- Run `nx run <app>:lint` to lint an app, or `pnpm eslint <path>` to lint a specific path.
- Jest is configured per project (`nx run <app>:test`).
