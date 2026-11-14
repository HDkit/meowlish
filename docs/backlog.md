# Known issues backlog

Findings from the November 2026 audit that are **not fixed yet**. Fixed items were removed; see the git log for those.

- **Verified**: confirmed by reading the code.
- **Reported**: from the automated audit, not yet re-checked. Confirm before fixing.
- **Decision**: the behaviour might be intentional, so a product/infra call is needed first.

When you fix an item, delete it here in the same commit and describe the fix in [`fixed-issues.md`](fixed-issues.md).

## Security

| #   | Status   | Where                                                                    | Problem                                                                                                                                                                                                                                                                                                                                                                                   | Suggested fix                                                                                                                                                                                             |
| --- | -------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S16 | Verified | `docker/docker-compose.app.yaml` (Envoy sidecars), `docker/envoy/*.yaml` | Every gRPC service except authorization has an Envoy gRPC-web sidecar that publishes a host port (`ENVOY_AUTH_PORT` 8081, `ENVOY_EXAM_PORT` 8082, … 8085/8095). Services trust `requesterId`, `privileged`, `mayAttachAnyFile` and `recipientId` from the message, so anyone who can reach those ports skips the gateway and can, for example, call `UpdateExam` with `privileged: true`. | Stop publishing the sidecar ports (keep them on the internal network), or firewall them; long term, forward the JWT and re-verify it in each service (the `Actor` step of the hybrid-authorization spec). |

## Correctness

| #   | Status | Where | Problem | Suggested fix |
| --- | ------ | ----- | ------- | ------------- |

More candidate issues, noticed while writing the per-operation flows (November 2026) and **not yet re-checked**, are listed at the end of each page in [`architecture/flows/`](architecture/flows/README.md) under "Findings". Confirm one before fixing it, then add it here.

## Conventions (see AGENTS.md)

- Exam scoring in-process after the `endAttempt` commit is not durable: process death or a `score()` failure loses `exam.attempt.scored` and `exam.writing.submitted`. Consider consuming `exam.attempt.submitted` via the inbox, or the Restate `AttemptScoring` workflow (W1 in `docs/superpowers/specs/2026-11-12-restate-adoption-design.md`), which also fixes the next item.
- Writing points join the stored attempt score when `exam.writing.scored` arrives, but `exam.attempt.scored` is sent only once, at submit, before any writing feedback. Achievement score badges therefore ignore writing points. Re-sending `.scored` would count the attempt twice there; it needs a per-attempt upsert or a separate `exam.attempt.rescored` event.
