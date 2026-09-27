# Batch88 — frozen existing-file mini-workload

Date: 2026-09-22. Direct implementation and self-review by the current assistant, no delegation or independent-review claim. Original checklist remains **44 total / 33 closed / 11 open**.

## Delivered

- Authored `cue-existing-files/v1`: 4 evaluation + 4 holdout cases, 9 seed files, explicit exact-edit goals and host-only reference bytes.
- Strict frozen workload adapter using the existing evaluation dataset and native artifact checker. Content-derived input identity binds initial bytes, goal and acceptance expectations; relabeling does not hide duplicate inputs. Declared family leakage, malformed/hostile shapes, size limits, unsafe Windows paths and path collisions are rejected.
- Pinned release loader and build packaging. Actual isolated compiled-loader test accepts original bytes and rejects whitespace-only drift without changing checkout assets.
- `npm run evaluation:workload -- list|prepare ...`: list inventory or materialize only seed files in a unique directory under an explicit existing host-owned parent. Split is mandatory. No reference-body copy, existing-file overwrite, model/Git launch, run approval or baseline selection. Partial write failure returns its retained owned path rather than deleting unrelated state.
- Real SQLite integration of 40 pre-approval fixture slots across 8 inputs and 5 arms. The manual arm requires the existing explicit-authority baseline store; direct manual enrollment and absent verifier are rejected. Reopen retains all slots and digests; approvals/execution events/orchestration attempts remain zero. Enrollment still truthfully says `claimed-not-verified`.
- [Operator documentation](../../../../docs/integration/FROZEN_EVALUATION_WORKLOAD.md), package command and checklist/progress updates.

## Verification commands and results

From `daemon/`:

1. `npm run build` — first exit 2 (`build-pass1.log`): TypeScript did not narrow after an inferred const-arrow `never` helper. Changed it to an explicitly declared `function ...: never`; no validation was removed. Second build exit 0 (`build-pass2.log`).
2. `npx vitest run test/integration-evaluation-workload.test.ts test/integration-evaluation-workload-preparation.test.ts test/integration-evaluation-workload-enrollment.test.ts test/integration-evaluation-workload-cli.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose` — exit 0, 4 files / **25 passed** (`focused-pass1.log`). Includes actual local Node CLI, filesystem and SQLite fixtures; no provider process.
3. `npm run build` — exit 0 (`build-final.log`). The edit tool's mixed-newline normalization in `copy-assets.mjs` was restored against the exact preimage after asserting normalized content equality; only six packaging lines are added. `package.json` differs from the preimage by one script entry.
4. From repository root, `npm run evaluation:workload -- list` — exit 0 (`npm-list.log`), including a successful fresh build after the final CLI observation wording change. Direct JSON inventory is retained in `inventory.json`.
5. Final current-source regression from `daemon/`:

```text
npx vitest run test/integration-evaluation-workload.test.ts test/integration-evaluation-workload-preparation.test.ts test/integration-evaluation-workload-enrollment.test.ts test/integration-evaluation-workload-cli.test.ts test/integration-evaluation.test.ts test/integration-evaluation-enrollment.test.ts test/integration-evaluation-baseline.test.ts test/integration-evaluation-comparisons.test.ts test/integration-evaluation-trials.test.ts test/integration-native-existing-file-checker.test.ts test/integration-native-compiled-imports.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose
```

**Exit 0, 11 files / 60 passed / 0 skipped**, `regression-verified.log`. Earlier `regression-final.log` also passed before the last display-only change from a literal trial count to `measurements:not-collected`. Do not sum overlapping runs. `git diff --check` found no whitespace errors (existing Git line-ending conversion warnings only).

All eight original seed artifacts fail the existing native checker and their authored references pass. This is a mechanical exact-artifact oracle check, not execution of arbitrary generated code or proof of semantic quality. One TypeScript correction; no focused test failure and no gate weakening.

## Self-review and limits

- These are explicit-edit pipeline canaries, not a representative optimization benchmark or secret/blind holdout. Family labels are disjoint; semantic independence, model contamination and statistical power are not established. Binary exact-edit checks cannot by themselves prove the high-performance quality-improvement objective.
- No user baseline was selected. The 40-slot test uses fixture policies/candidates/account/environment/metric digests and a fixture explicit-user-authority verifier; it is not a real user-approved baseline or measurement.
- No production Core/UI input-verification authority, automatic Git provisioning, qualified candidate, accepted workflow or trial is created by preparing a folder. Actual input binding, run/staging approval, runtime qualification, four-mode paired measurements and release acceptance remain open.
- Host-owned parent directories are a preparation precondition; the helper does not promise atomic defense against hostile concurrent filesystem replacement. Failure retains its owned partial path, which tests clean only within their temporary roots.
- No model/provider/account/service requests. Qwen OFF, subscription allowance still 4/4 spent. No commit, push, publication or unrelated user-file cleanup.
- Independent review remains pending. This component does not close S5-04/S5-05/S5-08 or any original parent item.

Source and artifact hashes: `pins.sha256`; exact modified-file preimages: `preimages/`. New workload/source/test/docs files were absent before this batch.
