# Independent S5 saved comparison-record picker review

Outcome: **PASS**. No blocking findings remain in the bounded unit.

## Checker contract

- Done: the eight pinned files match their final SHA-256 values; static comparison against the seven captured preimages shows only the intended Core/IPC/renderer/type/test additions; the direct focused Vitest command passes; syntax and whitespace gates pass; protected list, strict projection, pagination, reopen, hostile boundaries, and manual picker behavior satisfy `ROOT-CONTRACT.md`.
- Attempt cap: 2 independent checker passes.
- Every pass: inspect current source and tests, verify pins, run the two focused suites, and check the three changed JavaScript files. The maker-owned build is not duplicated.
- Failure: retain evidence, report the concrete blocker, and retry only with a new hypothesis or return it to root/maker.

## Evidence

- Independent focused gate from `daemon`: `npx vitest run test/integration-evaluation-record-picker-core.test.ts test/integration-evaluation-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, **2 files / 13 tests passed**.
- Independent syntax gate from repository root: `node --check app/core.mjs`, `node --check app/ipc.mjs`, and `node --check app/renderer/renderer.js` — all exit 0.
- Independent scoped whitespace gate over the eight pinned paths: `git diff --check -- ...` — exit 0; only the existing Git LF/CRLF notices were emitted.
- Final pin verification: **8/8 match** `final-pins.json`. The first combined syntax/hash command had a PowerShell parser error caused by an empty pipeline after a `foreach` block; the corrected array-based command passed. No product change resulted.
- Maker-owned final build: `npm run build` from `daemon` — recorded exit 0 in `maker.md`; intentionally not duplicated.
- Captured preimages: `preimages.json` contains the seven pre-existing product/UI test paths and each recorded SHA-256 matched before maker edits. The new isolated Core test had no preimage, as intended.

## Contract review

- Core accepts only an exact plain `{limit,cursor}` record, enforces `limit` 1..20 and a positive existing rowid cursor, rejects closed/outer-transaction access, and reads at most 64 descending SQLite rows per call. A forged method receiver supplies no authority because the implementation uses only the closed-over immutable projection store and configured workspace.
- Every candidate is re-read through the immutable projection store and its run is checked against the configured worktree. Foreign-workspace and corrupt rows are skipped without disclosure. When a page cannot reach the requested number within 64 scanned rows it returns an incomplete continuation; a stale/nonexistent cursor is denied. The isolated actual-SQLite test covers positive order, pagination, 65 corrupt rows, a foreign row, traversal beyond the bounded scan, reopen, bounds, outer transaction, forged receiver, and Core→IPC.
- IPC accepts `projection-list` before prepare, requires exact data-property inputs, rejects proxies/accessors/extra keys and out-of-range bounds through the shared strict decoder, and applies a second strict DTO projection. The response exposes only projection ID, dataset ID/revision, case, split, arm, observed time, outcome availability/outcome, and fixed `trialReady:false` / `promotionEligible:false`. It contains no run, policy, digest, raw error, or stored payload.
- Renderer access is manual. Refresh and next-page controls never create, launch, approve, execute, or promote anything. Selection only appends to the existing comparison-create textareas; duplicates and the per-arm 64 limit are controlled. Baseline accepts only `manual-baseline`. Candidate selection derives the form mode only when the candidate textarea is empty and otherwise requires the selected row to match the existing mode.
- List failure clears selectable rows, cursor, and picker tracking while preserving manually typed IDs and emits a fixed message without raw error text. A new prepared run advances the generation and clears stale selectable rows; a late prior response cannot repopulate them. Existing explicit comparison creation remains the only mutation and revalidates full immutable membership/workspace/manual-baseline/candidate-mode authority at create time.

## Limits

This proves the saved projection discovery and manual form-population component with actual SQLite Core→IPC and JSDOM tests. It does not prove live Electron visuals, provider/model/native execution, trial measurements, statistical qualification, promotion, or broad S5 completion. The user-deferred local model/server was not probed. No network, native helper, commit, or push occurred.
