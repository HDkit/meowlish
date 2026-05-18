# Plan: Hybrid Distributed Authorization

## Overview

A **control plane** manages policies and authorization data centrally, but **enforcement happens locally** inside each service. Each service embeds an Authorization Enforcer module that caches policies and ownership data, evaluates decisions in-process (zero network hop), and subscribes to policy changes via RabbitMQ.

This is the "distributed execution, centralized management" model described in the Oso / Aserto blog.

## Architecture

```
                        ┌──────────────────────┐
                        │   Control Plane       │
                        │ (authorization-mgmt)  │
                        │                       │
                        │ • Policy CRUD API     │
                        │ • Source of truth     │
                        │ • Decision log aggr.  │
                        │ • Data management     │
                        └──┬────▲────┬──▲────┬──┘
                           │    │    │  │    │
                  publish  │    │    │  │    │ subscribe
                  policy   │    │    │  │    │ decisions
                  updates  │    │    │  │    │
                     ┌─────┘    │    │  │    └──────┐
                     ▼          │    │  │           ▼
              ┌──────────────┐  │    │  │  ┌──────────────┐
              │   RabbitMQ   │◄─┘    │  └──┤   RabbitMQ   │
              │ auth.policy  │       │     │ auth.decisions│
              │ auth.data    │       │     └──────────────┘
              └──────────────┘       │
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
 ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
 │  Exam Service   │     │ Resource Svc   │     │  Other Svc     │
 │                 │     │                │     │                │
 │ AuthzEnforcer   │     │ AuthzEnforcer  │     │ AuthzEnforcer  │
 │ Module (local)  │     │ Module (local) │     │ Module (local) │
 │                 │     │                │     │                │
 │ • cache         │     │ • cache        │     │ • cache        │
 │ • eval engine   │     │ • eval engine  │     │ • eval engine  │
 │ • interceptor   │     │ • interceptor  │     │ • interceptor  │
 └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
          │                       │                       │
  gRPC in │                       │                       │
          ▼                       ▼                       ▼
   ┌──────────┐            ┌──────────┐            ┌──────────┐
   │ Postgres │            │ Postgres │            │ Postgres │
   └──────────┘            └──────────┘            └──────────┘
```

## Components

### 1. Control Plane Service (`apps/authorization`)

A lightweight NestJS gRPC + HTTP service that is the **source of truth** for authorization.

**Responsibilities:**

- **Policy management**: CRUD API for authorization policies
- **Data management**: API to register/update/delete resource ownership and attributes
- **Initial sync**: gRPC endpoint returning full policy set on service startup
- **Delta sync**: publish policy/data changes to RabbitMQ topic `auth.policy` / `auth.data`
- **Decision log aggregation**: consumes decision logs from services via RabbitMQ
- **Health / monitoring**: expose metrics for cache staleness, decision volume, etc.

**Database Schema:**

```sql
-- Policies (versioned for cache invalidation)
CREATE TABLE policies (
    id            TEXT PRIMARY KEY,
    version       INT NOT NULL DEFAULT 1,
    name          TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    actions       TEXT[] NOT NULL,
    effect        TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    conditions    JSONB,
    priority      INT NOT NULL DEFAULT 0,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resource ownership (the authorization data that changes)
CREATE TABLE resources (
    id            TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    owner_id      TEXT NOT NULL,
    is_public     BOOLEAN NOT NULL DEFAULT false,
    attributes    JSONB DEFAULT '{}',
    version       INT NOT NULL DEFAULT 1,  -- for delta sync
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resource roles / collaborators
CREATE TABLE resource_roles (
    resource_id TEXT NOT NULL REFERENCES resources(id),
    identity_id TEXT NOT NULL,
    role        TEXT NOT NULL,
    PRIMARY KEY (resource_id, identity_id)
);

-- Consolidated decision logs
CREATE TABLE decision_logs (
    id            TEXT PRIMARY KEY,
    service_name  TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    action        TEXT NOT NULL,
    allowed       BOOLEAN NOT NULL,
    context       JSONB,
    evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**gRPC API (for initial sync only):**

```protobuf
service AuthorizationControlPlane {
  // Called on service startup to pull all policies + data
  rpc SyncFull (SyncFullRequest) returns (SyncFullResponse);

  // Called when a service detects it may be out of sync
  rpc SyncDelta (SyncDeltaRequest) returns (SyncDeltaResponse);

  // Register a resource (fallback if events are missed)
  rpc RegisterResource (RegisterResourceRequest) returns (RegisterResourceResponse);
}

message SyncFullResponse {
  repeated Policy policies;
  repeated Resource resources;
  int64 policy_version;
  int64 data_version;
}

message SyncDeltaRequest {
  int64 since_policy_version;
  int64 since_data_version;
}

message SyncDeltaResponse {
  repeated Policy policies_created;
  repeated Policy policies_updated;
  repeated string policy_ids_deleted;
  repeated Resource resources_created;
  repeated Resource resources_updated;
  repeated string resource_ids_deleted;
  int64 current_policy_version;
  int64 current_data_version;
}
```

### 2. Authorization Enforcer (Shared Library `libs/authorization`)

Embedded in every service that needs resource-level authorization.

**Components:**

```typescript
// ─── AuthorizationEnforcerModule ──────────────────────────────────
// Import in any service that needs fine-grained authz
@Module({
  imports: [
    RabbitMQModule,           // for subscribing to policy updates
    RedisModule,              // for backup cache
  ],
  providers: [
    PolicyCache,
    OwnershipCache,
    DecisionEngine,
    AuthorizationInterceptor,  // gRPC interceptor
  ],
  exports: [AuthorizationInterceptor, DecisionEngine],
})
export class AuthorizationEnforcerModule {}

// ─── Policy Cache ─────────────────────────────────────────────────
// In-memory cache backed by Redis for persistence across restarts
@Injectable()
class PolicyCache {
  private policies: Map<string, Policy[]> = new Map(); // resourceType → policies
  private version: number = 0;

  // Called on service start
  async initialize() {
    // 1. Try loading from Redis
    const cached = await this.redis.get('authz:policies');
    // 2. If miss, gRPC call to control plane for SyncFull
    const fresh = await this.controlPlane.syncFull();
    // 3. Subscribe to RabbitMQ for deltas
    this.rabbitMQ.subscribe('auth.policy', this.handlePolicyDelta);
  }

  @RabbitMQHandler({ exchange: 'auth.policy', routingKey: '#' })
  handlePolicyDelta(msg: PolicyDeltaMessage) {
    // Apply incremental update to local cache
    // Update version
  }

  getPolicies(resourceType: string): Policy[] {
    return this.policies.get(resourceType) || [];
  }
}

// ─── Ownership Cache ──────────────────────────────────────────────
@Injectable()
class OwnershipCache {
  private resources: Map<string, Resource> = new Map(); // resourceId → Resource

  async initialize() { /* similar to PolicyCache */ }

  @RabbitMQHandler({ exchange: 'auth.data', routingKey: '#' })
  handleDataDelta(msg: DataDeltaMessage) {
    // Create/update/delete local cache entries
  }

  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }
}

// ─── Decision Engine ──────────────────────────────────────────────
@Injectable()
class DecisionEngine {
  async check(user: Claims, resourceType: string, resourceId: string, action: string): Promise<Decision> {
    const policies = this.policyCache.getPolicies(resourceType);
    const resource = this.ownershipCache.getResource(resourceId);

    // Sort by priority
    // For each policy:
    //   1. Check resource type match
    //   2. Check action match
    //   3. If conditions exist, evaluate them (ABAC)
    //   4. If effect is "deny" → DENY immediately
    //   5. If effect is "allow" → mark as allowed, continue
    // After all policies:
    //   If any "allow" matched → ALLOW
    //   Else → DENY
    const decision = this.evaluate(policies, user, resource, action);

    // Asynchronously log decision to control plane
    this.logDecision(decision);

    return decision;
  }
}
```

### 3. gRPC Authorization Interceptor

Applied globally or per-controller in each microservice:

```typescript
@Injectable()
class AuthorizationInterceptor implements GrpcInterceptor {
  constructor(
    private readonly decisionEngine: DecisionEngine,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const metadata = this.reflector.get<ResourceMeta>('resource', context.getHandler());
    if (!metadata) return next.handle();

    // Extract user from gRPC metadata (set by gateway from JWT)
    const grpcContext = GrpcContext.fromExecutionContext(context);
    const user = grpcContext.getUser(); // Claims with sub, roles, permissions

    const { resourceType, resourceId, action } = metadata;

    const decision = await this.decisionEngine.check(user, resourceType, resourceId, action);

    if (!decision.allowed) {
      throw new PERMISSION_DENIED({
        message: `Cannot ${action} ${resourceType}`,
      });
    }

    return next.handle();
  }
}
```

### 4. Event Flow for Data Synchronization

When a resource is created in any service:

```typescript
// In exam service
async createExam(dto: CreateExamDto, userId: string) {
  const exam = await this.prisma.exam.create({ data: { ...dto, createdBy: userId } });

  // Publish to the control plane's data topic
  await this.rabbitMQ.publish('auth.data', 'resource.created', {
    resourceType: 'exam',
    resourceId: exam.id,
    ownerId: userId,
    isPublic: false,
    attributes: {},
    version: 1,
    timestamp: new Date(),
  });

  return exam;
}
```

The control plane consumes this, updates its database, and re-publishes to all other service queues so their local caches are updated. Alternatively, services can subscribe directly to the same topic (simpler, but requires consistent routing).

**Simplified approach:** all services subscribe to the same `auth.data` topic. When any service creates a resource, it publishes to `auth.data.resource.created`. All services (including the control plane) consume this and update their local cache.

```typescript
// Every service subscribes:
@RabbitMQHandler({ exchange: 'auth.data', routingKey: 'resource.created' })
handleResourceCreated(msg: ResourceCreatedMessage) {
  this.ownershipCache.set(msg.resourceId, {
    id: msg.resourceId,
    resourceType: msg.resourceType,
    ownerId: msg.ownerId,
    isPublic: msg.isPublic,
    attributes: msg.attributes,
  });
}

// The control plane also persists:
@RabbitMQHandler({ exchange: 'auth.data', routingKey: 'resource.created' })
async persistResource(msg: ResourceCreatedMessage) {
  await this.prisma.resource.upsert({ ... });
}
```

## Startup & Sync Flow

```
Service Startup:
  1. Initialize PolicyCache
  2. Read from Redis backup → if valid, load into memory
  3. Subscribe to RabbitMQ `auth.policy` and `auth.data`
  4. gRPC SyncFull to control plane
  5. Apply any missed deltas (based on version)
  6. Register gRPC interceptor
  7. Ready to serve

Policy Update Flow:
  1. Admin updates policy via control plane API
  2. Control plane persists to DB, increments version
  3. Control plane publishes `auth.policy.updated` to RabbitMQ
  4. All services consume and update local cache
  5. New decisions use updated policies immediately

Data Update Flow:
  1. Service creates/deletes/updates a resource
  2. Service publishes `auth.data.resource.*` to RabbitMQ
  3. All services (including control plane) consume and update
  4. New decisions use updated ownership data
```

## Policy Model

Policies are stored as structured rules:

```json
{
  "id": "policy-001",
  "name": "Owner can do anything to their resource",
  "resourceType": "*",
  "actions": ["*"],
  "effect": "allow",
  "conditions": {
    "all": [
      { "field": "user.id", "operator": "eq", "value": "resource.owner_id" }
    ]
  },
  "priority": 100
}
```

```json
{
  "id": "policy-002",
  "name": "Admin can do anything",
  "resourceType": "*",
  "actions": ["*"],
  "effect": "allow",
  "conditions": {
    "any": [
      { "field": "user.roles", "operator": "contains", "value": "Admin" }
    ]
  },
  "priority": 200
}
```

```json
{
  "id": "policy-003",
  "name": "Public resources are readable by anyone",
  "resourceType": "*",
  "actions": ["read"],
  "effect": "allow",
  "conditions": {
    "all": [
      { "field": "resource.is_public", "operator": "eq", "value": true }
    ]
  },
  "priority": 50
}
```

Policies are evaluated in priority order. DENY rules take precedence over ALLOW rules. If no policy matches, the default is DENY.

## Directory Structure

```
apps/
  authorization/              ← Control Plane Service
    src/
      authorization.module.ts
      controllers/
        policy.controller.ts
        data.controller.ts
      services/
        policy.service.ts
        data.service.ts
        sync.service.ts
      consumers/
        decision-log.consumer.ts
        data-event.consumer.ts
    prisma/
      schema/
      seed.ts

libs/
  authorization/              ← Shared Enforcer Library
    src/
      authorization.module.ts
      cache/
        policy.cache.ts
        ownership.cache.ts
      engine/
        decision.engine.ts
        condition.evaluator.ts
      interceptor/
        authorization.interceptor.ts
      models/
        policy.model.ts
        decision.model.ts
      events/
        resource-created.event.ts
        resource-deleted.event.ts
```

## Migration Strategy

### Phase 1: Control Plane + Shared Library
- Scaffold `apps/authorization` with control plane (gRPC + DB)
- Implement policy CRUD, resource management, SyncFull/SyncDelta APIs
- Create `libs/authorization` with enforcer module, cache, engine
- Integrate into one service (e.g., resource service) as pilot

### Phase 2: Roll Out to All Services
- Integrate `AuthorizationEnforcerModule` into exam, live, notification services
- Add `@Resource()` decorators to all secured endpoints
- Add event publishers for resource lifecycle in each service
- Migrate existing RBAC checks to use policy engine (keeping role checks as a policy)

### Phase 3: Operational Excellence
- Implement decision log aggregation and dashboards
- Add cache monitoring (staleness, hit ratio)
- Implement policy testing framework
- Add circuit breakers for control plane unavailability

## Pros & Cons

**Pros:**
- **Low latency:** decisions are made in-process, no network hop
- **Linear scalability:** each service is self-sufficient, no bottleneck
- **Resilient:** cached policies continue working if control plane is down
- **Centralized management:** single place to define, version, and audit policies
- **Consistency model is tunable:** choose between strong (sync from CP) and eventual (cache)
- **Good for high-throughput services** (exam scoring, real-time features)

**Cons:**
- **Eventual consistency:** policy/data changes have propagation delay
- **Cache complexity:** need invalidation, versioning, and reconciliation
- **Memory overhead:** each service holds a copy of policies + resource metadata
- **Cold start:** service must sync before accepting requests (mitigated by Redis backup)
- **Stale cache can cause incorrect decisions** (mitigated by short TTL + active invalidation)
- **Debugging is harder:** decision logs are distributed then aggregated
