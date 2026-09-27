# Batch93 — measurement contract integrity prerequisites

2026-09-22. Direct implementation/self-review; no independent reviewer. Qwen OFF, subscription allowance4/4 spent. Real provider/model/account/service calls0. No credential copying, user-home mutation, publication/commit, or exhausted actual GUI gate rerun. Original checklist33/44 closed,11 open.

## Why this bounded change

While inspecting production executed-input/fact conversion prerequisites, found concrete defects in the actual measurement registry/ingestion code. Corrected those rather than wiring producers into an unsafe or unusable contract. This batch is **not completion of the production measurement producer, default-app measuredFactHost or fact→trial conversion**.

## Implementation

`daemon/src/evaluation/measurement-contracts.ts`:

- Replaced the recursive definition snapshot: previously every array was rejected because Array.length is nonenumerable. Now supports dense arrays and nested data, rejects getters/proxies/functions/sparse or extended arrays/nonstandard prototypes/cycles without executing their code.
- Bounded total bytes/nodes/depth, individual keys/strings and collection sizes. Deep-copies/freezes returned definitions, so nested values cannot change behind their digest.
- Added `freezeMeasurementDefinition` as a common content-only producer serializer. It emits definition/sourceDigest, no authority/measurement claim. Object keys canonicalized, array order retained. Data-property definition avoids `__proto__` setters.
- Removed raw.then probing. Native Promises are rejected with `types.isPromise`, remaining responses are descriptor-validated without looking up then. The host contract is synchronous.
- Snapshots the validated host response **before** nowMs; clock callbacks cannot change the captured definition/source hash.
- Exact ID/revision registration replay returns the original validated saved record/time without host calls. New observations require new revisions; this does not claim live freshness. Cross fixture/host authority reuse refuses.
- Ledger-local callback reentrancy fence, final open/transaction recheck and IMMEDIATE registration. Separate-connection first-writer identical content is reused with its original time; conflicting content refuses without overwriting it. External callback transaction state is not rolled back on registration refusal.
- Historical scalar/object canonical bytes remain unchanged. During self-review removed an unnecessary ban on ordinary noncallable `toJSON` data; functions/accessors still reject without invocation.

`daemon/src/evaluation/measured-facts.ts`:

- Shared capture/read canonical validation now compares **id, revision and digest** for all metric/environment/accountLimits references, not merely the digest. A valid contract digest cannot be relabeled behind the enrollment's different ID/revision. Existing authority/time checks stay in place.

Added23 regression tests in `daemon/test/integration-measurement-contract-integrity.test.ts`; no changes to legacy tests needed. Added [developer guide](../../../../docs/integration/MEASUREMENT_CONTRACTS.md) and current progress overlays. Previous bytes are in `preimages/`; unrelated dirty files/history untouched.

## Verification

| Evidence | Result |
|---|---|
| `red.log` / `.exit` on original code | **10failed /6passed**,exit1 |
| `build-pass1.log` / `.exit` | build0 |
| `focused-pass1.log` / `.exit` |3files41pass,exit0 |
| `build-final.log` / `.exit`, `regression-pass1.log` / `.exit` | build0,31files248pass before final compatibility case |
| `build-verified.log` / `.exit`, `regression-verified.log` / `.exit` | **build0,31files249pass,0fail/skip,exit0**,90.50s |

`summary.json` reconciles31 selected files against executed rows (missing/unexpected0), including23 new tests. Earlier runs overlap and are not added to249. Tests use injected measurement hosts, actual temporary SQLite including reopen and two independent database connections, plus coupled Core/UI/workload/baseline/native-compiled-import regression. No real measurements or user confirmation are asserted.

No failed post-fix build/test needed a relaxed assertion, additional skip, timeout increase or production gate retry. The final extra case preserves legacy harmless toJSON data after self-review. Earlier red evidence is retained rather than rewritten.

## What remains

- Production execution-time input identity and quality/time/environment/account/price/cost evidence producers and app host composition.
- Verified fact→trial conversion with missing/unknown/revision/accounting lineage retained.
- Genuine user baseline selection, representative paired four-mode holdout measurements and current provider/runtime qualification after renewed call scope/budget where needed.
- Current full-suite regression, independent review and final release acceptance. Last whole npm test remains batch89 before90–93.

`trialReady:false`, outcome-only `trial:null`, claimed input binding and promotion denial remain. Known/missing data are not filled with fabricated numbers. This code improvement does not close an original parent item or turn all remaining code work into a budget blocker.
