# Independent S3 engine bridge review

Reviewer /root/contracts_review, 2026-09-11. Verdict PASS for the host-only SQLite/selection/runtime bridge after one correction cycle. No remaining blocker in the reviewed scope. This is not full orchestration product or live adapter qualification.

Done gate: focused tests exit 0, atomicity/replay/pending-launch review, source hashes and scoped diff check. Artifact write cap 1 followed by readback/hash. Reviewer made no implementation edits, live calls or broad regression run.

Command (cwd daemon): `npx --no-install vitest run test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Observed exit 0, 8 tests passed, duration 424 ms. Scoped git diff --check exit 0. Current source/test hashes match component-result.json. Author build exit 0 is recorded there; reviewer did not rerun build.

## Findings corrected

1. Initially the runtime handle was published only after awaiting launch. A concurrent exact replay could reconcile with null snapshot and accept clean receipts while the original launch still had possible future side effects. The maker now publishes starting ownership and a shared AbortController before awaiting runtime, blocks reconciliation for missing/starting/uncertain ownership, and retains runtime generation checks once the handle is published. Deferred-launch replay/cancel/late-resolution regression preserves funds and writer lease and prevents false cleanup.
2. Initially selection treated request.observedAtMs as the current clock, allowing old request timestamps to make expired estimates appear fresh. Selection now uses host.now(); request/reservation timestamps are provenance constrained against that clock. Stale request/estimate regression rejects without launch or reservation.

## Verified integration properties

- Run policy binding and approved plan require exact snapshot digest plus policyId:revision. Explicit host currency/unit mapping is required; no implicit scaling is introduced.
- Claim, reservation and exact request journal occur under one BEGIN IMMEDIATE outer transaction with nested manager savepoints. Adapter launch happens only after commit; budget failure rolls back task claim and writer lease.
- Replay requires matching request journal/lineage/reservation, returns the existing claim and does not reobserve candidates, reserve again or relaunch. Conflicting timeout replay rejects.
- Runtime rebuilds current subject/admission even when observation flags are optimistic. Admission denial or partial start preserves uncertain funds/ownership.
- Execution and billing lineage are checked before atomic reconciliation. When a runtime handle exists, clean execution receipts require its verified cleanup; store/budget proof callbacks remain authoritative. Cancel acknowledgement cannot unlock writer ownership or invent final billing.
- Host task completion still returns acceptance unverified.

## Trusted boundary and incomplete work

Injected managers must be trusted instances over the same supplied SQLite connection. Host callbacks must provide current evidence, candidate estimates, per-stage envelope/owner authorization and verified receipts. This module does not create those identities or attest real process closure. Managers provide receipt authenticity semantics; hashes alone are not proof.

After restart or missing/uncertain local ownership, reconciliation deliberately returns null. A separate durable recovery/fencing path must settle these attempts; the engine does not automatically resume writes or release reservations. Full task scheduler, bounded retry/replan policy, actual multiple qualified tools, UI/core dispatch, final requirement acceptance and published workflow evidence remain incomplete. Existing activity ordinal 1 is reserved for the engine request journal and must be respected by later event integration.

## Reviewed SHA-256

- daemon/src/orchestration/engine.ts: E559AA11E4650DB7DEE4C47971A4078AA44486B495397A5FBD7A86A20685D69D
- daemon/test/integration-engine.test.ts: 20579C2133FAD4366EA9433309A00118354E7B9A3292B93E03C2EE7932675045
