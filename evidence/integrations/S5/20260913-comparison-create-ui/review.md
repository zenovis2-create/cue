# Independent review contract

Done means the pinned eight-file change independently passes the two focused SQLite Core/IPC and DOM suites, JavaScript syntax, scoped diff/preimage inspection, and SHA-256 verification. Review must confirm exact hostile DTO rejection; protected workspace, projection, manual-baseline, and derived-policy binding; replay, conflict, reopen, foreign and tamper behavior; explicit UI creation with stale/new-run/error clearing; truthful `trial:null` / `insufficient` output; and no measurements, promotion, runtime, approval, or policy writes.

Reviewer cap: two substantive verification passes. Every pass runs the two focused Vitest files with one worker, JavaScript syntax checks, final-pin verification, and scoped preimage inspection. A second pass is permitted only for a concrete first-pass failure. Any unresolved failure after pass two is reported as BLOCKED without widening scope or changing product/tests.

## Verdict

**PASS.** No blocking source, contract, or test finding remains at the pinned revision.

## Independent evidence

- Final pins: all 8/8 paths in `final-pins.json` match SHA-256. The eight captured preimage files also match `preimages.json`; each final file differs from its captured preimage only within the declared Core/IPC/renderer/test unit.
- Focused gate: from `daemon/`, `npx vitest run test/integration-evaluation-comparisons-core.test.ts test/integration-evaluation-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` exited 0: 2 files, 12/12 tests.
- Syntax: `node --check app/core.mjs`, `node --check app/ipc.mjs`, and `node --check app/renderer/renderer.js` each exited 0.
- Scoped `git diff --check` exited 0 with line-ending warnings only. Root's already-recorded final daemon build exited 0; the reviewer did not duplicate an unchanged build.
- The reviewer's first test invocation used an unsupported npm `--runInBand` flag and failed before Vitest ran. The corrected direct Vitest command above is the single substantive focused execution; no source changed between the pin check and passing gate.

## Contract findings

- IPC accepts exactly `operation`, `snapshotId`, dense baseline/candidate ID arrays, and `mode`; it rejects proxies, accessors, sparse/extra properties, invalid IDs/modes, duplicates, and more than 64 IDs per arm before Core invocation. No caller constraint, measurement, policy digest, result, approval, or promotion field crosses this boundary.
- The actual temporary SQLite Core→IPC path creates one immutable snapshot. Core rereads every saved projection through its integrity-checking store, requires each run to belong to the configured workspace, requires the baseline arm to be `manual-baseline`, requires the candidate arm to equal the requested mode, and derives one stored policy digest per arm. The immutable comparison store then enforces common dataset/membership constraints.
- Tests prove identical replay and reopen return the same view and retain one row; same snapshot ID with different valid membership conflicts; foreign-workspace creation and corrupted projection payloads return only `evaluation-unavailable`; no rejected case adds comparison, run, approval-event, or selection-policy rows. Existing protected manual-baseline enrollment authority remains the source of baseline records, so changing a candidate ID to baseline authority is unavailable.
- The returned DTO is the bounded descriptive view: membership, constraints, internal digests, run IDs, and policy binding are withheld. Actual stored projections remain `trial:null`; the created view is `insufficient`, `promotionEligible:false`, and `statisticalQualification:not-performed`.
- DOM creation occurs only on explicit form submission. It sends saved IDs and mode, renders the sanitized saved view, clears output and secrets on failure, and resets both output and create status when a new run invalidates an in-flight response. Korean copy uses `비교용 기록` and states that the result is descriptive, unmeasured, statistically unqualified, and grants no policy promotion.

## Preserved history and limits

Maker pass 1 failed on the test-only `approval` table name; maker pass 2 failed on `selection_policy`. Root correction pass 1 then failed because its list assertion omitted the newly valid snapshot. These failures remain in `maker.md` and `root-correction.md`; root correction pass 2 produced the pinned passing revision.

This verifies manual record-ID entry rather than a picker, and fixed disclosed descriptive criteria rather than configurable evaluation policy. It does not verify measured facts, actual trials or improvement, promotion, provider/native/model/network behavior, live Electron visuals, or performance. The user's local model remained off and was not probed.
