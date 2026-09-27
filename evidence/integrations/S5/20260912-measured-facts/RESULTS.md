# S5 Unit 1 measured-fact ingestion results

Date: 2026-09-12 KST

Status: **FINAL BLOCKED after correction 2/2**.

Implemented migration 034 immutable metric/environment/account/price registries and measured-fact seals, identifier-only host capture/read APIs, forced offline-fixture authority, recursive canonical registry validation, same-attempt current-033 lineage and activity manifest checks, host-resolved input/artifact/clock evidence, independent metric verification, mutually exclusive accounting categories, latest-observation capture, immutable historical reads, and immediate-transaction dependency revalidation. Missing evidence remains null/unknown with bounded reasons; every Unit 1 fact remains `trialReady:false`.

Validation:

- `npm run build`: PASS.
- Required six-file focused gate before concurrent S4 edits: 6 files, 30/30 PASS. Correction 2 Unit 1 files: 9/9 PASS.
- `tsc --noEmit --incremental false`: PASS.
- `node --check ../app/core.mjs`: PASS.
- Fresh and simulated pre-034 file-backed close/reopen: PASS; five Unit 1 tables present and `foreign_key_check=[]`.
- Migration 034 source/dist parity: `eaa07960c3259bb8127b5b40c82b7c5fea1f296f4b1fbf438357434569e036d0`.
- Owned-file `git diff --check`: PASS; existing LF/CRLF notices only.

Key source hashes:

- `measurement-contracts.ts`: `7ae5749151cb19c2fc36be6aeb87703398686485f470119592f9eecb54212447`
- `measured-facts.ts`: `aff76f3ed5a7ee2c650b8b2d59247860f9ff27086ef930130e328ce640f2adb1`
- `app/core.mjs`: `3298feaf0d3e5db5aed33d0f645bd49aee6b11b85e00d5d404a3b8c302a129c0`
- `app/core.d.mts`: `5074acc0fd2bede75ceed0e68412932c3d72fc77bde2be5e075d490131a7d1bf`

The requested outcome regression fixture was updated to use the accepted public 033 launch-intent, durable-session identity, authorized artifact handoff, and terminal path; its 10/10 tests pass. No run-outcome product semantics changed.

Correction 2 resolved the stateful double-read input bypass and derives monetary actual/provider-final units, currency, unit, latest revision, and attempt/request lineage from the existing integration budget receipt/reservation tables. A terminal orchestration receipt cannot create billing truth. The final combined rerun was externally blocked after concurrent S4 source changed: compiled migration 036 was temporarily absent and `recovery-policy.ts` referenced an undefined `facts` shorthand. Neither file is in Unit 1 ownership; the 9/9 Unit 1 correction gate remained green.

Independent review still found three blockers: claimed monetary items are not compared against the complete authoritative latest receipt/reservation membership, cost class is not derived from retry/handoff/verifier lineage, and exact replay incorrectly applies the latest-observation gate after a newer revision exists. The correction cap is exhausted, so these defects remain preserved rather than weakened. Review: `review.md`, SHA-256 `975b38710c7fd81d4ce57f8a5eaacf1055fa5c55e5b9f80ec30f1e0601b7fa9c`.

Evidence boundary: local synthetic fixtures only. No provider, model, native helper, Electron, network, paid, or credential call occurred. This does not close checklist lines 200, 201, or 204 and does not create trials, comparisons, campaigns, promotion, rollback, prices, scores, or live claims.
