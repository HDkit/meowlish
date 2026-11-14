# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, opencode, …) working in this repo.
Read it before changing anything. Human-facing setup docs live in `README.md`.
Architecture overview: `docs/architecture/README.md`. What each operation does internally (gRPC, tables, events, consumers): `docs/architecture/flows/`. When you change an operation's flow, update its section there.

## What this is

Backend for an English-learning app: an Nx + pnpm monorepo of NestJS 11 microservices.

- `apps/gateway` — the only HTTP entry point (`/api/v1/*`, docs at `/reference`). Verifies JWTs (RS256 public key), applies role/permission guards, and forwards calls to services over gRPC.
- `apps/{auth,authorization,exam,achievement,resource,file-service,live,notification}` — gRPC microservices, one Postgres database each (Prisma). They exchange events over RabbitMQ.
- `libs/generated` (`@server/generated`) — code generated from `proto/*.proto`. **Never hand-edit.**
- `libs/utils` (`@server/utils`) — shared pipes, filters, interceptors, DTOs, CQRS base classes, RMQ config.
- `libs/database`, `libs/logger`, `libs/typing` — Prisma helpers, Winston logger, utility types and shared enums (e.g. `Role`).

## Known issues

Check `docs/backlog.md` before working on a service: it lists open security and correctness issues. When you fix one, delete its entry in the same commit.

## Tooling rules

- **pnpm only** (`preinstall` enforces it). The version comes from `package.json` `packageManager`. Don't pin pnpm anywhere else: CI's `pnpm/action-setup` reads `packageManager` and fails if a second version is set.
- Run tasks through Nx: `pnpm exec nx run <project>:<target>`, or `nx run-many -t <target>`. Common targets are `lint`, `test`, `build`, `serve`, `prisma:generate`, `prisma:migrate`, and `prisma:seed`. Use `nx show project <name>` to list them all.
- Node 24 (`.nvmrc`; CI uses 24.13.0).
- Dependencies are pinned to **exact versions** in the root `package.json`. Each lib's `package.json` must list ranges that match what is installed: `@nx/dependency-checks` fails lint otherwise. After bumping deps, run `nx run-many -t lint -- --fix` to sync them.
- Don't run `pnpm dlx`/`npx` installers or add dependencies without saying so. If you add one, use an exact version.

## Before you finish (must pass, same as CI)

```sh
pnpm install --frozen-lockfile
pnpm exec nx run-many -t prisma:generate   # Prisma clients are needed for typecheck/lint
pnpm exec nx run-many -t lint
pnpm exec nx run-many -t test
pnpm exec nx run-many -t build
```

To check only what you touched, use `nx affected -t lint test build`. The Husky pre-commit hook runs `nx affected -t format, lint` and `nx affected -t test`. Don't bypass it with `--no-verify`.

## Formatting (Prettier, enforced by ESLint)

- **Tabs** for indentation (YAML/Markdown excepted), single quotes, semicolons, trailing commas, print width 100, `arrowParens: avoid` (`x => x`), LF line endings.
- Imports are sorted automatically by `@trivago/prettier-plugin-sort-imports`. Relative imports come first, then packages. Don't hand-order them; run `eslint --fix` or Prettier.
- Run `pnpm exec eslint --fix <path>` and let it format rather than formatting by hand.

## Lint rules worth knowing

The config is in `eslint.config.mjs` and uses `typescript-eslint` `recommendedTypeChecked`, `@darraghor/eslint-plugin-nestjs-typed`, and `perfectionist`.

- **Decorator order is enforced** (`perfectionist/sort-decorators`). Groups go in this order: `Version` → HTTP method (`Get`/`Post`/…) → `UseGuards` → `UseInterceptors` → `UsePipes` → `UseFilters` → class-transformer (`Expose`, `Type`, …) → class-validator (`Is*`, `Min*`, …) → `UseCls` → everything else → `Module` → `Controller` → `Injectable`. Decorators within a group are alphabetical. `--fix` reorders them.
- `object-shorthand: never`. Write `{ id: id }`, not `{ id }`.
- No `console.log`. Use the logger (`@server/logger`); `console.warn`/`console.error` are allowed.
- No unnecessary type assertions (`no-unnecessary-type-assertion`), no inferrable type annotations, no empty functions.
- `@nx/enforce-module-boundaries`: import libs through their `@server/*` alias, never through relative paths into `libs/`.
- `any` is allowed but avoid it. Floating promises and non-null assertions produce warnings, so don't add new ones.

## Typing conventions

- `strict: true`, `module`/`moduleResolution: nodenext`, decorators with metadata enabled.
- Annotate return types explicitly on service, handler, repository, and service-side gRPC controller methods (`Promise<AddedTagDto>`, `Promise<void>`). Gateway controller methods may infer them from the gRPC client call. Let local variables infer.
- DTO and entity fields that are always set use the definite-assignment `!` (`name!: string;`). Optional fields use `?`. Don't add `| undefined` noise.
- Use `import { type X }` for type-only imports of interfaces (e.g. repository interfaces).
- Avoid `as` casts. Shape objects so they satisfy the target type (a DTO that `implements` the generated message). A cast is acceptable only on an untyped boundary, e.g. `JSON.parse(json) as T`. The `no-unnecessary-type-assertion` rule removes redundant ones.
- Prefer `unknown` over `any` for untrusted input. Narrow it with zod or class-validator.
- **Enums:** use string enums with PascalCase members and UPPER_CASE values (`Approved = 'APPROVED'`).
  - Enums shared across services (`Role`, `Permission`, `SortDirection`) live in `@server/typing`.
  - Service-local enums go in `apps/<svc>/src/enums/*.enum.ts`.
  - Don't redefine an enum that already exists.
- Generic helpers go in `@server/typing` (`DeepPartial`, `DeepStringify`, `Complete`). Check there before writing a new one.
- Prisma clients are generated per service and imported as `@prisma-client/<service>` (e.g. `import { PrismaClient } from '@prisma-client/exam'`). Prisma model types stay in `infra/`; map them to domain entities or read models before they leave the repository.
- Zod is imported from `zod/v4`.

## Generated gRPC types (`@server/generated`)

Generated message types (`exam.AddTagDto`, `resource.CreateBlogRequest`, …) are the **wire contract**, not app types. Rules:

- **DTOs are the only place generated message types appear.** A DTO class, in a service or in the gateway, may (and should, when one exists) `implements` the generated interface. The compiler and IDE then keep it in sync with the proto and autocomplete its fields, and the DTO adds validation, serialization, and OpenAPI decorators on top:

  ```ts
  export class AddTagDto implements exam.AddTagDto {
  	@IsOptional()
  	@IsString()
  	parentId?: string;

  	@IsString()
  	name!: string;
  }
  ```

- Everywhere else, in controllers' `@Payload()`/`@Body()` parameters, return types, services, handlers, and domain code, use the DTO, a domain entity, or a read model. Never write `@Body() body: Omit<resource.X, 'id'>`: a plain interface carries no validation and produces no OpenAPI schema. Create a DTO instead (use `OmitType`/`PickType` from `@nestjs/swagger` to derive variants).
- **Allowed direct uses**: gRPC plumbing that has no DTO equivalent.
  - `<pkg>.X_SERVICE_NAME` and `<pkg>.XServiceService` (definitions) in `main.ts` and `ClientsModule`/router modules.
  - `<pkg>.XServiceClient` as the type of `client.getService<…>()` in gateway controllers, guards, strategies, and in query handlers that call another service (e.g. `file.FileServiceClient` in `auth`/`exam`).
  - `<pkg>.XServiceController` plus the `@<pkg>.XServiceControllerMethods()` decorator on a service's gRPC controller.
  - Internal values that only pass between gateway pieces and never become a request or response body, e.g. `auth.Tokens` between the Google OAuth strategy and its callback.
- When a route takes IDs from the path, the body DTO implements `Omit<pkg.XRequest, 'idField'>`. Use the camelCase field name from the generated interface, not the proto's snake_case.
- Don't cast the object you pass to a gRPC client (`as pkg.XRequest`). A cast there usually hides a real mismatch, such as a `string` where the proto expects a `Date`. Fix the DTO instead.

## DTOs

- Location: `presentation/dtos/{req,res}/<feature>/` in services and `<domain>-gateway/dtos/{req,res}/<feature>/` in the gateway. Names follow `<action>-<thing>.req.dto.ts` / `<thing>.res.dto.ts`.
- **Request DTOs** use class-validator (`@IsString()`, `@IsOptional()`, `@IsInt()`, …) on every field, and `@Type(() => X)` + `@ValidateNested()` for nested objects. Extend `OffsetPaginationDto` / `CursorPaginationDto` from `@server/utils` for paginated lists instead of redeclaring `page`/`limit`/`sortBy`.
- **Response DTOs** mark every field `@Expose()`. Responses are serialized through `@SerializeOptions({ type: ResDto })`, which strips anything not exposed. Use `strategy: 'exposeAll'` only for deeply nested read models.
- **Gateway DTOs** also carry OpenAPI decorators (see below). Service-side DTOs don't need them.

## API documentation (OpenAPI / Scalar at `/reference`)

The gateway builds the document from decorators. Every HTTP route must be fully documented:

- Controller: `@ApiTags('<Group>')`, and `@ApiBearerAuth()` unless every route is `@IsPublic()`.
- Route: `@ApiOperation({ summary: '…' })`.
- **Responses: use the custom decorators from `@server/utils`, not raw `@ApiOkResponse`.**
  - `@ApiResponseEntity(ResDto)` wraps `ResDto` in the standard `ResponseEntity` envelope (`path`, `statusCode`, `success`, `timestamp`, `error`, `data`), which is what the response interceptor actually returns.
  - `@ApiEmptyResponseEntity()` is for routes that return no data (`data: null`).
  - If you need a new response shape (e.g. paginated lists), add another custom decorator in `libs/utils/src/decorators/` and export it from the index, rather than writing inline schemas in controllers.
- DTO fields: `@ApiProperty()` for required fields, `@ApiPropertyOptional()` for optional ones. Pass `enum`, `type: [X]` for arrays, and `example`/`description` where the meaning isn't obvious.
- Order decorators as `perfectionist/sort-decorators` requires (method → guards → … → `Api*`). `eslint --fix` sorts them.
- Auth metadata decorators live in `apps/gateway/src/auth/decorators/`: `@IsPublic()`, `@HasRoles(...)`, `@HasPermissions(...)`, `@ResourceAccess({ resourceType, resourceIdParam, rules })`. Use them; don't read metadata or check roles by hand in controllers.

## Configuration files

Root:

| File                                                  | Purpose                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `package.json`                                        | Exact-pinned deps, `packageManager`, `proto:gen` and `db:setup` scripts                                          |
| `pnpm-workspace.yaml`, `.npmrc`                       | Workspace and pnpm settings                                                                                      |
| `nx.json`                                             | Nx plugins that infer `build`/`serve` (webpack), `lint` (eslint), and `test` (jest) targets; `defaultBase: main` |
| `tsconfig.base.json`                                  | Compiler options and the `@server/*` / `@prisma-client/*` path aliases. Add a new lib's alias here               |
| `eslint.config.mjs`, `.prettierrc`, `.prettierignore` | Lint and format rules (see above)                                                                                |
| `jest.preset.js`, `jest.config.ts`                    | Shared Jest preset                                                                                               |
| `knip.json`                                           | Unused file and export detection (`pnpm knip`)                                                                   |
| `.husky/pre-commit`                                   | Runs affected format, lint, and test                                                                             |
| `.github/workflows/*.yml`                             | CI: install → prisma generate → lint → test → build                                                              |
| `docker/`                                             | Compose stacks, Dockerfile, Envoy configs, `.env*.example`                                                       |
| `docker/docker-compose.observability.yaml`            | Grafana LGTM stack (OTLP ingest on 4317/4318); see `docs/operations/observability.md`                            |
| `docker/observability/`                               | Provisioned Grafana dashboards (`dashboards/`) and alert rules (`alerting/`)                                     |

Per app (`apps/<svc>/`):

| File                                                         | Purpose                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `project.json`                                               | Nx project. Defines explicit `prisma:*` targets, and other targets are inferred                               |
| `webpack.config.js`                                          | `NxAppWebpackPlugin` with the swc compiler and output to `dist/apps/<svc>`                                    |
| `.swcrc`                                                     | swc transpile options (decorators on, es2023)                                                                 |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` | Extend `tsconfig.base.json`                                                                                   |
| `eslint.config.mjs`                                          | Extends the root config and points `parserOptions.project` at the app's tsconfigs                             |
| `jest.config.ts`                                             | Jest config. Must be `.ts`/`.js`: Jest 29 ignores `jest.config.cts` and silently falls back to Babel defaults |
| `prisma.config.ts`                                           | Prisma schema folder, migrations path, seed command                                                           |
| `.env.example`                                               | Every env var the app reads, with working local values. The real `.env` is gitignored                         |
| `.nvmrc`                                                     | Node version                                                                                                  |

Libs (`libs/<lib>/`) have `project.json` (`@nx/js:tsc` build), `package.json` (deps checked by `@nx/dependency-checks`), and `tsconfig.lib.json`.

Runtime config pattern (`apps/<svc>/src/configs/config.ts`):

1. A zod `envFileSchema` describes the typed config, and `IEnvVars = z.infer<typeof envFileSchema>`.
2. `loadEnv(): DeepStringify<IEnvVars>` maps `process.env.*` onto that shape.
3. `config()` parses it, so the app fails fast on bad env.
4. The module registers `ConfigModule.forRoot({ load: [config], envFilePath: ['apps/<svc>/.env', '.env'] })`.
5. Consumers inject `ConfigService<IEnvVars>`. In new code, read config only through it, so every variable is validated by the schema.

Existing code also reads `process.env` directly in a few places: `PORT`/`HOST` in `bootstrap.ts`, gRPC/RMQ client registration in `*.module.ts` / `*.router.module.ts`, and some query handlers. Don't add more. If you touch one of these spots, move it to `ConfigService` (for client modules, use `registerAsync` with `inject: [ConfigService]`).

To add a variable, update the schema, `loadEnv`, and `.env.example`, plus `docker/.env.services.example` if Docker needs it.

## Service architecture (DDD + CQRS, follow existing layout)

Each microservice under `apps/<svc>/src/` is layered like this:

```
presentation/   controllers (gRPC handlers) + dtos/req, dtos/res
app/            commands/, queries/ (+ handlers/), events/ (+ handlers/, publishers/), services/
domain/         entities/, repositories/ (interfaces + DI tokens), read-models/, events/
infra/          repositories/*.prisma.repository.impl.ts
configs/        config.ts (zod env schema), rmq/bullmq configs
test/           *.spec.ts, mirroring the folders above (no specs next to the source)
```

- **Tests** live in `src/test/`, at the same path as the code they test: `src/app/services/blog.service.ts` → `src/test/app/services/blog.service.spec.ts`. Import the code under test by relative path. `tsconfig.app.json` excludes `src/test/**`, so test helpers never reach the build. (Libs keep their specs next to the source.)
- **Dependencies point inward.** `domain` imports nothing from `app`, `infra`, or `presentation`.
- **Repositories:** the interface and its token live together in `domain/repositories/<name>.repository.ts` as `export interface IXRepository` and `export const IXRepositoryToken = Symbol('IXRepository')`. The implementation goes in `infra/repositories/<name>.prisma.repository.impl.ts`. Inject with `@Inject(IXRepositoryToken) private readonly xRepository: IXRepository`.
- Read-side queries use separate `*.read.repository.ts` interfaces that return `domain/read-models`.
- Use `TransactionHost<TransactionalAdapterPrisma<PrismaClient>>` (`@nestjs-cls/transactional`) for DB access and transactions. Don't create a `PrismaClient` directly.
- **CQRS:** commands and queries extend the base classes in `@server/utils`. Handlers use `@CommandHandler(X)` / `@QueryHandler(X)` and implement `ICommandHandler<X>`, then load the aggregate, call its domain method, and save it.
- **gRPC controllers** use `@UseFilters(GlobalRpcExceptionFilter)`, the generated `@<pkg>.XServiceControllerMethods()` decorator, and `@Controller()`, and they `implements <pkg>.XServiceController`. Shape responses with `@SerializeOptions({ type: ResDto })`.
- **Errors:** throw Nest exceptions (`NotFoundException`, …). The shared RPC/HTTP filters translate them across gRPC.
- **Config:** each service validates env with a zod schema in `configs/config.ts`. Add new env vars there and to that app's `.env.example`.
- **Entry point and health:** new apps must use the `main.ts` → `bootstrap.ts` split (`main.ts` calls `startTelemetry({ serviceName })` from `@server/telemetry`, then `void import('./bootstrap.js')`) and import `HealthModule.forRoot({ serviceName, ... })` in the app module. Also add a healthcheck in `docker/docker-compose.app.yaml` and a `ServiceMissing` rule in `docker/observability/alerting/platform.yaml`.
- **Messaging:** publish events only through `OutboxPublisher.add` inside `@Transactional()`, never straight to the broker. Consumers use `@UseCls()` + `@Transactional()`, define their queue once with `defineConsumerQueue(name, opts?)`, read the payload with `unwrapEvent` (and validate it), and call `InboxService.claim(eventId, consumer)` first so redeliveries are skipped. Consumers must not swallow errors: let them propagate. Spread `...q.subscribe` into `@RabbitSubscribe` and `...q.queues` into the app's sub config `queues`, and pass `q.name` to the inbox: both come from the one definition, so the retry options can't drift. A failure is retried with exponential backoff (1, 2, 4, 8, 16 s, max 5 retries, capped at 60 s) through `<q>.retry.N` queues that redeliver only to `<q>` (never back through `eventbus`), then dead-letters to `<q>.dlq`; if the retry publish itself fails, the message is requeued after a 1-2 s pause. Handlers must therefore be safe to run again (the inbox claim covers enveloped events).

### Gateway conventions

- One `<domain>-gateway/` folder per service, containing `*.router.controller.ts`, `*.router.module.ts`, `constants/` (client tokens such as `EXAM_CLIENT`), and `dtos/`.
- Get gRPC clients in `onModuleInit` via `client.getService<pkg.XServiceClient>(pkg.X_SERVICE_NAME)`.
- Controllers stay thin: validate with a DTO, call the gRPC client, and return the result. Business logic belongs in the service.
- Every route is documented (see **API documentation**).
- Auth is on by default. Use `@IsPublic()` to open a route, and `@HasRoles(Role.X, …)` (from `@server/typing`) to restrict one.
- **Session tokens travel in cookies.** Login, register, `/auth/refresh` and `POST /auth/google/tokens` (JSON body only) set HttpOnly `access_token` (`Path=/`) and `refresh_token` (`Path=/api/v1/auth`) cookies (`SameSite=Lax`, `Secure` on HTTPS or in production, `Max-Age` from each token's `exp`) and return `data: null`; `/auth/logout` and `/auth/logout-all` clear them (`apps/gateway/src/auth-gateway/auth-cookies.ts`). The JWT strategies and the live socket handshake read the cookie first and fall back to `Authorization: Bearer`. Never return tokens in a response body.
  - **Deployment: the browser talks only to the frontend origin.** The frontend proxies `/api/*` and `/socket.io/*` to the gateway, so the cookies are first-party on the frontend host and the API host may be on any site. Calling a cross-site API host directly from the browser isn't supported (third-party cookies). `TRUST_PROXY` counts only proxies that append to `X-Forwarded-For`; Next's rewrite proxy doesn't (see `docs/operations/upgrade-notes.md`).
  - Routes that set or clear these cookies carry `@UseGuards(CookieIssuanceGuard)` (login-CSRF / forced-logout guard): `Sec-Fetch-Site: cross-site`, or an `Origin` that is neither in `CORS_ORIGINS` nor the gateway itself, gets 403. Add it to any new cookie-issuing route. live's socket.io `allowRequest` likewise refuses handshakes whose `Origin` isn't in `CORS_ORIGINS`.
  - Google account linking (frontend on a different origin, same site): open `/auth/credentials/google` with a top-level navigation, not fetch. The navigation carries the `access_token` cookie, and the `oauth2_state` cookie set there comes back on the callback.
- **Authorization: pick the right mechanism.**
  - Role-only rules go on the route with `@HasRoles(...)`.
  - Room delete/schedule, blog and flashcard mutations still use `@ResourceAccess({ ..., requireOwnership: true })` (ownership copied into the authorization service). The owning service must publish `<svc>.<resource>.created` / `.deleted` events, and the authorization seed must backfill existing rows. Don't add new `@ResourceAccess` routes; prefer the requester pattern below.
  - Rules that depend on the data itself are enforced **in the owning service**. The gateway forwards who is asking, and the service decides from its own rows:
    - resource RPCs (private lists, "own reports only") carry `requesterId` + `privileged`, built with `requesterOf(req.user, PRIVILEGED_ROLES)` from `apps/gateway/src/auth/functions/requester.ts`;
    - exam management mutations (sections, questions, update/delete/move exam) carry `requesterOf(req.user, [Role.Admin])`; exam allows only the exam's creator or an admin (`ExamManagementController.assertCanModify`), and move checks the destination too;
    - live ban/unban carries `requesterOf(req.user, [Role.Admin])`; live allows only the room owner (`Room.createdBy`) or an admin, and rooms with no recorded owner are admin-only;
    - attaching files (exam `addFiles`, report files, auth avatar) checks the uploader: file-service records `uploadedBy` from the JWT on presign, and the attaching service calls `CheckFilesOwnedBy` (403 listing the foreign ids). Admins skip it on exam and report attaches (avatars have no override); files with no recorded uploader are therefore admin-only. Re-sending the current avatar is exempt. Viewing files is not restricted;
    - notification RPCs carry `recipientId: req.user.sub`.
  - Never take a user id for these checks from the request body or query. Services answer "not yours" with 404, not 403, so ids of private data don't leak.
- Paginated or filtered `GET` routes take a `@Query()` DTO: arrays via `ToStringArray()`, booleans via `str2bool`, and `page`/`limit` bounded with `@Min`/`@Max`. Don't use individual `@Query('x')` params.

## Naming

- Files are kebab-case with a role suffix: `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `*.command.ts`, `*.event.ts`, `*.read-model.ts`, `*.req.dto.ts`, `*.res.dto.ts`, `*.enum.ts`, `*.config.ts`.
- Classes are PascalCase, interfaces are `I`-prefixed (`ITagRepository`), and DI tokens are `<Interface>Token`.

## gRPC contracts

1. Edit `proto/*.proto`.
2. Regenerate with `nx run generated:generate` (`pnpm proto:gen`).
3. Commit the regenerated `libs/generated/src` together with the proto change.
4. Update the service controller and the gateway.

## Database

- Prisma schemas are split per file under `apps/<svc>/prisma/schema/`. Migrations live in `apps/<svc>/prisma/migrations/`.
- To change the schema, edit the `.prisma` file, run `nx run <svc>:prisma:migrate -- --name <change>`, and commit the migration. Don't edit applied migrations.
- Seeds are in `apps/<svc>/prisma/seed.ts` and `seed/`. Keep them re-runnable. `pnpm db:setup` migrates and seeds everything locally.

## Secrets & safety

- `**/*.env` is gitignored. Never commit real `.env` files, JWT keys, or credentials. Put placeholders in `.env.example`.
- The JWT private key belongs only to `auth`. The gateway gets only the public key.

## Git

- Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), with an optional scope such as `fix(ci): …`. Use the imperative mood and keep the subject short.
- Branch from `main` (`feat/…`, `fix/…`, `chore/…`). Don't commit directly to `main`.
- Keep each commit focused on one change. Don't mix formatting churn with logic changes.
