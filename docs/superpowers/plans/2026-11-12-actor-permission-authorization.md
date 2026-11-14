# Actor + Permission Authorization (Reports Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reports are authorized inside the resource service from a locally verified JWT (`Actor`) plus permission-based domain policy. This replaces the gateway-decided `requesterId`/`privileged` fields and `@HasRoles`.

**Architecture:**

- The gateway forwards the caller's access token in gRPC metadata.
- A shared `ActorAuthGuard` verifies it with the RS256 public key and exposes an `Actor { id, permissions }` through `@CurrentActor()`.
- Report rules live in a domain policy that checks the `resource:report:manage` permission, which auth grants to Admin and Mod through a seeded catalogue.

**Tech Stack:** NestJS 11 microservices (gRPC via `@grpc/grpc-js`, ts-proto with `addGrpcMetadata=true`), `jsonwebtoken`, zod config, Prisma, Jest + ts-jest, Nx.

**Spec:** `docs/architecture/authorization.md`

## Global Constraints

- Permission names follow `<context>:<resource>:<action>`, lower-case kebab segments. This pilot's permission is exactly `resource:report:manage`.
- The metadata key is `authorization` with the value `Bearer <access token>`, i.e. the same token the client sent to the gateway, unchanged.
- Verify with `algorithms: ['RS256']` only. The key comes from config key `jwtPublicKey`, env `JWT_PUBLIC_KEY`.
- `Actor` carries no roles. Services must not import `Role` for authorization decisions.
- Not visible → `NotFoundException` (404). Visible but not allowed → `ForbiddenException` (403). Missing or invalid token → `UnauthorizedException` (401).
- Proto edits are additive or `reserved`: never reuse a removed field number. Regenerate with `pnpm proto:gen` and commit `libs/generated` with the proto.
- Follow `AGENTS.md`: DTOs are the only place generated message types appear, the decorator order is lint-enforced (`pnpm exec eslint --fix`), and `object-shorthand: never`.
- Every task ends green on `pnpm exec nx run-many -t lint test build -p <touched projects>`.

## Review Focus

- A gRPC call with no `authorization` metadata, e.g. an internal caller or a direct Envoy hit, must return 401, not a 500. _Task 2: `rejects calls without metadata`._
- A validly signed token without a `permissions` claim must give an `Actor` with no permissions, not crash. _Task 1: `fromClaims tolerates missing permissions`._
- A lower-case `bearer` scheme or extra whitespace must still authenticate, and any other scheme must be 401. _Task 2: `accepts case-insensitive Bearer scheme` and `rejects non-Bearer schemes`._
- An expired token must be 401 even with a valid signature. _Task 2: `rejects expired tokens`._
- A non-staff caller who passes `reportedBy=<someone else>` must still only get their own reports. _Task 5: `forces non-managers listings to themselves`._

---

### Task 1: `Actor` value object

**Files:**

- Create: `libs/utils/src/actor/actor.ts`
- Create: `libs/utils/src/actor/index.ts` (barrel), then add `export * from './actor';` to `libs/utils/src/index.ts`
- Test: `libs/utils/src/actor/actor.spec.ts`

**Interfaces:**

- Produces:
  - `class Actor { readonly id: string; readonly permissions: ReadonlySet<string>; constructor(id: string, permissions: Iterable<string>); has(permission: string): boolean; static fromClaims(claims: { sub: unknown; permissions?: unknown }): Actor }`
  - `fromClaims` throws `UnauthorizedException` when `sub` isn't a non-empty string, and keeps only the string entries of `permissions`.

- [ ] **Step 1: Write the failing tests** in `actor.spec.ts`:
  - `has returns true only for granted permissions`: `new Actor('u1', ['resource:report:manage']).has('resource:report:manage') === true`, and `.has('exam:content:edit') === false`.
  - `fromClaims tolerates missing permissions`: `Actor.fromClaims({ sub: 'u1' })` has `id === 'u1'` and `permissions.size === 0`.
  - `fromClaims drops non-string permissions`: `{ sub: 'u1', permissions: ['a:b:c', 42, null] }` gives exactly `['a:b:c']`.
  - `fromClaims rejects a missing sub`: `{ permissions: [] }` and `{ sub: '' }` throw `UnauthorizedException`.
- [ ] **Step 2: Run** `pnpm exec nx run utils:test --skip-nx-cache`. Expected: FAIL, cannot find module `./actor`.
- [ ] **Step 3: Implement** `Actor` in `actor.ts`. Store permissions in a `Set`, and freeze the instance.
- [ ] **Step 4: Run** the same command. Expected: PASS (4 new tests plus the existing cursor tests).
- [ ] **Step 5: Commit** `feat(utils): add Actor value object for local authorization`.

### Task 2: `ActorAuthGuard` and `@CurrentActor()`

**Files:**

- Create: `libs/utils/src/actor/actor-auth.guard.ts`
- Create: `libs/utils/src/actor/current-actor.decorator.ts`
- Modify: `libs/utils/src/actor/index.ts` (export both)
- Test: `libs/utils/src/actor/actor-auth.guard.spec.ts`

**Interfaces:**

- Consumes: `Actor.fromClaims` (Task 1).
- Produces:
  - `ACTOR_METADATA_KEY = 'authorization'`.
  - `@Injectable() class ActorAuthGuard implements CanActivate`. Its constructor is `(configService: ConfigService)` and it reads `configService.get<string>('jwtPublicKey')`. `canActivate(ctx)` reads `ctx.switchToRpc().getContext<Metadata>().get(ACTOR_METADATA_KEY)[0]`, verifies it, and stores the `Actor` for the call. It returns `true` or throws `UnauthorizedException`.
  - `CurrentActor = createParamDecorator(...)`, which returns the stored `Actor` for the current gRPC call. It throws `UnauthorizedException` if the guard didn't run.
  - Storage: a module-level `WeakMap<object, Actor>` keyed by the call's `Metadata` object, shared by both files through an internal `actor-store.ts`, which is not exported from the barrel.

- [ ] **Step 1: Write the failing tests** in `actor-auth.guard.spec.ts`. Generate a key pair with `generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })`, sign with `jwt.sign(payload, privateKey, { algorithm: 'RS256' })`, and build an `ExecutionContext` stub whose `switchToRpc().getContext()` returns a real `new Metadata()` from `@grpc/grpc-js`. Tests:
  - `accepts a valid token and exposes the Actor`: metadata `authorization: Bearer <token for { sub: 'u1', permissions: ['resource:report:manage'] }>`. `canActivate` resolves to `true`, and the stored actor has `id === 'u1'` and `has('resource:report:manage') === true`.
  - `rejects calls without metadata`: an empty `Metadata` rejects with `UnauthorizedException`.
  - `accepts case-insensitive Bearer scheme`: `'bearer   <token>'` resolves to `true`.
  - `rejects non-Bearer schemes`: `'Basic abc'` gives `UnauthorizedException`.
  - `rejects tokens signed by another key`: an HS256 token signed with `'secret'` gives `UnauthorizedException`.
  - `rejects expired tokens`: `jwt.sign({ sub: 'u1', exp: Math.floor(Date.now() / 1000) - 10 }, privateKey, { algorithm: 'RS256' })` gives `UnauthorizedException`.
  - `rejects everything when no public key is configured`: a config with no `jwtPublicKey` turns a valid token into `UnauthorizedException`.
- [ ] **Step 2: Run** `pnpm exec nx run utils:test --skip-nx-cache`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the guard, the decorator and the store.
  - Parse the scheme with `/^bearer\s+(.+)$/i`.
  - Call `jwt.verify(token, key, { algorithms: ['RS256'] })`, then `Actor.fromClaims`.
  - Map any verify error to `UnauthorizedException('Invalid token')`.
  - Run `pnpm exec eslint --fix libs/utils` so `@nx/dependency-checks` adds `jsonwebtoken` and `@grpc/grpc-js` to `libs/utils/package.json`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(utils): verify forwarded JWTs in services with ActorAuthGuard`.

### Task 3: Gateway forwards the caller's token

**Files:**

- Create: `apps/gateway/src/auth/functions/forward-auth.ts`
- Test: `apps/gateway/src/auth/functions/forward-auth.spec.ts`

**Interfaces:**

- Consumes: `ACTOR_METADATA_KEY` (Task 2).
- Produces: `forwardAuth(req: Request): Metadata`. It returns a new `@grpc/grpc-js` `Metadata` containing `authorization` with the request's `Authorization` header value, copied verbatim. It throws `UnauthorizedException` if the header is missing, which shouldn't happen behind `JwtAuthGuard`.

- [ ] **Step 1: Write the failing tests:**
  - `copies the bearer header verbatim`: a request with `headers.authorization = 'Bearer abc'` gives `metadata.get('authorization')` equal to `['Bearer abc']`.
  - `throws when the header is missing`: `UnauthorizedException`.
- [ ] **Step 2: Run** `pnpm exec nx run gateway:test --skip-nx-cache`. Expected: FAIL.
- [ ] **Step 3: Implement** `forwardAuth`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(gateway): forward the caller's access token to services`.

### Task 4: Permission catalogue in auth + resource permission constant

**Files:**

- Create: `apps/auth/prisma/seed/permission-catalog.ts`
- Modify: `apps/auth/prisma/seed.ts`. `seedPermissions` and `seedRolePermissions` must also seed the catalogue entries. Admin keeps "all permissions", now meaning the legacy enum plus the catalogue.
- Create: `apps/resource/src/domain/permissions.ts`
- Test: `apps/auth/prisma/seed/permission-catalog.spec.ts`. Add `"prisma/seed/**/*.ts"` to `apps/auth/tsconfig.spec.json` `include` if it isn't covered.

**Interfaces:**

- Produces:
  - `export const PERMISSION_CATALOG: readonly { name: string; grantedTo: readonly Role[] }[]`, containing exactly `{ name: 'resource:report:manage', grantedTo: [Role.Admin, Role.Mod] }` for now.
  - `export const ResourcePermission = { ReportManage: 'resource:report:manage' } as const;` in `apps/resource/src/domain/permissions.ts`.

- [ ] **Step 1: Write the failing tests:**
  - `catalogue names are unique`.
  - `catalogue names follow <context>:<resource>:<action>`: each name matches `/^[a-z]+(-[a-z]+)*(:[a-z]+(-[a-z]+)*){2}$/`.
  - `catalogue does not collide with the legacy Permission enum`.
  - `grants report management to admin and mod only`.
- [ ] **Step 2: Run** `pnpm exec nx run auth:test --skip-nx-cache`. Expected: FAIL.
- [ ] **Step 3: Implement** the catalogue, the seed changes and the resource constant.
- [ ] **Step 4: Run** the tests. Expected: PASS. Then run `pnpm db:setup` locally: it is idempotent (`createMany` with `skipDuplicates`, and `upsert`). Confirm with `docker compose -f docker/docker-compose.db.yaml --env-file docker/.env exec postgres psql -U <user> -d auth_db -c "select name from permissions where name='resource:report:manage'"`. Expected: 1 row.
- [ ] **Step 5: Commit** `feat(auth): seed context-owned permissions; add resource:report:manage`.

### Task 5: Report domain policy + `ReportService` on `Actor`

**Files:**

- Create: `apps/resource/src/domain/policies/report.policy.ts`
- Test: `apps/resource/src/domain/policies/report.policy.spec.ts`
- Modify: `apps/resource/src/app/services/report.service.ts`
- Modify: `apps/resource/src/app/services/report.service.spec.ts` (replace `Requester` with `Actor`)

**Interfaces:**

- Consumes: `Actor` (Task 1) and `ResourcePermission.ReportManage` (Task 4).
- Produces:
  - `canManageReports(actor: Actor): boolean`
  - `canViewReport(actor: Actor, report: { reportedBy: string }): boolean`, which is true for the reporter or a manager.
  - `ReportService` signatures, in which `UpdateReportInput` loses `resolvedBy`:
    - `getReport(id: string, actor: Actor)`
    - `listReports(data: ListReportsInput, actor: Actor)`
    - `updateReport(data: UpdateReportInput, actor: Actor)`, which throws `ForbiddenException` when `!canManageReports(actor)` and sets `resolvedBy: actor.id`
    - `deleteReport(id: string, actor: Actor)`, which throws `ForbiddenException` when `!canManageReports(actor)`
    - `addFileToReport(reportId: string, fileId: string, actor: Actor)` and `removeFileFromReport(reportId: string, fileId: string, actor: Actor)`, both requiring `canViewReport`

- [ ] **Step 1: Write the failing tests:**
  - Policy: the reporter can view, a manager can view, a stranger can't, and only managers can manage.
  - Service, adapting the existing spec cases to `new Actor(...)`, plus:
    - `forces non-managers listings to themselves`: `listReports({ reportedBy: 'victim' }, new Actor('me', []))` queries `reportedBy: 'me'`.
    - `lets managers filter by reporter`.
    - `forbids non-managers from updating`: `updateReport` throws `ForbiddenException` and `report.update` isn't called.
    - `records the managing actor as resolver`: `update` receives `resolvedBy: 'mod-1'`.
    - `forbids non-managers from deleting`.
- [ ] **Step 2: Run** `pnpm exec nx run resource:test --skip-nx-cache`. Expected: FAIL.
- [ ] **Step 3: Implement** the policy, and switch `ReportService` to the policy and `Actor`. Remove the `Requester` import from this file only; flash cards still use it.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(resource): move report authorization into a permission-based domain policy`.

### Task 6: Wire reports end-to-end and drop the old fields

**Files:**

- Modify: `proto/resource.proto`
  - Remove `requester_id` and `privileged` from `GetReportRequest`, `ListReportsRequest`, `AddFileToReportRequest` and `RemoveFileFromReportRequest`, adding `reserved <their numbers>;`.
  - Remove `resolved_by` (3) from `UpdateReportRequest` and add `reserved 3;`.
- Modify: `libs/generated/src/resource.ts` (regenerated)
- Modify: `apps/resource/src/configs/config.ts` (`jwtPublicKey: z.string().optional()` from `JWT_PUBLIC_KEY`, the same as `apps/live`) and `apps/resource/.env.example`
- Modify: `apps/resource/src/presentation/controllers/report.controller.ts`
  - Add `@UseGuards(ActorAuthGuard)` at class level.
  - Each method takes `@CurrentActor() actor: Actor` as its second parameter.
  - Pass `actor` to the service.
- Modify: `apps/resource/src/presentation/dtos/req/{get-report,list-reports,add-file-to-report,remove-file-from-report,update-report}.req.dto.ts`. Drop `extends RequesterReqDto` and `resolvedBy`.
- Modify: `apps/gateway/src/resource-gateway/resource.router.controller.ts`
  - Every `reportService.*` call passes `forwardAuth(req)` as its second argument.
  - Remove the `requesterOf(...)` spreads, `REPORT_STAFF_ROLES`, `@HasRoles` on the report routes, and `resolvedBy`.
- Modify: `apps/gateway/src/resource-gateway/dtos/req/update-report.req.dto.ts` (`implements Omit<resource.UpdateReportRequest, 'id'>`)

**Interfaces:**

- Consumes: Tasks 2, 3 and 5.
- Produces: none new. This is the observable behaviour checked below.

- [ ] **Step 1: Regenerate:** run `pnpm proto:gen`. Expected: `git diff --stat libs/generated` shows only `resource.ts`.
- [ ] **Step 2: Typecheck to find every call site:** `pnpm exec tsc --noEmit -p apps/resource/tsconfig.app.json && pnpm exec tsc --noEmit -p apps/gateway/tsconfig.app.json`. Expected: errors only in the files listed above.
- [ ] **Step 3: Apply** the modifications above, then run `pnpm exec eslint --fix apps/resource/src apps/gateway/src`.
- [ ] **Step 4: Verify:** `pnpm exec nx run-many -t lint test build -p resource gateway utils auth`. Expected: `Successfully ran targets lint, test, build`. Then confirm the old fields are gone: `grep -rn "requesterOf(req.user, REPORT_STAFF_ROLES)\|resolvedBy: req.user" apps/gateway/src`. Expected: no output.
- [ ] **Step 5: Manual smoke test**, if the local stack is running. Use the seeded admin and a seeded user, and log in again after Task 4's seed so tokens carry the new permission.
  - The user creates a report.
  - The user's `GET /api/v1/reports` returns only their report.
  - Another user's `GET /api/v1/reports/<id>` returns 404.
  - The admin can list all reports, and `PATCH` works.
  - A plain user's `PATCH` returns 403.
  - A direct `grpcurl` to resource's gRPC port without metadata returns `UNAUTHENTICATED`.
- [ ] **Step 6: Commit** `feat(resource): authorize reports from the forwarded JWT instead of gateway-supplied flags`.

### Task 7: Documentation

**Files:**

- Modify: `AGENTS.md`. In the "Authorization: pick the right mechanism" bullet: new services follow `docs/architecture/authorization.md` (forwarded JWT, then `ActorAuthGuard`/`@CurrentActor()`, then a domain policy with permissions). `requesterId`/`privileged`, `@ResourceAccess` and `@HasRoles` are legacy.
- Modify: `docs/architecture/authorization.md`. In the rollout table, reports become **Live**.
- Modify: `docs/backlog.md`. S1 gets a note: "reports now verify the JWT in-service. Other services remain exposed until migrated."

- [ ] **Step 1: Edit** the three files and run `pnpm exec prettier --write AGENTS.md docs`.
- [ ] **Step 2: Commit** `docs: document Actor-based authorization and pilot status`.

---

## After the pilot (separate plans, in this order)

1. Flash cards, lists and blogs: drop `requesterId`/`privileged` and `@ResourceAccess`, and add `resource:flash-card:moderate` and similar.
2. Notifications: replace the `recipientId` field with `actor.id`, and `@HasRoles(Role.Admin)` on create with `notification:send`. That permission name already exists in the legacy enum, so rename it to `notification:notification:send` using expand/contract.
3. Exam: attempts move from `userId` to `actor.id`. Content edits become owner or `exam:content:moderate`, which fixes backlog S2.
4. Live rooms: room rules move into live's policy.
5. Remove the authorization service's ownership store, the `resource.resource.*`/`exam.exam.*`/`live.room.*` ownership events, `ResourceAccessGuard`, and the authorization seed.
6. Split the legacy `Permission` enum in `@server/typing` into per-context constants plus the auth catalogue, and replace the remaining `@HasRoles` with `@HasPermissions`.
