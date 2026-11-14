# Known issues backlog

Findings from the November 2026 audit that are **not fixed yet**. Fixed items were removed; see the git log for those.

- **Verified**: confirmed by reading the code.
- **Reported**: from the automated audit, not yet re-checked. Confirm before fixing.
- **Decision**: the behaviour might be intentional, so a product/infra call is needed first.

When you fix an item, delete it here in the same commit and describe the fix in [`fixed-issues.md`](fixed-issues.md).

## Security

| #   | Status   | Where                                          | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Suggested fix                                                                                              |
| --- | -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| S20 | Decision | `docker/docker-compose.db.yaml`, `docker/.env` | Postgres (`POSTGRES_PORT`, 5434 in production) and the MinIO API and console (9000, 9001) are published on all interfaces. Postgres is password-protected and MinIO's public URL goes through Caddy, but neither needs to be reachable from other machines unless someone uses them remotely (this host also runs headscale). Bind them to `127.0.0.1` (as Redis and RabbitMQ already are) once nobody relies on remote access; check MinIO's `MINIO_PUBLIC_URL` first. | Prefix the port mappings with a bind address defaulting to `127.0.0.1`, as done for the Envoy ports (S16). |

## Correctness

| #   | Status   | Where                                                                                               | Problem                                                                                                                                                                                                                                                                                                                                                 | Suggested fix                                                                                                   |
| --- | -------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| C22 | Verified | gateway `LiveWsGatewayController` (`apps/gateway/src/live-ws-gateway/live-ws.router.controller.ts`) | http-proxy-middleware only handles WebSocket upgrades after a first normal HTTP request has gone through the route, so after a gateway restart a websocket-only socket.io client times out until a polling request passes (reproduced on 14 November 2026: first connect timed out, the next one worked). Browsers start with polling, so they recover. | Subscribe the proxy's `upgrade` handler to the HTTP server at start-up (`server.on('upgrade', proxy.upgrade)`). |

More candidate issues, noticed while writing the per-operation flows (November 2026) and **not yet re-checked**, are listed at the end of each page in [`architecture/flows/`](architecture/flows/README.md) under "Findings". Confirm one before fixing it, then add it here.

## Conventions (see AGENTS.md)

None open. New convention gaps go here.
