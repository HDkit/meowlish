# Known issues backlog

Findings from the November 2026 audit that are **not fixed yet**. Fixed items were removed; see the git log for those.

- **Verified**: confirmed by reading the code.
- **Reported**: from the automated audit, not yet re-checked. Confirm before fixing.
- **Decision**: the behaviour might be intentional, so a product/infra call is needed first.

When you fix an item, delete it here in the same commit.

## Conventions (see AGENTS.md)

- Gateway `exam-gateway/dtos/req/**` DTOs don't `implements` the generated messages.
- `review-exam.req.dto.ts` documents `status` as a free string instead of an enum.
- `process.env` is still read directly in gRPC/RMQ client module registration (gateway `*.router.module.ts`, exam `FILE_CLIENT`) and in the `bootstrap.ts` listeners of several apps (e.g. `live`).
- Remove legacy bare-payload support from `@server/messaging` (`unwrapEvent`/`claim`) once every service runs the outbox build and all queues are drained. It needs two spec changes: `unwrapEvent rejects a bare payload` and `claim rejects a missing id`. (`exam.writing.submitted` stays bare on purpose; it is not read through `unwrapEvent`.)
- `relay: false` services (file-service, notification) have no outbox metrics or alerts. Adding `outbox.add` there needs `relay: true`.
- Exam scoring in-process after the `endAttempt` commit is not durable: process death or a `score()` failure loses `exam.attempt.scored` and `exam.writing.submitted`. Consider consuming `exam.attempt.submitted` via the inbox, or the Restate `AttemptScoring` workflow (W1 in `docs/superpowers/specs/2026-11-12-restate-adoption-design.md`), which also fixes the next item.
- Writing points join the stored attempt score when `exam.writing.scored` arrives, but `exam.attempt.scored` is sent only once, at submit, before any writing feedback. Achievement score badges therefore ignore writing points. Re-sending `.scored` would count the attempt twice there; it needs a per-attempt upsert or a separate `exam.attempt.rescored` event.
- Publish with `mandatory: true` (or an alternate exchange) so events published before their queue exists aren't silently dropped.
