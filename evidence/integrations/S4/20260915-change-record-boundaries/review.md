# Independent review: S4-03 change-record boundaries

Date: 2026-09-15
Result: PASS; the original S4-03 condition is satisfied within its stated offline Windows-fixture boundary.

## Original condition

`쓰기 전후 기록·복원 한계·해시 충돌·경합·junction을 검사한다.`

The execution map makes the acceptance boundary concrete: pre/post image lineage, mismatch/contention/junction refusal, non-restorable classification, and zero unauthorized restore writes.

## Findings

- Capture stores bounded preimage bytes, per-entry SHA-256 and native file identity, plus a digest over the ordered preimage manifest. Observation takes a fresh native snapshot and records created, modified, removed, or unchanged status from the pre/post comparison.
- Native fixtures cover exact bytes including empty content, file identity, target and ancestor junctions, root substitution, hard links, traversal, size/count limits, and helper/root identity mismatch. Packaging verifies the fixed native helper metadata.
- A stored preimage byte substitution under its unchanged digest label makes public replay fail with `change_set_replay_mismatch`; it creates no second change set. This is digest-label/byte mismatch resistance, not a claim that a cryptographic SHA-256 collision was constructed.
- Missing stop authority throws before either supplied restore callback runs.
- The separate stopped-decision fixture deliberately relaxes recovery-decision database constraints only to reach the change-record API's logical stopped-plus-lease branch. That branch returns `atomic-race-closure-unsupported`, calls neither host write callback, and leaves file bytes unchanged. It proves the declared non-restorable boundary, not creation of a policy-qualified stop decision.
- Production restoration remains inert because no atomic compare-and-swap filesystem host is implemented. The implementation therefore does not claim successful automatic restore.

## Independent gate

From `daemon`, the three focused suites passed with exit 0: 3 files, 19 tests, duration 3.06 s. The suites were `integration-change-records.test.ts`, `integration-change-records-native.test.ts`, and `integration-journal-packaging.test.ts`.

No build was run for this test-only unit. Product source was unchanged, and the focused gate exercised the current compiled native helper. No provider, model, network, Electron, or local-model call occurred.

## Reviewed pins

- `daemon/src/change-records.ts` — `2643a84c96144b9174cd39da4562ac2f932c667f22c1f10da5a23e89f0d31240`
- `daemon/test/integration-change-records.test.ts` — `de8911eeb410c5b8a8acf3d88778a242c0523730842635a5439ee604a6439992`
- `daemon/test/integration-change-records-native.test.ts` — `f253e20da66716fd48c765c9f1db926d5da383b3688e6310aacb8a0dc53737a9`
- `daemon/test/integration-journal-packaging.test.ts` — `fdc1458a4624d78f040792ed15d944356d37af8dbeb9f88ea6e5899086cd6b3b`

This closes S4-03's inspection and refusal contract. A future successful restore feature would require its own atomic race-closure implementation and tests; that feature is outside the original condition proven here.
