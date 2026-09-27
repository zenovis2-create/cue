# S3 bounded wait/checkpoint maker record

Date: 2026-09-12 KST

## Scope and invariant

Migration inventory was observed after S5 registration: source maximum 034 existed, so this unit reserved 035. Migration 033 and 034 were not edited. Response delivery keeps the existing attempt and identity, commits one dispatch and wait-cursor advance in one immediate transaction, and never calls `engine.start`, `claim`, or `claimRetry`. The optional synthetic host callback runs only after commit for the currently owned in-memory handle. A missing callback is `unsupported`; replay/reopen never sends and remains `blocked-unresolved` unless an exact delivered observation already exists.

## Maker and correction results

- Initial direct queue gate: 3/3 PASS for request/response/dispatch replay, cancellation conflict, and checkpoint order `3,1,2,final(4)` with an immutable seal.
- Initial synthetic driver gate: 1/1 PASS. Delivery count stayed one across exact replay/recreated driver; a second committed dispatch without capability returned `unsupported`, then `blocked-unresolved` after recreation.
- Correction 1 counterexamples: non-enumerable required DTO fields could reach encoding; checkpoint cursor did not rerun full source authority/canonical equality; cancelled/expired reconciliation lacked renewed authority; dispatch did not compare response columns to canonical bytes. All four were fixed. Direct queue gate after correction: 4/4 PASS, including zero-write hostile DTO and revoked-authority cursor stops.
- First complete six-file run before correction: 63 PASS / 5 FAIL. The queue, handoff activity, handoff integrity, and driver files passed. Four observation failures were pre-existing historical fixtures without current 033 handoff integrity. The concurrency worker reported only `database is locked`; its harness discarded the statement/stack. The 035 install check is now performed under one immediate transaction so concurrent openers serialize the check and install.
- A later shared build attempt was blocked by concurrent S5 TypeScript errors in `src/evaluation/measured-facts.ts` (`base` and `obs` possibly null). No S3 compiler error was reported in that attempt. The earlier S3 source/store seam TypeScript and build passed before those concurrent edits.
- Final maker gate after S5 stabilized: six files, 69/69 PASS. Nonincremental TypeScript PASS, build PASS, and the isolated independent-connection claim probe PASS. Fresh file-backed migration plus two opens returned `integrity_check=ok`, `foreign_key_check=[]`, and `cue-wait-checkpoint-v1` both times. Source/dist 035 bytes match.
- Correction 2 closed the mutable migration-marker/legacy-fence defect with explicit update/delete denial. The direct queue matrix expanded to 9/9 PASS: every populated append-only table rejects update/delete/replace; copied pre-035 state fences the old attempt exactly once across reopen; a raw connection without `cue_sha256` cannot write a payload; outer rollback cuts leave zero request, response/resolution, dispatch, or cursor rows; responder/ordinal/claim denial leaves zero dispatch; hostile acknowledgement accessors leave zero observations; terminal finish rejects a missing seal and changed resolved bytes, then accepts the exact restored sealed bytes; late final input cannot overwrite the seal.
- Final correction-2 gate: six files, 74/74 PASS; nonincremental TypeScript PASS; build PASS; source/dist parity and scoped diff check PASS. The attempted `--reporter=basic` invocation failed at Vitest startup because `basic` is not a built-in reporter; no tests or product state ran, and the corrected JSON-reporter invocation produced the 74/74 result.

## Preserved evidence

- `033_orchestration_handoff_integrity.sql`: `d2ada29d74c3c50e310002db7938d86c6c68163817513ab19571d24fc3e4e9b2`
- `034_evaluation_measured_fact.sql`: `eaa07960c3259bb8127b5b40c82b7c5fea1f296f4b1fbf438357434569e036d0`
- `035_orchestration_wait_checkpoint.sql` source/dist after correction 2: `efe79e0d2b7a86806c342745313cbba6e2790847bfd9b5370a21ca5a71869e92`
- Scoped `git diff --check`: PASS; only repository line-ending notices for the already shared ledger/copy files.

This component does not claim that a real adapter, provider, model, native helper, or durable live-control recovery consumed a response.
