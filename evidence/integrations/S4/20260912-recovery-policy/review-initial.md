# S4 Unit 1 independent initial review

Date: 2026-09-12

Verdict: **FAIL — correction required**

The makers froze this as the initial implementation. The maker baseline reported build and TypeScript PASS, but the required combined focused gate was 81/90 PASS with nine failures. All nine failures were attributed to retry fixtures whose evidence descriptors no longer matched the newly frozen source-revision contract. This is a real gate failure; it is not relabelled as an infrastructure issue. Correction 1 is therefore consumed when the fixture/source correction is retained and re-run.

Independent source review also found these initial defects:

- Migration `036` hashed payload bytes without binding all authority-bearing scalar columns. Scope limits and identity, observation cause, decision action/revisions/candidate, and plan-revision authority fields could diverge from otherwise valid payload bytes. Public paths consumed some of those scalars. Direct valid-payload scalar mismatch tests and read-time validation were required.
- The migration's decision-terminal trigger established only handoff-row existence plus failed/clean attempt state. It did not establish the S3 terminal-integrity artifact chain that the public recovery path claimed to depend on.
- `proposedCandidateId` changed identical trusted authentication/transient observations from stop to switch. The caller therefore selected the branch unless the host independently enumerated and selected the eligible approved candidate.
- A quota retry had a recorded reset time but initially lacked a durable driver not-before path.
- `appendRevision` did not preserve old pending/blocked steps as explicit superseded history.
- `recordDecision` could make a non-stop decision using attempt/deadline data without authoritative monetary/local budget availability. The interim monetary `SUM(reservation.upper_units)` approach was also insufficient because it ignored settled actual, debt, and unknown accounting semantics.
- Authoritative reads and live proof were performed before the small INSERT transaction, allowing a final-slot or concurrent-revision race to persist stale decision facts. Outer-transaction/reentrant host behavior also needed a fail-closed contract.
- Revision-one launch initially failed because S3 handoff activity resolved only the original plan digest instead of the exact `attempt_revision -> plan_revision` tuple.
- Acceptance initially dropped the registered checker's `evaluate` result, did not bind every producer principal, and did not compare evidence source revision with a frozen approved source binding.
- The generated acceptance host initially hard-coded revision zero and selected the latest task attempt without exact revision linkage, leaving no positive revision-one generated-host proof.

No final PASS is possible from this baseline. The independent final gate is deferred until correction 1 source is frozen, as required by the assigned checker boundary.
