# Plan: Central Authorization Service

## Overview

A dedicated `authorization` microservice acting as the Policy Decision Point (PDP). All resource-level authorization decisions are centralized here. Services publish ownership/relationship events; the gateway consults this service for every access check.

## Architecture

```
                     ┌───────────────────┐
                     │   Client/Frontend │
                     └────────┬──────────┘
                              │ HTTP
                     ┌────────▼──────────┐
                     │     Gateway       │
                     │  (PEP - enforce)  │
                     │ JwtAuthGuard ──►  │
                     │ RolesGuard        │
                     │ PermissionsGuard  │
                     │ AuthzInterceptor  │──┐
                     └────────┬──────────┘  │ gRPC
                              │              │
              ┌───────────────┼──────────────┼──┐
              │               │              │  │
     ┌────────▼────────┐ ┌───▼────────┐ ┌───▼──▼──────┐
     │   Auth Service  │ │Exam Service│ │ Authz Service│
     │ (identity, JWT) │ │            │ │   (PDP)     │
     └────────┬────────┘ └───┬────────┘ │             │
              │              │          │ • ownership │
              │   ┌──────────┤          │ • policies  │
              │   │ publish  │          │ • decisions │
              │   │ events   │          │ • audit log │
              │   ▼          │          └──────┬───────┘
              │  ┌──────────────────┐          │
              │  │   RabbitMQ      │◄─────────┤
              │  │ (eventbus)      │          │ subscribe
              │  └──────────────────┘          │ to events
              │                               │
              │  ┌──────────────────┐          │
              └──►   Redis         │◄─────────┘
                 │ (cache, lock)   │
                 └──────────────────┘
```

## Components

### 1. Authorization Service (`apps/authorization`)

A new NestJS gRPC microservice with its own database.

**gRPC API:**

```protobuf
service AuthorizationService {
  // Check a single permission
  rpc CheckPermission (CheckPermissionRequest) returns (CheckPermissionResponse);

  // Check multiple permissions in one call
  rpc CheckPermissions (CheckPermissionsRequest) returns (CheckPermissionsResponse);

  // Register a resource (called internally via events or directly)
  rpc RegisterResource (RegisterResourceRequest) returns (RegisterResourceResponse);

  // Get all permissions for a user on a resource (for UI rendering)
  rpc WhatCanIDo (WhatCanIDoRequest) returns (WhatCanIDoResponse);
}

message CheckPermissionRequest {
  string user_id;
  string resource_type;  // "exam", "blog", "flashcard_list", etc.
  string resource_id;
  string action;         // "read", "update", "delete", "approve", etc.
  map<string, string> context;  // environment context (IP, time, etc.)
}

message CheckPermissionResponse {
  bool allowed;
  string reason;         // why denied (for debugging / user feedback)
  string decision_id;    // for audit trail
}
```

**Database Schema:**

```sql
-- Resource ownership (populated via domain events)
CREATE TABLE resources (
    id            TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    owner_id      TEXT NOT NULL,      -- identity ID
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resource hierarchy (e.g., exam -> section -> question)
CREATE TABLE resource_relations (
    parent_id TEXT NOT NULL REFERENCES resources(id),
    child_id  TEXT NOT NULL REFERENCES resources(id),
    relation  TEXT NOT NULL DEFAULT 'contains',
    PRIMARY KEY (parent_id, child_id)
);

-- Resource-scoped roles (collaborators)
CREATE TABLE resource_roles (
    id          TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    identity_id TEXT NOT NULL,
    role        TEXT NOT NULL,  -- "editor", "viewer", "admin"
    granted_by  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (resource_id, identity_id, role)
);

-- Authorization policies (ABAC-style rules)
CREATE TABLE policies (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    resource_type TEXT NOT NULL,
    actions       TEXT[] NOT NULL,     -- ["read", "update", "delete"]
    effect        TEXT NOT NULL,       -- "allow" | "deny"
    conditions    JSONB,              -- optional ABAC conditions
    priority      INT NOT NULL DEFAULT 0,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decision audit log
CREATE TABLE decision_logs (
    id            TEXT PRIMARY KEY,
    decision_id   TEXT NOT NULL UNIQUE,
    user_id       TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id   TEXT,
    action        TEXT NOT NULL,
    allowed       BOOLEAN NOT NULL,
    context       JSONB,
    evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. Gateway Authorization Interceptor

New global interceptor in the gateway that runs after `JwtAuthGuard`.

```typescript
// Concept
@Injectable()
export class AuthorizationInterceptor implements NestInterceptor {
  constructor(
    private readonly authzClient: AuthorizationServiceClient,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const resourceMeta = this.reflector.get<ResourceMeta>('resource', context.getHandler());
    if (!resourceMeta) return next.handle(); // skip if no resource annotation

    const request = context.switchToHttp().getRequest();
    const user = request.user as Claims;
    const resourceId = this.extractResourceId(request, resourceMeta.param);
    const action = resourceMeta.action;

    const { allowed } = await firstValueFrom(
      this.authzClient.checkPermission({
        userId: user.sub,
        resourceType: resourceMeta.type,
        resourceId,
        action,
      }),
    );

    if (!allowed) throw new ForbiddenException('Insufficient permissions');
    return next.handle();
  }
}
```

**Route decorator:**

```typescript
// Usage on controller methods
@Resource({ type: 'exam', param: 'id', action: 'update' })
@Patch(':id')
updateExam(@Param('id') id: string, @Body() dto: UpdateExamDto) {
  // ...
}
```

### 3. Event Publishers in Each Service

Each service publishes domain events when resources are created/updated/deleted.

```typescript
// In exam service, after creating an exam:
await this.eventBus.publish(new ResourceCreatedEvent({
  resourceType: 'exam',
  resourceId: exam.id,
  ownerId: exam.createdBy,
  parentId: null,
}));

// In resource service, after creating a blog:
await this.eventBus.publish(new ResourceCreatedEvent({
  resourceType: 'blog',
  resourceId: blog.id,
  ownerId: blog.authorId,
  parentId: null,
}));
```

**RabbitMQ exchange:** `authorization` (topic)

**Event types:**
- `resource.created` — new resource, capture ownership
- `resource.deleted` — remove resource + relations
- `resource.owner.changed` — transfer ownership
- `resource.role.granted` — share with collaborator
- `resource.role.revoked` — remove collaborator

### 4. Decision Caching (Redis)

Cache decisions in Redis to reduce load on the authorization service:

```typescript
// Cache key: authz:decision:{userId}:{resourceType}:{resourceId}:{action}
// TTL: 30 seconds (or less for sensitive actions)
// Invalidation: on resource ownership change, flush relevant keys
```

## Default Policies

Built-in policies ship with the service:

| Policy | Resource Type | Actions | Effect | Condition |
|---|---|---|---|---|
| Owner Full Access | * | * | allow | `user_id == resource.owner_id` |
| Admin Super Access | * | * | allow | user has `Admin` role |
| Public Read | blog, exam | read | allow | `resource.is_public == true` |
| Collaborator Access | * | [assigned role actions] | allow | user has resource_role |

## Decision Flow (Full)

```
1. Request hits gateway
2. JwtAuthGuard validates token, populates req.user
3. AuthorizationInterceptor reads @Resource() decorator
4. Interceptor checks Redis cache for (userId, resourceType, resourceId, action)
   a. Cache HIT → return cached decision
   b. Cache MISS → gRPC call to Authz Service
5. Authz Service:
   a. Fetch ownership / resource roles
   b. Evaluate matching policies (ordered by priority)
   c. Allow if any "allow" matches, deny if any "deny" matches
   d. Log decision to decision_logs table
   e. Return decision
6. Interceptor caches decision in Redis (TTL 30s)
7. If allowed → proceed to route handler
8. If denied → 403 Forbidden
```

## Migration Strategy

### Phase 1: Foundation
- Scaffold `authorization` app with gRPC + database
- Implement `CheckPermission` RPC with ownership-based policy
- Add `ResourceCreatedEvent` + publisher to one service (e.g., resource/blog)
- Add `AuthorizationInterceptor` to gateway with feature flag

### Phase 2: Adoption
- Add event publishers to exam service, resource service, etc.
- Add route decorators to all mutation endpoints
- Implement dashboard API for viewing/editing resource permissions
- Implement collaborator/resource-role management

### Phase 3: Advanced Policies
- Implement ABAC conditions (time-based, attribute-based)
- Implement policy management UI
- Implement `WhatCanIDo` for UI rendering
- Performance tuning (cache tuning, connection pooling)

## Pros & Cons

**Pros:**
- Single source of truth for all authorization data
- Complete audit trail of every decision
- Can implement any policy model (RBAC, ABAC, ReBAC)
- Easy to audit, debug, and visualize
- Policies can be updated without redeploying services
- Well-understood centralized pattern

**Cons:**
- Added latency: every resource-level check requires a gRPC call (mitigated by Redis cache)
- Authorization service is a potential SPOF (mitigated by circuit breaker + cache)
- Requires all services to publish resource lifecycle events
- More infrastructure to deploy, monitor, and maintain
- Gateway becomes even more critical and heavier
- Ownership events can be lost if RabbitMQ is down (mitigated by dead letter + replay)
