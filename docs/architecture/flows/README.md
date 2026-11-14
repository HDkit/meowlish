# Operation flows

What happens inside the system for every operation: the HTTP route at the gateway, the gRPC call, the service code, the tables it reads and writes, the transaction, the events it writes to the outbox, the consumers that react to them (and whether they use the inbox), Redis, MinIO, BullMQ jobs, socket.io and SSE. Every step names the file it comes from, so it can be checked against the code.

| Page                                                                   | Operations                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [auth.md](auth.md)                                                     | `/auth/*`: mail and Google sign-in, cookies, refresh, logout, credentials, password, profile and avatar, identities, roles and permissions, locking, Google Calendar linking              |
| [exam.md](exam.md)                                                     | `/exams/*`: exam, section and question management, review, tags, goals; attempts (start, answers, notes, flags, submit), scoring, the Writing round trip with the AI scorer               |
| [resource.md](resource.md)                                             | `/resources/*`: blogs and tags, blog comments, flash cards and lists, reports                                                                                                             |
| [resource-community.md](resource-community.md)                         | `/resources/forum/*`, flash card copies, diff, upstream pull and change proposals; the discussion and proposal notifications                                                              |
| [live-and-notification.md](live-and-notification.md)                   | `/chat/*` and the socket.io proxy; `/notifications/*`, preferences and the SSE stream; badge and report notifications                                                                     |
| [achievement-file-authorization.md](achievement-file-authorization.md) | `/achievements/*` and badge awarding; `POST /files` (presigned upload), file reference counting and orphan cleanup; ownership checks behind `@ResourceAccess`; the outbox relay and inbox |

## Reading a section

Each operation has the same bullets:

- **Access**: what the gateway checks before calling the service (`@IsPublic`, `@HasRoles`, `@ResourceAccess`, `requesterOf`, `CookieIssuanceGuard`, throttles), and what the service checks itself. Services answer "not yours" with 404, not 403.
- **Flow**: numbered steps from the gateway DTO to the response.
- **Async**: what the emitted events cause elsewhere (queue → handler → effect).
- **Errors**: the notable status codes.

Each page ends with **Background work** (RabbitMQ consumers, BullMQ jobs, sockets) and **Findings**: problems noticed while tracing the code. The findings were not re-checked one by one; confirm before fixing, and move confirmed ones to [`../../backlog.md`](../../backlog.md).

## Shared mechanics (described once elsewhere)

- Gateway guards and throttling: [`../authorization.md`](../authorization.md) §1 and `apps/gateway/src/throttle.ts` (throttler `default`: 100/min per route per IP+account, per IP when signed out; strict auth routes 10/min per IP+account plus a 100/min per-IP ceiling; answer autosave 300/min).
- Outbox, relay, inbox, retry queues and DLQs, and the full event table: [`../messaging.md`](../messaging.md).
- Tables per service and gRPC surfaces: [`../services-and-data.md`](../services-and-data.md).
