# Alternative Authorization Approaches

Two additional approaches that may fit the architecture better depending on priorities.

---

## Option A: Embedded Authorization with gRPC Metadata

**Core idea:** Leverage the existing gRPC contract between gateway and services. The gateway already enriches request metadata with JWT claims (`sub`, `roles`, `permissions`). Extend this metadata to include pre-resolved resource-level permissions, computed by a lightweight decision engine inside the gateway.

### How it works

```
1. Request hits gateway
2. JwtAuthGuard validates → populates req.user
3. New Authorize middleware:
   - Reads @Resource() decorator (type, action, param)
   - Resolves resource ID from route/body
   - Checks if user can perform action:
     a. Ownership check via gateway-side query? (limited)
     b. Or: fetch user's effective permissions for that resource type
        from Redis (pre-loaded at login / on-demand)
     c. Or: the service endpoint itself checks (see below)
4. If permitted, gateway forwards to gRPC service
```

**But** the gateway doesn't have access to service-specific data (e.g., who owns the blog, whether the exam is public). So this approach alone is insufficient for resource-level checks.

**Better variant:** The gateway attaches permissions metadata, and each service's gRPC interceptor performs the resource-level check using its own database (simplest approach of all).

### Detailed Design

```typescript
// In gateway: enrich gRPC metadata with user's global + resource-level claims
const metadata = new Metadata();
metadata.set('x-user-id', user.sub);
metadata.set('x-user-roles', JSON.stringify(user.roles));
metadata.set('x-user-permissions', JSON.stringify(user.permissions));
metadata.set('x-resource-action', action);     // from @Resource() decorator
metadata.set('x-resource-type', resourceType);
metadata.set('x-resource-id', resourceId);

return this.client.checkPermission({ ... }, metadata);
```

```typescript
// In each service: gRPC interceptor reads metadata, checks against own DB
@Injectable()
class ResourceAuthzInterceptor implements NestInterceptor {
  constructor(
    private readonly connection: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const meta = this.extractGrpcMetadata(context);
    if (!meta.resourceType) return next.handle();

    // Simple ownership check against this service's own database
    switch (meta.resourceType) {
      case 'exam': {
        const exam = await this.connection.exam.findUnique(meta.resourceId);
        if (!exam) throw new NotFoundException();
        if (meta.action === 'update' && exam.created_by !== meta.userId) {
          throw new ForbiddenException();
        }
        break;
      }
      case 'blog': {
        const blog = await this.connection.blog.findUnique(meta.resourceId);
        if (!blog) throw new NotFoundException();
        if (meta.action === 'delete' && blog.author_id !== meta.userId) {
          throw new ForbiddenException();
        }
        break;
      }
      // ... more resource types
    }

    return next.handle();
  }
}
```

**Pros:** Simplest to implement, no new service, no event bus, no cache invalidation, always consistent, each service checks against its own database.

**Cons:** Each check hits the database (unless cached), logic is scattered across services, no centralized audit, policy changes require code changes + deployments.

**Best for:** Small teams, early-stage products, or as an incremental step toward a more sophisticated approach.

---

## Option B: Reverse-Polymorphic gRPC + OPA/Rego

**Core idea:** Use [Open Policy Agent](https://www.openpolicyagent.org/) as the decision engine. OPA is a graduated CNCF project specifically designed for policy-based authorization. It uses Rego (a declarative policy language) to express fine-grained policies.

### How it works

```
┌──────────┐   gRPC    ┌──────────────┐   gRPC    ┌──────────┐
│ Service  │──────────►│   OPA Sidecar│◄─────────│ Service  │
│ (Exam)   │           │  (or Daemon) │          │ (Blog)   │
│          │  allow/   │              │  allow/   │          │
│          │  deny     │  Rego engine │  deny     │          │
└──────────┘           └──────┬───────┘           └──────────┘
                              │
                     ┌────────▼────────┐
                     │  Policy Bundle  │
                     │ (loaded from    │
                     │  files / API)   │
                     └─────────────────┘
```

**Options for deploying OPA:**

1. **Sidecar** — one OPA instance per service pod, loaded with service-specific policies
2. **Central OPA** — single OPA server with all policies (similar to Option 1 but using Rego)
3. **Embedded** — use the `@openpolicyagent/opa-wasm` or a Go WASM binary to run Rego in-process

**Rego policy example:**

```rego
package exam.authz

default allow = false

# Admin can do anything
allow {
  input.user.roles[_] == "Admin"
}

# Owner can update/delete their own exam
allow {
  input.action in ["update", "delete"]
  input.resource.owner_id == input.user.sub
}

# Anyone can read public exams
allow {
  input.action == "read"
  input.resource.is_public == true
}

# Collaborator with "editor" role can update
allow {
  input.action == "update"
  some role in input.user.resource_roles
  role.resource_id == input.resource.id
  role.role == "editor"
}
```

**Integration with NestJS:**

```typescript
@Injectable()
class OpaDecisionClient {
  constructor(@Inject('OPA_GRPC') private readonly client: OpaClient) {}

  async check(input: OpaInput): Promise<boolean> {
    const result = await firstValueFrom(
      this.client.checkPolicy({
        policy: 'exam/authz',
        input: JSON.stringify(input),
      }),
    );
    return result.allowed;
  }
}
```

**Pros:**
- Battle-tested, CNCF-graduated project
- Declarative Rego language is purpose-built for authorization
- Policy-as-code: version control, test, CI/CD
- Bundle distribution: policies can be pushed or pulled
- Decision logging built-in
- Integration with Kubernetes, Envoy, gRPC, HTTP

**Cons:**
- Adds a new dependency (OPA deployment)
- Rego has a learning curve
- Sidecar model increases resource usage
- Central OPA is a SPOF
- Needs bundling strategy for policies across services
- Overkill if the product needs simple ownership checks only

**When to choose:**
- Authorization requirements are complex and growing (multi-tenant, hierarchical orgs, attribute-based)
- You want strict policy-as-code with testing and CI/CD
- You already use CNCF tools (Kubernetes, Envoy, etc.)
- You need a unified policy framework across multiple tech stacks (not just NestJS)

---

## Recommendation Matrix

| Criteria | Central Authz Svc (Plan 01) | Hybrid Distributed (Plan 02) | Embedded gRPC (Option A) | OPA (Option B) |
|---|---|---|---|---|
| Implementation effort | Medium-High | High | Low | Medium |
| Latency | Low (cached) | Very Low | Low (DB query) | Low (sidecar) |
| Scalability | Good (cached) | Excellent | Good | Good |
| Consistency | Strong | Eventual | Strong | Strong |
| Policy change without deploy | Yes | Yes | No | Yes |
| Audit trail | Built-in | Centralized | Manual | Built-in |
| Complexity | Medium | High | Low | Medium |
| New infra needed | 1 service + DB | 1 service + DB + caching | None | OPA deployment |

**For this codebase, the pragmatic recommendation:**

1. Start with **Embedded gRPC (Option A)** — each service checks ownership against its own database. This requires zero new infrastructure and can be built incrementally.

2. When the pattern proves itself and the pain of duplicated logic is felt, migrate to **Hybrid Distributed (Plan 02)** — extract the duplicated checks into the shared `libs/authorization` module, add a control plane for centralized policy management, and use in-process caching.

3. Introduce **OPA** only if Rego's policy language becomes necessary (multi-tenant SaaS, complex attribute-based rules, regulatory compliance).
