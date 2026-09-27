# Batch91 — recorded manual baseline outcomes and guarded registration

2026-09-22. Direct implementation by the current assistant; **self-review only**.

## Fixed production defects

### 1. Manual comparison arm was incorrectly treated as a selection mode

`trials.ts` required recorded `policy.mode === enrollment.arm`. A valid manual baseline has arm `manual-baseline` but executes under an actual mode such as `efficiency`. Its recorded failure/cancellation/unknown outcome therefore could not become a saved comparison projection. Previous comparison tests avoided this branch by installing plans only on candidate runs, so baseline outcomes were unavailable rather than recorded.

The projection now requires a bounded, intact saved baseline declaration, matches the **complete** enrollment against it, validates the actual historical bound/pinned policy and matches recorded policy mode/ID digest to that policy. Ordinary mode arms retain their exact mode check. Missing declaration or recomputed tampering is not converted into a usable baseline.

All four policy modes now support recorded manual-baseline failure projections. Cancelled and unknown outcomes are retained, and a paired evaluation/holdout comparison records baseline failure counts instead of unavailable outcomes. `trial:null`, missing-measurement reasons, comparison `insufficient`, and `promotionEligible:false` remain unchanged; no synthetic quality/time/cost was added.

### 2. Baseline reads did not compare all declaration/enrollment fields

The prior reader checked only run and manual arm after separately decoding the enrollment. It now compares the complete canonical enrollment and its digest against the authorized request, including dataset/case, policy, metric, environment, account limits and time. A changed metric with a recomputed enrollment hash fails instead of silently changing an authorized cohort's meaning. The shared check is also used during projection.

### 3. Registration preflight and write-lock boundary

Invalid policy/pin/case/started run, existing enrollment/declaration slots and conflicting dataset/cohort membership are refused **before** invoking external user authority. Confirmation remains outside the database writer transaction. After it returns literal true, open/no-outer-transaction is checked and every eligibility condition is checked again inside an **IMMEDIATE** write transaction before the existing atomic declaration+enrollment writes.

A ledger-local reentrancy fence prevents a confirmation callback entering another baseline store on the same connection. The fence always releases on failure. Exact immutable replay still requires no new confirmation, including historical replay after approval. A callback's external state changes are not erased by our failure handling; changed run state refuses registration.

## Verification

- New `integration-evaluation-baseline-outcome.test.ts` initially contained16 tests. `red.log` reproduced **12 failures / 4 passes** on original production code.
- First build failed TypeScript null narrowing in `trials.ts`; changing the existing never-returning failure helper from an arrow variable to a function declaration corrected narrowing without weakening validation (`build-pass1.log`, `build-pass2.log`).
- First focused gate had4 failures/21 passes: the new recorded-ID check hashed raw text, while `run-outcome.ts` hashes `JSON.stringify(id)`. Matched the producer's existing exact digest contract; focused pass2 then passed4 files/30 tests. Both logs retained.
- Expanded to20 new cases, including real SQLite writer contention and a recorded-outcome comparison. First coupled regression failed the new comparison fixture: it supplied a parsed plan object, losing the plan validator's private issuance brand. Changed the fixture to reuse the genuinely validated plan rather than relaxing production `invalid_plan:unvalidated-plan`. `regression-final.log` preserves205 pass/1 fail.
- **Final build exit0; 28 files / 206 passed / 0 failed / 0 skipped**, including20 new cases, exit0. `regression-verified.log`, `build-verified.log`, `summary.json` and exit file. Filename enumeration matches the command's28 selected files exactly.

Final command, from `daemon/`:

```bash
npm run build
npx vitest run test/integration-evaluation*.test.ts test/integration-native-compiled-imports.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose
```

Overlapping test runs are not summed. This is coupled evaluation/Core/IPC/UI/compiled-import regression, not a fresh whole `npm test` invocation.

## Coverage and authority limits

- Actual SQLite, immutable declaration/enrollment/observation/projection/comparison stores; reopen and replay.
- Four mode baseline failures, cancellation/unknown preservation, two-split comparison counts.
- Recomputed wrong policy mode/digest/ID digest; missing declaration and changed enrollment metric.
- Ineligible requests never invoke the external verifier; reentrant declaration is denied.
- Separate SQLite connection cannot mutate task state while final eligibility is checked: real `SQLITE_BUSY`/locked refusal under the IMMEDIATE transaction.
- Fixture policies, candidate refs and `()=>true` consent callback are explicitly **offline test authority**, not a user's actual consent or provider qualification. No model/provider/account/service calls, credential copying, Qwen restart, commit/push/publication or historical cleanup.

## Still unfinished

This fixes prerequisites discovered while examining the requested manual-baseline UI path; it does **not** add that UI or a native consent dialog. The default native execution host currently requires unpinned policies, while manual-baseline declaration requires a pinned candidate. A supported baseline execution configuration and genuine explicit user consent path must be designed together; merely exposing a button with a fixture verifier would be misleading.

Production measured-input/evidence collection and measured-fact→trial conversion, real provider qualification, independent review and approved paired measurements remain open. Existing outcome-only projections intentionally do not manufacture measurements. Original parent checklist stays **33/44 closed, 11 open**, subscription allowance4/4 spent and Qwen OFF.

Changed production files: `daemon/src/evaluation/baseline.ts`, `daemon/src/evaluation/trials.ts`. New test file plus current documentation overlays. Exact preimages and final pins are retained here.
