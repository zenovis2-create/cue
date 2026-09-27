# A07 milestone readiness artifact — maker contract

Scope is limited to `scripts/reuse/cue-release-readiness.mjs`, `daemon/test/integration-release-readiness.test.ts`, and this evidence directory. Product source, checklist, execution map, spec, LOOP, and release gates are inputs only.

## Pre-edit source freeze

- Git HEAD: `8e2afa6366e3af62f7115b2c67be799130f8dfdf`.
- `docs/INTEGRATION_CHECKLIST.md`: `5A22DC867EFBE6C4574B9297A94B4C8BF5DAB89CAE3F11405B4325D7298F416D` (untracked in the shared worktree; root owns the final freeze).
- `docs/INTEGRATION_SPEC.md`: `05208791013ACF5AFFCA1AAA5D7A3EC77F5CCED3B5FF34CFEBA7329103D0070F` (untracked in the shared worktree; root owns the final freeze).
- `docs/integration/REMAINING_EXECUTION_MAP.md`: `1F10F28473BF62668F20FB856F4E0E43F7272595D2D902D843B37C7BD913BCFA` (untracked in the shared worktree; root owns the final freeze).
- `docs/integration/LOOP.md`: `B65C53D5861479F6F92C1F5761F293829BC76450CCAC90C8700DF54227AC4B9A` (untracked in the shared worktree; root owns the final freeze).
- `scripts/reuse/cue-release-readiness.mjs`: absent.
- `daemon/test/integration-release-readiness.test.ts`: absent.
- `evidence/integrations/release/20260915-milestone-readiness/`: absent before this plan.

The final artifact must be generated only after root declares the documentation inputs frozen. This maker may run fixture-only tests of exported pure functions before that point.

## Done and attempt cap

Done means all of the following hold on one renderer source hash:

1. `npx vitest run test/integration-release-readiness.test.ts --fileParallelism=false --maxWorkers=1` from `daemon` exits 0.
2. `node --check scripts/reuse/cue-release-readiness.mjs` from the repository root exits 0.
3. Tests prove independent S0–S4, S5, and S6–S7 states; missing/changed sources or referenced evidence cannot qualify; checklist counts are parsed rather than fixed at 42; and hostile checklist text cannot create active HTML or external assets.
4. No generated readiness JSON/HTML exists yet. Root receives the exact candidate generator command and source pins for a separate reviewer to qualify after final docs freeze.

Attempt cap: 3. Every pass runs both commands above. A failed pass gets a new hypothesis and a source change only when the measured gate can improve. A regression is reverted within owned files. After three failed passes, stop with the failing assertion/command and hand it to root.
