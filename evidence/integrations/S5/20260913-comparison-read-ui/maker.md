# Saved comparison read UI maker evidence

## Result

Implemented an explicit historical comparison lookup in the existing evaluation panel. `{ operation: 'comparison-read', snapshotId }` is accepted before a run is prepared and calls the existing workspace-scoped `readEvaluationComparison`. Existing enroll, observe, and coverage operations retain their prepared-run gate.

The IPC response is rebuilt as a strict bounded descriptive view. It excludes membership, run, enrollment, observation, raw constraints, backend errors, paths, and source payloads. Exact records, dense two-split arrays, fixed status/mode/reason sets, nonnegative safe counts, immutable false promotion eligibility, unperformed statistical qualification, IDs, and digests are validated without invoking proxy or accessor values.

The renderer exposes a manual saved-ID form without enabling current-run enrollment. It performs no automatic fetch. Fixed Korean text shows recorded time, dataset, mode, overall and split status, projection/trial/missing counts, outcome counts, and translated bounded reasons. It always states that statistical qualification was not performed and promotion is not allowed. A new lookup, new prepared run, or lookup failure fences stale responses and clears prior comparison output.

## Validation

- Initial focused gate before the truthfulness/stale refinements: 2 files / 9 tests PASS.
- First corrected full gate: 1 failure / 8 passes. The attempted foreign-workspace proof mutated `envelope`; SQLite correctly rejected it as immutable.
- Second foreign-workspace hypothesis: 1 failure / 8 passes. Opening another Core through `initializeConfig` reused the persisted original worktree, so the read remained available.
- Final hypothesis: close the original Core, reuse its ledger configuration with an explicit foreign worktree, and read through a newly registered IPC handler. This returned the generic unavailable response as required.
- Final focused gate: `npx --no-install vitest run test/integration-evaluation-ui.test.ts test/integration-evaluation-comparisons-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, 2 files / 9 tests PASS.
- Copy-only correction gate: the same two suites with verbose reporting — exit 0, 2 files / 9 tests PASS. Both JavaScript syntax checks remained exit 0. No TypeScript source changed, so the already-passing build was not repeated.
- `npm run build` from `daemon/` — exit 0.
- `node --check app/ipc.mjs` and `node --check app/renderer/renderer.js` — exit 0.
- Scoped `git diff --check` — exit 0; line-ending conversion warnings only.

The Core test creates a real SQLite-backed immutable snapshot with the production Core, reads its actual null-trial reason/count shape through registered IPC before prepare, verifies the reduced DTO, then reopens the ledger under a foreign worktree and verifies generic denial.

## Final source hashes

- `app/ipc.mjs`: `5194467d2ee0ac7e1fe8b7418b14947abc2c3ed759e689f5eaf7f96ff2149990`
- `app/ipc.d.mts`: `f538caee15163870f19fe0b7cd0dc23314ed25364c0d2d0ece14041bbadbc8df`
- `app/renderer/index.html`: `f1b506d50f436fd9ad1c7e9c3458f1de0de208c9e982a399e7b13e43a393c7d7`
- `app/renderer/renderer.js`: `386db49d501a33b7e9b1fcd9fa634175784eca81456ca842fa8c40470cbe455a`
- `daemon/test/integration-evaluation-ui.test.ts`: `f70da8c28d826f4e4bd45e4a61d5b7da8d911e11d2e343433f1d6f582e060d1a`
- `daemon/test/integration-evaluation-comparisons-core.test.ts`: `ad599d19a16ac3d0f71f3ab07da0a593f6cdfb64adfb5cf349a0761216f079d2`

## Limits

This unit reads only a caller-known snapshot ID. It adds no snapshot enumeration, creation form, trial or measured-fact ingestion, report export, policy write, approval, execution, or promotion path. Current stored projections have `trial: null`, so the real fixture remains `insufficient`; `promotionEligible` remains false. No local model/server, provider, native helper, network, live Electron, or visual QA was run.
