# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, opencode, …) working in this repo.
Read it before changing anything. Human-facing setup docs live in `README.md`.

## What this is

Backend for an English-learning app: an Nx + pnpm monorepo of NestJS 11 microservices.

- `apps/gateway` — the only HTTP entry point (`/api/v1/*`, docs at `/reference`). Verifies JWTs (RS256 public key), applies role/permission guards, and forwards calls to services over gRPC.
- `apps/{auth,authorization,exam,achievement,resource,file-service,live,notification}` — gRPC microservices, one Postgres database each (Prisma). They exchange events over RabbitMQ.
- `libs/generated` (`@server/generated`) — code generated from `proto/*.proto`. **Never hand-edit.**
- `libs/utils` (`@server/utils`) — shared pipes, filters, interceptors, DTOs, CQRS base classes, RMQ config.
- `libs/database`, `libs/logger`, `libs/typing` — Prisma helpers, Winston logger, utility types and shared enums (e.g. `Role`).

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

- **Decorator order is enforced** (`perfectionist/sort-decorators`). Groups go in this order: `Version` → HTTP method (`Get`/`Post`/…) → `UseGuards` → `UseInterceptors` → `UsePipes` → `UseFilters` → class-transformer (`Expose`, `Type`, …) → class-validator (`Is*`, `Min*`, …) → everything else → `Module` → `Controller` → `Injectable`. Decorators within a group are alphabetical. `--fix` reorders them.
- `object-shorthand: never`. Write `{ id: id }`, not `{ id }`.
- No `console.log`. Use the logger (`@server/logger`); `console.warn`/`console.error` are allowed.
- No unnecessary type assertions (`no-unnecessary-type-assertion`), no inferrable type annotations, no empty functions.
- `@nx/enforce-module-boundaries`: import libs through their `@server/*` alias, never through relative paths into `libs/`.
- `any` is allowed but avoid it. Floating promises and non-null assertions produce warnings, so don't add new ones.

## TypeScript

- `strict: true`, `module`/`moduleResolution: nodenext`, decorators with metadata enabled.
- Use `import { type X }` for type-only imports of interfaces (e.g. repository interfaces).
- Prisma clients are generated per service and imported as `@prisma-client/<service>` (e.g. `import { PrismaClient } from '@prisma-client/exam'`).
- Zod is imported from `zod/v4`.

## Service architecture (DDD + CQRS, follow existing layout)

Each microservice under `apps/<svc>/src/` is layered like this:

```
presentation/   controllers (gRPC handlers) + dtos/req, dtos/res
app/            commands/, queries/ (+ handlers/), events/ (+ handlers/, publishers/), services/
domain/         entities/, repositories/ (interfaces + DI tokens), read-models/, events/
infra/          repositories/*.prisma.repository.impl.ts
configs/        config.ts (zod env schema), rmq/bullmq configs
```

- **Dependencies point inward.** `domain` imports nothing from `app`, `infra`, or `presentation`.
- **Repositories:** the interface and its token live together in `domain/repositories/<name>.repository.ts` as `export interface IXRepository` and `export const IXRepositoryToken = Symbol('IXRepository')`. The implementation goes in `infra/repositories/<name>.prisma.repository.impl.ts`. Inject with `@Inject(IXRepositoryToken) private readonly xRepository: IXRepository`.
- Read-side queries use separate `*.read.repository.ts` interfaces that return `domain/read-models`.
- Use `TransactionHost<TransactionalAdapterPrisma<PrismaClient>>` (`@nestjs-cls/transactional`) for DB access and transactions. Don't create a `PrismaClient` directly.
- **CQRS:** commands and queries extend the base classes in `@server/utils`. Handlers use `@CommandHandler(X)` / `@QueryHandler(X)` and implement `ICommandHandler<X>`, then load the aggregate, call its domain method, and save it.
- **gRPC controllers** use `@UseFilters(GlobalRpcExceptionFilter)`, the generated `@<pkg>.XServiceControllerMethods()` decorator, and `@Controller()`, and they `implements <pkg>.XServiceController`. Shape responses with `@SerializeOptions({ type: ResDto })`.
- **Errors:** throw Nest exceptions (`NotFoundException`, …). The shared RPC/HTTP filters translate them across gRPC.
- **Config:** each service validates env with a zod schema in `configs/config.ts`. Add new env vars there and to that app's `.env.example`.

### Gateway conventions

- One `<domain>-gateway/` folder per service, containing `*.router.controller.ts`, `*.router.module.ts`, `constants/` (client tokens such as `EXAM_CLIENT`), and `dtos/`.
- Get gRPC clients in `onModuleInit` via `client.getService<pkg.XServiceClient>(pkg.X_SERVICE_NAME)`.
- Every route has Swagger docs: `@ApiTags`, `@ApiOperation({ summary })`, `@ApiResponseEntity(Dto)` / `@ApiEmptyResponseEntity()`, and `@ApiBearerAuth()` when it requires auth.
- Auth is on by default. Use `@IsPublic()` to open a route, and `@HasRoles(Role.X, …)` (from `@server/typing`) to restrict one.

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
