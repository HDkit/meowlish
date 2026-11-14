# Known issues backlog

Findings from the November 2026 audit that are **not fixed yet**. Fixed items were removed; see the git log for those.

- **Verified**: confirmed by reading the code.
- **Reported**: from the automated audit, not yet re-checked. Confirm before fixing.
- **Decision**: the behaviour might be intentional, so a product/infra call is needed first.

When you fix an item, delete it here in the same commit and describe the fix in [`fixed-issues.md`](fixed-issues.md).

## Security

None open.

## Correctness

None open.

Kept as they are by decision (November 2026), so not open: S24 (question explanations are public), C23 (hydration returns deleted users' identities), C27 (deleting an approved exam cascades to its attempts), C34 (every thread view counts), C36 (the unused email/push/system preference switches stay). See [`fixed-issues.md`](fixed-issues.md#backlog-decisions-november-2026).

The candidate issues noticed while writing the per-operation flows (November 2026) are listed under "Findings" at the end of each page in [`architecture/flows/`](architecture/flows/README.md), each marked with what became of it. New ones found there: confirm first, then add them here.

## Conventions (see AGENTS.md)

None open. New convention gaps go here.
