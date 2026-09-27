# S5 Unit 1 measured-fact ingestion independent review

Date: 2026-09-12 KST

Status: **BLOCKED after correction 2/2**

Reviewed frozen Unit 1 sources against `../20260912-measured-facts-design.md` Unit 1 and the maker `RESULTS.md`. No provider, model, native helper, Electron, network, paid, or credential call was made.

## Passing evidence

- Reviewer focused gate: measurement contracts plus measured facts, 2 files and 9/9 tests PASS.
- Recursive registry canonicalization rejects nested accessors before execution or writes.
- Identifier-only capture, forced offline authority, immutable scalar/payload reconstruction, current-033 attempt lineage, activity manifests, latest-observation capture, historical read, same-connection immediate-transaction mutation detection, single-read input evidence, and terminal-receipt-only monetary forgery are covered.
- Frozen hashes independently observed:
  - `daemon/src/evaluation/measurement-contracts.ts`: `7ae5749151cb19c2fc36be6aeb87703398686485f470119592f9eecb54212447`
  - `daemon/src/evaluation/measured-facts.ts`: `aff76f3ed5a7ee2c650b8b2d59247860f9ff27086ef930130e328ce640f2adb1`
  - `daemon/migrations/034_evaluation_measured_fact.sql`: maker reports source/dist parity `eaa07960c3259bb8127b5b40c82b7c5fea1f296f4b1fbf438357434569e036d0`.

The maker previously recorded the required six-file gate at 30/30 PASS, build, nonincremental typecheck, Core syntax, fresh/pre-034 reopen, foreign-key check, parity, and owned diff check. A repeat full gate was not accepted as final reviewer evidence because concurrent S4 work temporarily left a missing dist migration 036 and an unrelated `recovery-policy.ts` type error.

## Blocking findings

1. **Monetary coverage is not proven.** `validateAccounting` validates only the receipt items supplied by the host. It does not enumerate every reservation/latest receipt for the run and compare that authoritative set with the claimed items. A host payload can omit another latest `actual` provider-final receipt and still store a monetary total that understates observed cost. This violates the Unit 1 requirement that all cost-bearing item coverage be confirmed before total cost is complete.

2. **Cost classes remain caller assertions.** The validator accepts any enum value among `base|retry|handoff|verification` after binding the receipt to an attempt. It does not derive retry from `orchestration_retry_link`, handoff from a separately billed handoff item/evidence, or verification from the stored plan role. This permits exclusive but false cost classification and violates the required class lineage checks.

3. **Exact replay is incorrectly coupled to the latest observation.** For an existing fact, `capture` calls `canonical(..., requireLatest=true)`. After a later observation revision is appended, replaying the unchanged original `{factId,enrollmentId,observationId}` fails `stale_observation` instead of returning the immutable original. The design requires exact replay to return the original while changed producer/digest replay fails; latest-observation enforcement belongs only to first capture.

The correction budget is exhausted, so these findings are preserved without further product edits. Unit 1 must not be used as a complete monetary fact seal or as promotion/live-performance evidence. All facts already remain `trialReady:false`, and checklist lines 200, 201, and 204 remain open.
