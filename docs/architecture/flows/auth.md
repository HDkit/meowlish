# Authentication and account flows

Covers the gateway's `AuthGatewayController` (`apps/gateway/src/auth-gateway/auth.router.controller.ts`, mounted at `/api/v1/auth` by `apps/gateway/src/router.module.ts` + global prefix `api` + URI version `1` in `apps/gateway/src/bootstrap.ts`), its passport strategies and guards, and the `auth` gRPC service (`apps/auth`). Data model: [services-and-data.md, auth](../services-and-data.md#auth-appsauth). Token format, the per-request revocation check and cookie rules are in [authorization.md](../authorization.md#2-authentication) and are only linked here. Outbox/inbox terms: [messaging.md](../messaging.md).

Conventions used below:

- **Authenticated** = not `@IsPublic()`: the global `JwtAuthGuard` runs `JwtStrategy`, which calls gRPC `auth.AuthService/ValidateAccess` on every request (Redis `GET jwt:blacklist:user:<id>` + a Postgres `Identity` load); see [Verification in the gateway](../authorization.md#verification-in-the-gateway) and [ValidateAccess](#grpc-validateaccess).
- **Throttling** (`apps/gateway/src/throttle.ts`, registered by `ThrottlerModule.forRoot(throttlerOptions)` in `apps/gateway/src/gateway.module.ts:45` with a global `ThrottlerGuard`): every route has throttler `default` 100/min keyed `<ip>:sub:<id>` (the `access_token` cookie or Bearer `sub`, decoded **without** verification) or `<ip>` when signed out. `Strict*` decorators replace `default` with 10/min keyed `<ip>:<account>` and enable throttler `ip` (100/min per IP). Storage is the throttler's default in-memory store (no `storage` option), so limits are per gateway process. Over the limit: 429 `Rate limit reached`.
- **Cookies**: `setAuthCookies` / `clearAuthCookies` in `apps/gateway/src/auth-gateway/auth-cookies.ts` (`access_token` Path=/, `refresh_token` Path=/api/v1/auth, HttpOnly, SameSite=Lax, Secure on HTTPS/production, Max-Age from the JWT `exp`). See [Session cookies](../authorization.md#3-session-cookies).
- **gRPC errors** map Nest exception → gRPC code (`GlobalRpcExceptionFilter`) → HTTP (`gRPC2HttpExceptionFilter`): 400/401/403/404/409 round-trip; 405 becomes CANCELLED → **499**; any non-`HttpException` (raw Prisma error, plain `Error`) becomes UNKNOWN → **502**.
- Every write through `IdentityPrismaRepositoryImpl.save` (`apps/auth/src/infra/repositories/identity.prisma.repository.impl.ts:154`) runs in `txHost.withTransaction`: insert at `version 0 → 1`, else `update where {id, version}` with `version + 1` (optimistic lock; a stale version raises Prisma P2025, not mapped, so 502). It then replays the aggregate's uncommitted domain events as row writes: `RoleAdded/Deleted` → `IdentityRole`, `CredAdded/Deleted/Updated` → `Credential`. P2002 → 409 `A record with this value already exists`. `IdentityUpdated`, `IdentityAvatarUpdated`, `IdentityLocked/Unlocked` are not persisted by `save`; publishers read them where noted.
- `findOneById` / `getClaimsOfId` ignore soft-deleted identities (`deletedAt: null`).

## Contents

| Operation                                                                              | Access                                                    | Writes                                                                            | Events                               |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------ |
| [POST /auth/register](#post-apiv1authregister)                                         | public, CookieIssuanceGuard, strict by mail               | `Identity`, `Credential`, `IdentityRole`                                          | -                                    |
| [POST /auth/login](#post-apiv1authlogin)                                               | public, CookieIssuanceGuard, strict by mail               | outbox                                                                            | `auth.user.login`                    |
| [POST /auth/refresh](#post-apiv1authrefresh)                                           | refresh JWT, CookieIssuanceGuard, strict by refresh token | -                                                                                 | -                                    |
| [POST /auth/logout](#post-apiv1authlogout)                                             | public, CookieIssuanceGuard                               | - (cookies only)                                                                  | -                                    |
| [POST /auth/logout-all](#post-apiv1authlogout-all)                                     | authenticated                                             | Redis revocation key                                                              | -                                    |
| [GET /auth/google](#get-apiv1authgoogle)                                               | public                                                    | Redis state (non-default frontend)                                                | -                                    |
| [GET /auth/google/callback](#get-apiv1authgooglecallback)                              | public, state check                                       | `Identity`/`Credential`/`IdentityRole` (sign-up, link), outbox, Redis login token | `auth.user.login` (existing account) |
| [POST /auth/google/tokens](#post-apiv1authgoogletokens)                                | public, CookieIssuanceGuard, JSON only                    | Redis delete                                                                      | -                                    |
| [GET /auth/credentials/google](#get-apiv1authcredentialsgoogle)                        | authenticated                                             | Redis state, `oauth2_state` cookie                                                | -                                    |
| [POST /auth/credentials/mail](#post-apiv1authcredentialsmail)                          | authenticated, strict by session                          | `Credential`                                                                      | -                                    |
| [DELETE /auth/credentials/:id](#delete-apiv1authcredentialsid)                         | authenticated (own identity)                              | `Credential`                                                                      | -                                    |
| [POST /auth/credentials/mail/password](#post-apiv1authcredentialsmailpassword)         | authenticated, strict by session                          | `Credential`, Redis revocation key                                                | -                                    |
| [GET /auth/credentials](#get-apiv1authcredentials)                                     | authenticated                                             | -                                                                                 | -                                    |
| [GET /auth/my/identity](#get-apiv1authmyidentity)                                      | authenticated                                             | -                                                                                 | -                                    |
| [POST /auth/my/identity](#post-apiv1authmyidentity)                                    | authenticated                                             | `Identity`, `DeletedFile` (trigger), outbox                                       | `auth.file.added`                    |
| [GET /auth/hydrate](#get-apiv1authhydrate)                                             | public                                                    | -                                                                                 | -                                    |
| [GET /auth/hydrate-many](#get-apiv1authhydrate-many)                                   | public                                                    | -                                                                                 | -                                    |
| [GET /auth/identities-public](#get-apiv1authidentities-public)                         | public                                                    | -                                                                                 | -                                    |
| [GET /auth/identity-ids](#get-apiv1authidentity-ids)                                   | public                                                    | -                                                                                 | -                                    |
| [GET /auth/identities](#get-apiv1authidentities)                                       | `@HasRoles(Admin)`                                        | -                                                                                 | -                                    |
| [GET /auth/identity/search/phone](#get-apiv1authidentitysearchphone)                   | `@HasRoles(Admin)`                                        | -                                                                                 | -                                    |
| [GET /auth/roles](#get-apiv1authroles)                                                 | `@HasRoles(Admin)`                                        | -                                                                                 | -                                    |
| [GET /auth/perms](#get-apiv1authperms)                                                 | `@HasRoles(Admin)`                                        | -                                                                                 | -                                    |
| [POST /auth/:id/roles](#post-apiv1authidroles)                                         | `@HasRoles(Admin)`                                        | `IdentityRole`, Redis revocation key                                              | -                                    |
| [DELETE /auth/:id/roles](#delete-apiv1authidroles)                                     | `@HasRoles(Admin)`                                        | `IdentityRole`, Redis revocation key                                              | -                                    |
| [POST /auth/:id/lock](#post-apiv1authidlock)                                           | `@HasPermissions(user:lock)` + rank check in auth         | `Identity`, outbox                                                                | `auth.user.locked`                   |
| [DELETE /auth/:id/lock](#delete-apiv1authidlock)                                       | `@HasPermissions(user:unlock)`                            | `Identity`                                                                        | -                                    |
| [POST /auth/google/calendar/exchange-code](#post-apiv1authgooglecalendarexchange-code) | authenticated                                             | `GoogleCalendarToken`                                                             | -                                    |
| [POST /auth/google/calendar/connect](#post-apiv1authgooglecalendarconnect)             | authenticated                                             | `GoogleCalendarToken`                                                             | -                                    |
| [DELETE /auth/google/calendar/connect](#delete-apiv1authgooglecalendarconnect)         | authenticated                                             | `GoogleCalendarToken`                                                             | -                                    |
| [GET /auth/google/calendar/token](#get-apiv1authgooglecalendartoken)                   | authenticated                                             | `GoogleCalendarToken` (on refresh)                                                | -                                    |
| [gRPC ValidateAccess](#grpc-validateaccess)                                            | gateway `JwtStrategy`                                     | -                                                                                 | -                                    |
| [gRPC ValidateRefresh](#grpc-validaterefresh)                                          | gateway `JwtRefreshStrategy`                              | -                                                                                 | -                                    |
| [gRPC FindIdentityIdsByRole](#grpc-findidentityidsbyrole)                              | notification service                                      | -                                                                                 | -                                    |
| [gRPC RefreshGoogleCalendarToken](#grpc-refreshgooglecalendartoken)                    | no caller in repo                                         | `GoogleCalendarToken`                                                             | -                                    |
| [BullMQ publish-deleted-files](#bullmq-publish-deleted-files-every-60-s)               | every 60 s                                                | `DeletedFile`, outbox                                                             | `auth.files.removed`                 |

## Session: mail register, login, refresh, logout

### POST /api/v1/auth/register

Create a mail/password account and start a session.

- **Access**: `@IsPublic()`, `CookieIssuanceGuard`, `@StrictThrottleByMail()` (10/min per `<ip>:<lowercased body.mail>`, plus 100/min per IP).
- **Flow**:
  1. Gateway `registerMail` (`auth.router.controller.ts:114`), DTO `RegisterMailDto`: `mail` `@IsEmail`, `username` `@IsString` only (no length/charset rule), `password` `@IsStrongPassword`. Calls `auth.AuthService/RegisterMail`.
  2. `AuthController.registerMail` → `MailRegisterCommandHandler` (`apps/auth/src/app/commands/handlers/mail-register.handler.ts`).
  3. Builds `Identity` + `Credential` (`loginType MAIL`, password bcrypt-hashed with `hashSync`, cost 10, in `credential.entity.ts:33`); adds the `student` role if `RoleReadRepository.findByName` finds it.
  4. `identityRepository.save` (one transaction): insert `Identity`, `IdentityRole`, `Credential`. No `@Transactional()` on the handler, so the following `getClaimsOfId` read and token signing run after commit.
  5. `TokenService.generateTokens(claims, true)` signs access + refresh JWT (RS256, `jti`, `iatMs`).
  6. Gateway `issueCookies` sets both cookies; response `data: null`.
- **Async**: none (register does not emit `auth.user.login`).
- **Errors**: 409 duplicate mail (`credentials (identifier, login_type)` unique) or username; 400 validation; 403 cross-site / foreign `Origin`. No e-mail verification step exists.

### POST /api/v1/auth/login

- **Access**: `@IsPublic()`, `CookieIssuanceGuard`, `@StrictThrottleByMail()`.
- **Flow**:
  1. Gateway `loginMail` (`:131`), DTO `LoginMailDto` (`mail` `@IsEmail`, `password` `@IsString`) → `auth.AuthService/LoginMail`.
  2. `MailLoginCommandHandler` (`mail-login.handler.ts`, `@Transactional()`): `findOneCredential(mail, MAIL)`; `bcrypt.compare` against the stored hash, or a dummy hash when the mail is unknown (same cost for both failure paths).
  3. Loads `Identity`; locked → 403. Loads claims (roles + permissions via `IdentityRole → Role → RolePermission → Permission`).
  4. `UserLoggedInPublisher.publish` → `outbox.add('auth.user.login', { uid, date })` (envelope) in the same transaction.
  5. Signs access + refresh tokens; gateway sets cookies; `data: null`.
- **Async**: `auth.user.login` → queue `achievement.events.user.login` → `apps/achievement/src/app/events/handlers/login.handler.ts` (inbox claim yes): login streak/total, may award badges.
- **Errors**: 401 `Invalid email or password` (unknown mail, wrong password, missing identity); 403 `Account locked`; 429.

### POST /api/v1/auth/refresh

Mint a new access + refresh token pair from a refresh token.

- **Access**: `@IsPublic()` (skips the access guard), `CookieIssuanceGuard`, then `JwtRefreshAuthGuard` (`refresh-jwt`), `@StrictThrottleByRefreshToken()` (10/min per `<ip>:sub:<id>` taken from the `refresh_token` cookie or Bearer).
- **Flow**:
  1. `JwtRefreshStrategy` (`apps/gateway/src/auth-gateway/strategies/jwt-refresh.strategy.ts`): token from `refresh_token` cookie, else `Authorization: Bearer`; RS256 verify with the public key; `refreshPayloadSchema.safeParse` (401 on mismatch).
  2. Calls [`ValidateRefresh`](#grpc-validaterefresh) → `req.user = { sub, roles, permissions }`.
  3. Gateway `refresh` (`:145`) → `auth.AuthService/Refresh({ identityId: sub })` → `RefreshCommandHandler` (`refresh.handler.ts`): reloads `Identity` (401 missing, 403 locked) and claims, signs a new pair.
  4. Gateway sets both cookies; `data: null`.
- **Notes**: the presented refresh token is not invalidated (no rotation/one-time use); it stays valid until `exp` or a revocation. Fresh claims are read on every refresh, so role changes apply.
- **Errors**: 401 missing/invalid/revoked token; 403 locked; 429.

### POST /api/v1/auth/logout

- **Access**: `@IsPublic()`, `CookieIssuanceGuard`.
- **Flow**: `clearAuthCookies` (`:158`); `data: null`. No gRPC call, no server-side revocation (tokens remain valid until expiry; use logout-all).

### POST /api/v1/auth/logout-all

Revoke every token of the caller.

- **Access**: authenticated. No `CookieIssuanceGuard` although it clears cookies (see Findings). Default throttle.
- **Flow**:
  1. Gateway `logoutAll` (`:172`) → `auth.AuthService/LogOutAll({ identityId: req.user.sub })`.
  2. `LogoutAllCommandHandler` (`logout-all.handler.ts`): load `Identity` (404 missing); `assertNotDemo` (403 for the shared demo account).
  3. `TokenService.revokeUser`: Redis `SETEX jwt:blacklist:user:<id> <JWT_REFRESH_TOKEN_EXPIRATION s, default 604800> <Date.now() ms>`. Every token with `iatMs <= value` is then refused by ValidateAccess/ValidateRefresh.
  4. Gateway clears cookies; `data: null`.
- **Errors**: 403 demo account; 401 if already revoked.

## Google sign-in and account linking

Design and cookie rationale: [Google login and account linking](../authorization.md#google-login-and-account-linking). Gateway Redis (`apps/gateway/src/configs/redis.config.ts`, a single ioredis client registered by `AuthGatewayModule`) is used only by this section:

| Key                               | Written by                    | TTL   | Value                                              |
| --------------------------------- | ----------------------------- | ----- | -------------------------------------------------- |
| `gateway:oauth2:state:<nonce>`    | `GoogleOAuth2Guard.startFlow` | 300 s | `{ identityId?, frontend? }`                       |
| `oauth2:google:loginToken:<uuid>` | `googleCallback`              | 60 s  | `auth.Tokens` JSON, or `true` for the linking flow |

Frontend resolution (`google-oauth-frontends.ts`): no `?frontend=` or the origin of `FE_LOGIN_REDIRECT_URL` → default (`BASE_URL` + `/api/v1/auth/google/callback`, land on `FE_LOGIN_REDIRECT_URL`); any other origin must be in `GOOGLE_OAUTH_FRONTENDS` (else 400 `Unknown frontend`), and the callback then goes through that origin.

### GET /api/v1/auth/google

Start a Google login/sign-up (redirect to Google).

- **Access**: `@IsPublic()`, `GoogleOAuth2Guard` (`apps/gateway/src/auth/guards/google-oauth2.guard.ts:85`).
- **Flow**:
  1. Resolve `?frontend`. Default frontend and no session → no `state` at all (passport-oauth2's default state store is not used, so nothing is checked on return).
  2. Non-default frontend → random nonce, Redis `SET gateway:oauth2:state:<nonce> {frontend} EX 300`, `state=<nonce>`, `callbackURL=<origin>/api/v1/auth/google/callback`.
  3. Passport redirects to Google (scopes `email profile`).
- **Errors**: 400 unknown frontend.

### GET /api/v1/auth/credentials/google

Start linking a Google account to the signed-in identity. Must be a top-level navigation.

- **Access**: authenticated (the global `JwtAuthGuard` sets `req.user` before `GoogleOAuth2Guard`).
- **Flow**: as `GET /google`, but `req.user.sub` is present, so the state record is always written (`{ identityId, frontend? }`, 300 s) and an `oauth2_state=<nonce>` cookie is set (HttpOnly, Lax, Path=`/api/v1/auth/google/callback`, 300 s) to bind the flow to this browser.
- **Errors**: 401 no session; 400 unknown frontend.

### GET /api/v1/auth/google/callback

Google's redirect target. Always answers with a redirect to the frontend login callback page, never JSON.

- **Access**: `@IsPublic()`, `GoogleOAuth2CallbackGuard`, `GoogleOAuthCallbackFilter`.
- **Flow**:
  1. `GoogleOAuth2CallbackGuard.consumeState` (`google-oauth2.guard.ts:140`): no `state` → default frontend, login flow. Otherwise read `gateway:oauth2:state:<state>` (missing → 401); re-resolve the frontend; for a linking record require the `oauth2_state` cookie to equal the state (401 otherwise, checked before deletion); `DEL` the key, and 0 deleted → 401 (single use). Sets `req.googleOAuth = { identityId?, frontend }`.
  2. Passport exchanges the code with Google using the same callback URL, then `GoogleOAuth2Strategy.validate` (`strategies/google-oauth2.strategy.ts:45`):
     - **Linking** (`identityId` set): gRPC `GetCredentials`; already has a `GOOGLE` credential → `GOOGLE_ALREADY_LINKED` (409). Else gRPC `AddGoogleCredential({ identifier: googleId, identityId })` → `AddGoogleCredCommandHandler`: 404 missing identity; 409 if the Google id belongs to another identity (mapped to `GOOGLE_ACCOUNT_IN_USE`); `identity.addCredential` (403 demo, 409 duplicate type) → `save` inserts `Credential`. Result `true`.
     - **Login/sign-up**: gRPC `RegisterOrLoginGoogle({ identifier: googleId, username: randomUUID(), fullName, email })` → `GoogleRegisterOrLoginCommandHandler` (`google-register-or-login.handler.ts`, `@Transactional()`):
       - credential `(googleId, GOOGLE)` exists → **login**: load identity (401/403 locked); `fillMissingProfile` sets a missing `fullName` and replaces a UUID username with one derived from the e-mail local part (`save`, `Identity` version bump); outbox `auth.user.login`; tokens.
       - no credential → **sign-up**: username = e-mail local part (`[a-z0-9._-]`, max 30), retried with a random 4-hex suffix up to 5 times, checked against active and soft-deleted identities, else the UUID fallback; new `Identity` + `Credential` (no secret) + `student` role in one `save`; tokens. No `auth.user.login` on sign-up. The Google e-mail is not stored as a credential.
  3. Gateway `googleCallback` (`auth.router.controller.ts:199`): `SETEX oauth2:google:loginToken:<uuid> 60 <tokens | true>`; redirect to `<frontend loginRedirectUrl>?loginToken=<uuid>[&flow=link]`.
  4. On any error the filter redirects to the same page with `?error=` (`ACCESS_DENIED`, `SESSION_EXPIRED` for 401, `FORBIDDEN` for 403, `GOOGLE_ALREADY_LINKED`, `GOOGLE_ACCOUNT_IN_USE`, else `GOOGLE_FAILED` and an error log).
- **Async**: `auth.user.login` (existing-account login only) → achievement, as in [login](#post-apiv1authlogin).
- **Notes**: the `oauth2_state` cookie is not cleared after use (it expires after 300 s).

### POST /api/v1/auth/google/tokens

Exchange the one-time `loginToken` for session cookies.

- **Access**: `@IsPublic()`, `CookieIssuanceGuard`; body must be `application/json` (415 otherwise). Default throttle.
- **Flow** (`:226`): DTO `ExchangeGoogleLoginTokenDto` (`loginToken` string); Redis `GET oauth2:google:loginToken:<t>` (missing → 401 `Invalid or expired login token`), then `DEL`; if the value is a token object, `setAuthCookies`; linking flow (`true`) sets nothing. `data: null`.
- **Errors**: 401, 403, 415.

## Credentials

### POST /api/v1/auth/credentials/mail

Add a mail/password sign-in method.

- **Access**: authenticated, `@StrictThrottleBySession()` (10/min per `<ip>:sub:<id>`).
- **Flow**: DTO `AddMailCredDto` (`@IsEmail`, `@IsStrongPassword`) + `identityId = req.user.sub` → `AddMailCredential` → `AddMailCredCommandHandler`: load identity (404), `addCredential` (403 demo; 409 if a `MAIL` credential already exists), `save` inserts `Credential` (bcrypt hash). Response `data: null`.
- **Errors**: 409 mail used by another identity (unique index); 403 demo.

### DELETE /api/v1/auth/credentials/:id

- **Access**: authenticated; the credential must belong to `req.user.sub`.
- **Flow**: `RemoveCredential({ id, identityId })` → `RemoveCredCommandHandler`: load identity, `deleteCredential` (403 demo, 404 not one of the caller's credentials, 405 last credential) → `save` deletes the `Credential` row. Sessions are not revoked.
- **Errors**: 404; 403; last credential returns HTTP **499** (405 → gRPC CANCELLED).

### POST /api/v1/auth/credentials/mail/password

Change the password of a mail credential.

- **Access**: authenticated, `@StrictThrottleBySession()`.
- **Flow**: DTO `UpdateMailPasswordDto` (`id` = credential id, `currentPassword` min 1, `password` `@IsStrongPassword`) → `UpdateMailPassword` → `UpdatePasswordCommandHandler` (`update-password.handler.ts`): load identity (404); `assertNotDemo` (403, checked before the password); find the credential among the caller's (404); `bcrypt.compare` current password (401 `Wrong password`); `updateCredential` rehashes → `save` updates `Credential`; then `revokeUser` (Redis revocation key, outside the transaction).
- **Notes**: the caller's own current tokens are revoked too; the response does not clear or reissue cookies, so the next request is 401 and the client must log in again.
- **Errors**: 401, 403, 404, 409.

### GET /api/v1/auth/credentials

Authenticated. `GetCredentials({ identityId: sub })` → `GetCredentialsQueryHandler` → `Credential` rows → `CredentialsDto` (`id`, `type`, `mail` only for `MAIL`).

## Profile and identity lookups

### GET /api/v1/auth/my/identity

Authenticated. `HydrateIdentity({ identityId: sub })` → `HydrateQueryHandler`: `Identity` + role names; avatar file id turned into a URL via file-service gRPC `GetUrls` (raw id kept if file-service fails). Response `HydratedIdentityDto` (includes `phoneNumber`, `isDemo`). 404 if missing.

### POST /api/v1/auth/my/identity

Update the caller's profile.

- **Access**: authenticated.
- **Flow**:
  1. DTO `UpdateIdentityDto`: optional `username`, `fullName`, `bio`, `avatarId`, `phoneNumber` (strings), and `set*Null` booleans; `identityId = sub` → `UpdateIdentity`.
  2. `UpdateIdentityCommandPayload` turns `set*Null` into `null`. `UpdateIdentityCommandHandler` (`update-identity.handler.ts`, `@Transactional()`): load identity (404).
  3. If `avatarId` is new: `FileOwnershipService.assertOwnedBy` → file-service gRPC `CheckFilesOwnedBy` (403 listing foreign ids; no admin override; re-sending the current avatar skips it).
  4. `updateDetails` (403 if the demo account changes username/phone) → `save` updates `Identity` (version check). DB trigger `identities_after_update_avatar` (migration `20260418163535_add_deleted_file_trigger`) upserts the previous avatar id into `deleted_files` (`count + 1`) when `avatar_file_id` changes.
  5. `FileAddedPublisher`: for an `IdentityAvatarUpdatedEvent` with a non-null id, `outbox.add('auth.file.added', { fileId })`.
- **Async**: `auth.file.added` → queue `file.events.file.added` → file-service `file-added.handler.ts` (inbox yes): `refCount + 1`. The old avatar is released later by the [BullMQ job](#bullmq-publish-deleted-files-every-60-s).
- **Errors**: 409 username/phone taken; 403 foreign file or demo; 404.

### GET /api/v1/auth/hydrate

Public. `@Query('id')` (no DTO) → `HydrateIdentity` → as `my/identity`, but serialized as `PublicIdentityDto` (`id`, `username`, `fullName`, `bio`, `avatarUrl`, `roles`; phone stripped). Soft-deleted identities are returned too. 404 if unknown.

### GET /api/v1/auth/hydrate-many

Public. `HydrateIdentitiesQueryDto.ids` (`ToStringArray`, max 100) → `HydrateIdentities` → `HydrateManyQueryHandler`: `Identity where id in ids` + file-service `GetUrls` for avatars (failure ignored). `PublicIdentitiesDto`. Unknown ids are silently omitted.

### GET /api/v1/auth/identities-public

Public username search. `FindIdentitiesLimitedDto` (`usernameOrCredIdentifier`, `cursor`, `limit` `@IsPositive`, no max) → `FindIdentities` with `usernameOnly: true`, empty role/perm filters → `FindIdentitiesQueryHandler`: HMAC-signed cursor (`CursorPaginationHelper`), the cursor's own filters win but `usernameOnly` can only be narrowed; Prisma `username contains`, `orderBy id`, default limit 10; avatar URLs from file-service (failure → 503). Serialized as `LimitedIdentitiesDto` (no phone, roles, lock state).

### GET /api/v1/auth/identity-ids

Public. `FindIdentityIdsDto` + `usernameOnly: true` → `FindIdentityIdsQueryHandler` → ids of identities whose username contains the term, signed cursors. `IdentityIdsDto`. `limit` has no upper bound.

## Admin

### GET /api/v1/auth/identities

`@HasRoles(Admin)`. `FindIdentitiesDto` (`usernameOrCredIdentifierOrId`, `hasRoles[]`, `hasPerms[]`, `cursor`, `limit`) → `FindIdentitiesQueryHandler` (as above, without `usernameOnly`: also matches credential identifiers (e-mails, Google ids) and id substrings; role/permission filters OR-ed). `IdentitiesDto` with roles, permissions, phone, `isLocked`. Includes soft-deleted identities. 503 if file-service is down.

### GET /api/v1/auth/identity/search/phone

`@HasRoles(Admin)`. Individual `@Query('phoneNumber' | 'cursor' | 'limit')` params (no DTO) → `FindIdentitiesByPhone` → `FindIdentitiesByPhoneQueryHandler`: `phoneNumber contains`, signed cursor, file-service avatar URLs (503 on failure). `IdentitiesDto`.

### GET /api/v1/auth/roles

`@HasRoles(Admin)`. `GetRoleList` → `Role` + permissions → `RolesDto`.

### GET /api/v1/auth/perms

`@HasRoles(Admin)`. `GetPermList` → all `Permission.name` → `PermissionsDto`.

### POST /api/v1/auth/:id/roles

- **Access**: `@HasRoles(Admin)`.
- **Flow**: `AssignRoleToDto.roleId` + path `id` → `AssignRoleTo` → `AssignRoleToCommandHandler`: load identity (404), `addRole` (409 already has it), `save` inserts `IdentityRole`, then `revokeUser(id)` (Redis revocation key) so the target must re-login and gets new claims.
- **Errors**: 404, 409; an unknown `roleId` is not checked and fails on the FK (unmapped Prisma error → 502).

### DELETE /api/v1/auth/:id/roles

`@HasRoles(Admin)`. Body `RemoveRoleFromDto.roleId` → `RemoveRoleFromCommandHandler`: `removeRole` (409 if absent) → `save` deletes `IdentityRole` → `revokeUser(id)`.

### POST /api/v1/auth/:id/lock

- **Access**: `@HasPermissions(Permission.USER_LOCK)` (Admin and Mod per `apps/auth/prisma/seed.ts`); `lockedBy = req.user.sub`.
- **Flow**: `LockIdentity` → `LockIdentityCommandHandler` (`lock-identity.handler.ts`, `@Transactional()`): 404 missing; 403 self-lock; ranks from current DB claims (Admin 2 > Mod 1 > others 0), target rank must be strictly lower (403); `lock` (409 already locked) → `save` sets `is_locked`, `locked_at`, `locked_by`; `IdentityLockedPublisher` → `outbox.add('auth.user.locked', { identityId, lockedBy })`.
- **Async**: `auth.user.locked` has no consumer in this repo (backlog S17). Tokens are not revoked; ValidateAccess/ValidateRefresh refuse a locked identity with 403 on the next request.
- **Errors**: 403, 404, 409.

### DELETE /api/v1/auth/:id/lock

`@HasPermissions(Permission.USER_UNLOCK)` (Admin only per seed). `UnlockIdentityCommandHandler`: 404; `unlock` (409 if not locked) → `save` clears the lock columns; `eventBus.publishAll` of `IdentityUnlockedEvent` in-process (no handler exists). No rank check, no outbox event.

## Google Calendar

### POST /api/v1/auth/google/calendar/exchange-code

- **Access**: authenticated. Default throttle.
- **Flow**: DTO `ExchangeGoogleCalendarCodeDto.code` → the **gateway** POSTs `https://oauth2.googleapis.com/token` (`grant_type=authorization_code`, `redirect_uri=postmessage`, gateway client id/secret) (`:432`); non-2xx → 401. Then gRPC `ConnectGoogleCalendar({ identityId: sub, accessToken, refreshToken ?? '', expiresAt: now + expires_in, scopes })` → [connect flow](#post-apiv1authgooglecalendarconnect). Response `GoogleCalendarConnectionDto { connected, expiresAt }`.

### POST /api/v1/auth/google/calendar/connect

- **Access**: authenticated; tokens come from the client (`ConnectGoogleCalendarDto`: `accessToken`, `refreshToken`, `expiresAt` number, `scopes`).
- **Flow**: `ConnectGoogleCalendarCommandHandler`: load identity (404), `assertNotDemo` (403); empty `refreshToken` keeps the stored one; `GoogleCalendarToken` upsert by `identity_id`. Returns `{ connected: true, expiresAt }`.

### DELETE /api/v1/auth/google/calendar/connect

Authenticated. `DisconnectGoogleCalendarCommandHandler` → `GoogleCalendarToken` delete by `identityId`. Google's grant is not revoked.

### GET /api/v1/auth/google/calendar/token

- **Access**: authenticated.
- **Flow**: `GetGoogleCalendarTokenQueryHandler` (`get-google-calendar-token.handler.ts`): 404 no row; still valid for more than 60 s → return stored access token; no refresh token → 401 reconnect; else the **auth service** POSTs `oauth2.googleapis.com/token` (`grant_type=refresh_token`; non-2xx → 401) and upserts the new access token/expiry (a write inside a query handler). Response `GoogleCalendarAccessTokenDto { accessToken, expiresAt }`; the refresh token is never returned.

## gRPC-only methods

### gRPC ValidateAccess

Called by `JwtStrategy.validate` for every authenticated HTTP request (live's socket handshake does not call it, backlog S17). `ValidateAccessCommandHandler`: `TokenService.isTokenRevoked` (Redis `GET jwt:blacklist:user:<id>`; values below 1e11 are treated as seconds) → 401 `Token has been revoked`; `findOneById` (credentials + role ids) → 401 missing, 403 locked. Returns empty.

### gRPC ValidateRefresh

Called by `JwtRefreshStrategy.validate`. Same revocation/identity/lock checks, then `getClaimsOfId`; returns `{ sub, roles, permissions }`.

### gRPC FindIdentityIdsByRole

Called by notification `report-created.handler.ts` with `role: admin`. `FindIdentityIdsByRoleQueryHandler`: ids of non-deleted, non-locked identities with that role, `orderBy id`, max 500.

### gRPC RefreshGoogleCalendarToken

Same handler as `GET /google/calendar/token` (`GetGoogleCalendarTokenQuery`); it only refreshes when the stored token is near expiry. No caller in this repo.

## Background work

- **RabbitMQ consumers**: none. auth registers a `sub` connection (`configs/rmq.sub.config.ts`) but has no `@RabbitSubscribe` handler.
- **Outbox relay**: `MessagingModule.forRoot({ serviceName: 'auth', relay: true })` (`apps/auth/src/auth.module.ts:64`) polls `outbox_events` every second and publishes to `eventbus`; see [messaging.md, the relay](../messaging.md#4-the-relay-outboxrelay). Events written by auth: `auth.user.login`, `auth.user.locked`, `auth.file.added`, `auth.files.removed` (all envelope).
- **Redis (auth service)**: only `jwt:blacklist:user:<id>` (ms timestamp, TTL = refresh token lifetime), plus BullMQ's own keys on the same Redis (`configs/bullmq.config.ts`).

### BullMQ publish-deleted-files (every 60 s)

- **Schedule**: `FilesRemovedScheduler.onModuleInit` adds repeatable job `publish-deleted-files` (`jobId` fixed, `repeat.every 60000`) to queue `auth` (`apps/auth/src/app/events/publisher/files-removed.publisher.ts`).
- **Processor**: `FilesRemovedPublisher` (`@Processor('auth')`) loops `publishBatch` until empty. Each batch (`@UseCls() @Transactional()`): `DELETE FROM deleted_files WHERE file_id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100) RETURNING file_id, count` (`file.prisma.repository.impl.ts`) and `outbox.add('auth.files.removed', { files: [{ id, count }] })` in the same transaction. On error the batch rolls back, the job is logged and rethrown (BullMQ marks it failed; rows stay).
- **Input**: `deleted_files` is filled only by the DB trigger on `identities` (avatar changed, or row hard-deleted).
- **Async**: `auth.files.removed` → queue `file.events.files.removed` → file-service `files-removed.handler.ts` (inbox yes): decrements `refCount` by `count`.

## Findings

1. `libs/utils/src/types/payload.type.ts:13` + `apps/auth/src/configs/jwt-refresh.config.ts`: access and refresh tokens are signed with the same private key and have no type claim, and `refreshPayloadSchema` (a non-strict `payloadSchema.omit`) accepts an access token, so `POST /auth/refresh` with an access token as Bearer mints a 7-day refresh token from a 15-minute access token.
2. `apps/gateway/src/auth/guards/google-oauth2.guard.ts:101`: the default-frontend Google login sends no `state` and the strategy uses passport-oauth2's null state store, so `/google/callback` accepts any code; an attacker's own code sent to a victim yields a `loginToken` redirect that the frontend exchanges, logging the victim into the attacker's account (login CSRF), unless the frontend adds its own check (unclear, frontend not in this repo).
3. `apps/gateway/src/auth-gateway/auth.router.controller.ts:245-249`: the Google `loginToken` exchange is `GET` then `DEL`, not atomic, so two concurrent requests with the same token can both receive cookies (the callback guard uses the `DEL` result as its single-use gate; this route does not).
4. Refresh tokens are not rotated or invalidated on use (`refresh.handler.ts`); a stolen refresh token keeps working until `exp` or a logout-all.
5. `apps/auth/src/domain/entities/identity.entity.ts:159`: "Cannot remove your last credential" is a `MethodNotAllowedException` (405), which `GlobalRpcExceptionFilter` maps to gRPC CANCELLED and the gateway to HTTP 499.
6. `apps/auth/src/infra/repositories/identity.prisma.repository.impl.ts:163`: an optimistic-version miss on `update` raises Prisma P2025, which is not mapped and reaches the client as 502; the same goes for the FK failure of `POST /:id/roles` with an unknown `roleId` (`assign-role-to.handler.ts`) and for a malformed cursor (`CursorPaginationHelper.decodeCursor` throws a plain `Error`).
7. ~~Doc drift~~: `messaging.md` §7 said Google sign-up emits `auth.user.login`; corrected (only logins to an existing account do).
8. `auth.router.controller.ts:172`: `logout-all` clears the session cookies but has no `CookieIssuanceGuard`, unlike AGENTS.md's rule for cookie-clearing routes (the SameSite=Lax access cookie limits the impact).
9. `auth.router.controller.ts:415-429`: `GET /identity/search/phone` uses individual `@Query()` params instead of a DTO, so `limit` has no bounds and an absent `phoneNumber` arrives as an empty string and matches every identity; public `identity-ids` and `identities-public` and admin `identities` also have no `@Max` on `limit`.
10. `apps/auth/src/infra/repositories/identity.read.prisma.repository.impl.ts`: `findIdentities`, `findIdentityIds`, `findIdentitiesByPhone`, `hydrate` and `hydrateMany` have no `deletedAt` filter, so soft-deleted identities appear in public search and hydration.
11. `update-password.handler.ts:34`: the password change revokes the caller's own session, but the gateway returns success without clearing or reissuing cookies, so the client gets 401 on its next call with no hint.
12. `apps/gateway/src/throttle.ts:55`: no throttler `storage` is configured, so the in-memory store makes every limit (including the 10/min login limit) per gateway replica.
13. `apps/auth/src/domain/entities/credential.entity.ts:33`: passwords are hashed with `bcrypt.hashSync` on the request path, blocking the auth event loop for each register, add-mail-credential and password change.
14. `RegisterMailDto.username` and `UpdateIdentityDto.username` (gateway and service) are only `@IsString()`: no length, charset or empty-string check.
15. `google-oauth2.guard.ts:115-121`: the `oauth2_state` cookie's `secure` flag ignores `env === 'production'` (unlike the session cookies) and the cookie is never cleared after the callback.
