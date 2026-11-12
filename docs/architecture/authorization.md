# Authorization architecture

How a request is authenticated and authorized, and where each rule lives. This is the **target design**. The rollout status table at the end shows which parts are live. The hybrid authorization design (`docs/superpowers/specs/2026-11-12-hybrid-authorization-design.md`, pending approval) supersedes its "retire the authorization service" direction. The current rules for gateway and service code are in `AGENTS.md` > Gateway conventions.

## The model in one paragraph

The **auth** service is the single source of truth for _who you are_ and _what you may do_: identities, roles, and which permissions each role grants. It packs your id and permissions into a signed JWT. Every other service is the source of truth for _its own data_, including who created what. A service makes each authorization decision **locally**. It combines the caller's permissions (from the verified JWT) with facts about the resource (from its own database), for example "has `resource:report:manage`, or is the reporter". There is no extra network hop per check. Services never store roles.

This is the "distributed execution, centralized management" model from [Aserto's comparison](https://www.aserto.com/blog/centralized-vs-distributed-authorization):

- Management is centralized: auth owns the role → permission mapping.
- Decisions are local: each service evaluates its own rules.
- The consistency cost is that a token can carry stale permissions until it expires. Auth shortens that window by revoking tokens on role changes and password changes.

## Request flow

```
Client ──access token (access_token cookie, else Bearer)──► Gateway
                                 │ 1. JwtAuthGuard: verify RS256 signature + ask auth "is this token revoked?"
                                 │ 2. Coarse route gates (@IsPublic, @HasPermissions) – optional fast-fail only
                                 │ 3. Forward the SAME token in gRPC metadata: `authorization: Bearer <token>`
                                 ▼
                              Service (e.g. resource)
                                 │ 4. ActorAuthGuard: verify RS256 signature locally (public key) → Actor
                                 │ 5. @CurrentActor() hands the Actor to the controller
                                 │ 6. Application service loads the aggregate and asks the domain policy:
                                 │       canViewReport(actor, report)  → actor.id === report.reportedBy
                                 │                                     || actor.has(ResourcePermission.ReportManage)
                                 ▼
                              404 (not visible) / 403 (visible, not allowed) / result
```

Browsers send the token as the HttpOnly `access_token` cookie (`SameSite=Lax`); API clients may still use `Authorization: Bearer`. **Deployment constraint: the frontend and the API must be same-site** (different origin or port on the same registrable domain is fine), because a cross-site frontend can't store Lax cookies from fetch. Google account linking therefore works across origins on the same site when the frontend opens `/auth/credentials/google` with a top-level navigation. Cookie-issuing routes refuse cross-site requests (`CookieIssuanceGuard`) to stop login CSRF. Step 3 must forward the token the strategy extracted (cookie or header), not just the incoming `Authorization` header, or cookie sessions arrive at services without a token.

Why the service verifies the token again instead of trusting the gateway:

- Service ports are reachable without going through the gateway (Envoy sidecars). An id in a request field or header could be forged. A signature can't.
- The decision then depends only on data the service can check itself.

Revocation is checked at the gateway only. A service accepts a revoked-but-unexpired token for up to the access-token TTL (15 minutes) if someone reaches it directly. That's the accepted cost of not calling auth on every request.

## The `Actor`

Shared kernel type in `@server/utils`:

```ts
class Actor {
	readonly id: string; // JWT `sub`
	readonly permissions: ReadonlySet<string>; // JWT `permissions`
	has(permission: string): boolean;
}
```

It has **no roles**, on purpose: roles are an auth-internal grouping. A service that checks `Role.Admin` breaks whenever roles are reorganised. A service that checks a permission doesn't.

## Permissions

- **Naming:** `<context>:<resource>:<action>`, e.g. `resource:report:manage`, `exam:content:edit`. Lower-case, kebab-case segments.
- **Ownership:** each bounded context declares the permissions it enforces as constants in its own code (`apps/<svc>/src/domain/permissions.ts`). No other service imports them.
- **Catalogue:** auth seeds every permission name and maps roles to them in `apps/auth/prisma/seed/permission-catalog.ts`. To auth, the names are opaque strings, so the string in the catalogue and the service constant are the contract between the two.
- **Changes:**

  | Change                                                | Touches                                                                |
  | ----------------------------------------------------- | ---------------------------------------------------------------------- |
  | New role, renamed role, role gains/loses a permission | auth seed only, then re-seed                                           |
  | New permission                                        | the one enforcing service + the catalogue                              |
  | Rename/remove a permission                            | expand (add new, grant it) → migrate the service → contract (drop old) |

  After any mapping change, users get the new permissions when their token is next issued. That happens at login or refresh, and immediately if auth revokes their tokens.

## Where each kind of rule goes

| Rule                                                  | Lives in                                                                                             | Example                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| "Must be logged in"                                   | Gateway global `JwtAuthGuard` (default)                                                              | everything not `@IsPublic()`                     |
| Pure capability, no resource involved                 | Domain service / policy via `actor.has(...)`. Gateway `@HasPermissions` may mirror it as a fast-fail | creating a notification for others               |
| Owner **or** capability                               | Domain policy in the owning service                                                                  | edit/view a report                               |
| Visibility in lists                                   | The owning service's query, built from the policy                                                    | "your reports, or all if you can manage reports" |
| Cross-service relationships (teams, classes, sharing) | Not supported yet. Would justify a central relationship store (Zanzibar-style)                       | "teacher sees their students' attempts"          |

Services answer "you may not even see this" with **404** and "you may see it but not do this" with **403**, so ids of private data don't leak.

## What is being retired

- The `requesterId` / `privileged` fields on resource, exam management and live moderation RPCs. The gateway decides "privileged", which puts policy in the wrong place. Until the `Actor` rollout reaches a service, these fields remain the way to scope a check to the caller. Never take them from the request body.
- `@ResourceAccess` and the authorization service's ownership copy. Ownership already lives in each service's own rows. The copy caused 403s right after creation, and permanent lock-out when an event was lost.
- `@HasRoles(Role.X)` in the gateway, replaced by `@HasPermissions(...)` or domain policy.
- The shared `Permission` enum in `@server/typing`, split into per-context constants.

## Rollout status

| Area                       | Status                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reports (resource)         | Planned, pilot: `docs/superpowers/plans/2026-11-12-actor-permission-authorization.md`. Today `requesterId`/`privileged`                                                      |
| Flash cards / lists, blogs | Still `requesterId`/`privileged` + `@ResourceAccess`                                                                                                                         |
| Notifications              | Still `recipientId` field                                                                                                                                                    |
| Exam content               | `requesterId`/`privileged` (`requesterOf(req.user, [Role.Admin])`): exam allows the exam's creator or an admin, including the move destination. `@ResourceAccess` removed    |
| Exam attempts              | Still `userId` field                                                                                                                                                         |
| Live rooms                 | Live verifies the JWT for sockets. Ban/unban: `requesterId`/`privileged`, room owner (`Room.createdBy`) or admin, checked in live. Delete/schedule still `@ResourceAccess`   |
| File attachments           | file-service records `uploadedBy`. Exam, resource and auth call `CheckFilesOwnedBy` before attaching (403). Admin override on exam and reports only. Viewing is unrestricted |
| Gateway role gates         | Still `@HasRoles`                                                                                                                                                            |
