# Git staging factory implementation plan

## Completion definition

- `npx tsc -p daemon/tsconfig.json --noEmit` exits 0.
- `npx vitest run daemon/test/integration-git-staging-factory.test.ts` exits 0 using only disposable temporary Git repositories.
- Root agent runs and records the coordinated shared build after receiving `READY BUILD`.
- An independent reviewer checks the owned source, focused tests, raw command logs, and official Git command semantics.

## Loop contract

- Attempt cap: 3 diagnosed correction cycles. Each retry must use a new hypothesis.
- Every pass runs the no-emit check and focused test command above; only changes that improve the measured gate are retained.
- On a failed pass, preserve raw stdout/stderr and exit status, diagnose, then correct or hand the remaining failure to the root agent.

## Scope and safety

- Add only `daemon/src/orchestration/git-staging-factory.ts` and `daemon/test/integration-git-staging-factory.test.ts` for implementation/tests.
- Use bounded `shell:false` Git processes and native root identities. Reject unsupported repository features rather than claiming universal Git checkout safety.
- Never use force removal, prune, clean, reset, or mutate the publication worktree.
- This factory alone does not close S3-01 or S3-03 without integrated driver and production-boundary proof.

## Preimage receipt

- `daemon/src/orchestration/git-staging-factory.ts`: absent before edit (PowerShell `Test-Path` returned `False`).
- `daemon/test/integration-git-staging-factory.test.ts`: absent before edit (PowerShell `Test-Path` returned `False`).
- Because both owned files are new, there are no source preimage bytes to copy. This absence receipt is the pre-edit evidence.
