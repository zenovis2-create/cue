# Batch90 — full dataset app bridge and seed verification

Date: 2026-09-22. Direct implementation; self-review only, no delegation.

## Product changes

1. **Complete manifest enrollment**: the desktop used to reduce every dataset to exactly one evaluation and one holdout case. Its existing enrollment operation now accepts either the original two-case fields or an exact bounded `{id, revision, cases}` manifest (2–64 cases, both splits, unique case IDs and input digests). Mixing formats, malformed/sparse/accessor/proxy data, unknown membership and caller result/time/run authority fail before Core invocation. Full frozen dataset identity now survives IPC → Core → SQLite.
2. **Actual renderer controls**: explicit preparation/inventory JSON or raw manifest import, evaluation/holdout counts, labelled case picker with no implicit choice, manual reset, retained manual values and invalid-import clearing. Approval/enrollment locks editing; new-run selection clearing and existing late-response fences remain. No automatic enrollment, task creation, baseline, approval or execution.
3. **Real retry bug repaired**: IPC previously attached a new `Date.now()` to each otherwise identical enrollment retry, conflicting with the store's immutable replay contract. It now reuses the validated same-run/same-enrollment stored host timestamp. The store still compares every submitted binding; changed metric/dataset/policy/case is not made replay-equivalent. Missing/corrupt/foreign prior lookup cannot bypass downstream Core/store validation.
4. **`evaluation:workload ... verify`**: read-only pre-Git workspace verification against the pinned release and explicit goal/case/split. It checks exact seed bytes and complete tree, rejects unexpected files/directories (including `.git` and `AGENTS.md`), missing files, junctions/symlinks, hardlinks and oversized files, and rechecks identities/timestamps after bounded reads. It writes nothing and never cleans an input directory. This is a point-in-time preparation check, not an atomic hostile-filesystem defense or executed-input attestation.

Files changed: `app/ipc.mjs`, `app/ipc.d.mts`, `app/renderer/index.html`, `app/renderer/renderer.js`, `daemon/src/evaluation/workload.ts`, `daemon/scripts/evaluation-workload.mjs`. Two new test files cover manifest bridge and workload verification. Existing Core/schema/approval/runtime authority were not modified.

## Verification and failure diagnosis

- `build-pass1.log`: build exit0.
- `focused-pass1.log`: 4 files, 31 pass / 1 fail. The first full-manifest IPC replay exposed the production timestamp bug above. `ipc-before-replay-fix.mjs` preserves the first implementation.
- `build-pass2.log` / `focused-pass2.log`: build0; 4 files / 32 pass after the replay correction, including changed-metric rejection.
- Added real renderer → structured IPC → Core → SQLite test. Initial `regression-final.log`: 29 files passed / 1 failed, 209 pass / 1 fail / 1 existing skip. The JSDOM fixture incorrectly passed foreign-realm object prototypes directly to IPC, bypassing Electron's serialization. It now uses `structuredClone`; **the production foreign-prototype guard was not relaxed**. Exact test preimage: `manifest-before-clone-fix.test.ts`.
- `build-verified.log` / `regression-verified.log`: build0; 30 files / 210 pass / 1 existing skip. Those commands included a nonexistent `p12-api-proof.test.ts` selector, ignored by Vitest; no such test is claimed to have run. The final command below uses an enumerated existing-file list.
- Added inventory JSON import alongside preparation JSON and reran final bytes:

```bash
cd daemon
npm run build
files=(test/integration-evaluation*.test.ts test/*-ui*.test.ts test/p10c-renderer.test.ts test/p11-electron-surface.test.ts test/p12-electron-proof-result.test.ts test/integration-native-compiled-imports.test.ts test/p5.test.ts test/p45.test.ts)
npx vitest run "${files[@]}" --fileParallelism=false --maxWorkers=1 --reporter=verbose
```

**Final: build0, 44 files / 269 passed / 0 failed / 1 existing Windows cwd-query skip, exit0**, 150.08s. Logs: `build-final-bytes.log`, `regression-final-bytes.log`, exit file and requested filename set. Overlapping runs are not summed. This is targeted coupled coverage; batch89's whole `npm test` is historical and predates these changes.

## Positive and negative coverage

- Real SQLite: all 8 pinned workload cases × four modes = **32 registrations**, each storing all eight manifest cases; read after Core close/reopen; identical IPC retry works, changed metric fails and preserves original row. Zero approval/execution/orchestration-attempt rows. Policies, references and prepared run rows are synthetic offline fixtures, not qualified accounts/candidates or measured trials.
- JSDOM renderer import/explicit holdout selection flows through actual IPC, Core and SQLite in one test, with Electron-style structured serialization. Goal preparation itself is a seeded fixture; no actual Electron window or model execution was performed.
- Foreign workspace, wrong policy, post-approval enrollment, oversized/one-split/duplicate/accessor/proxy manifests and unsupported manual baseline are rejected.
- Renderer refuses implicit case choice, clears malformed imported state, preserves manual values, locks after enrollment, clears choice on new run, discards late enrollment response and treats pasted HTML as invalid JSON, not markup.
- All eight seed trees verify positively. Wrong goal/case/split, mutation, missing/extra paths, links, oversized files and a read-time replacement fail. Actual compiled CLI exits0 on valid seeds and exits1 with no stdout on drift/missing explicit goal.

## Remaining scope, not hidden behind budget

- Enrollment remains **`claimed-not-verified`**. The UI accepts user-supplied manifests; structural validation and a frozen digest are not authentication of their provenance or actual executed inputs.
- Seed verification returns **`executedInputVerified:false`**. Run it before Git initialization; exclusive host ownership is a precondition, and later changes invalidate it.
- A production measurement producer still needs to capture the actual execution's canonical input, timing/quality evidence, environment/account/price lineage and complete accounting. The existing outcome-only projection intentionally remains `trial:null`; adding a qualified measured-fact conversion path is **code work**, not merely a new call budget.
- Explicit real-user manual-baseline setup in the desktop remains unimplemented. Do not replace it with a fixture callback that claims authority.
- Claude still needs a production authorized-session/config mapping producer, candidate admission and actual qualification. Local/remote termination and final billing are separate authorities.
- Independent review of recent changes, representative reviewed tasks and approved live paired measurements remain required. No parent is closed by these fixtures.

Qwen OFF, old subscription allowance4/4 still spent; no real provider/model/account calls or credential copies, no commit/push/publication, no historical cleanup retry. Original checklist remains **33/44 closed, 11 open**; these are concrete completed subcomponents rather than claimed product/optimization completion.

Operator guide: `docs/integration/FROZEN_EVALUATION_WORKLOAD.md`. Exact preimages, final file hashes and log hashes are retained in this directory.
