# Independent review: historical stage binding

**Verdict: CLEAR for this bounded historical-read repair.** It does not qualify a live provider, prove external billing, or close the full product checklist.

Final source pins reviewed:

| File | SHA-256 |
|---|---|
| `daemon/src/orchestration/stage-envelope.ts` | `240d713ee59326f09ab1c190fce19e5149764f00c91922632316a0f292e8c081` |
| `daemon/src/verification/acceptance.ts` | `9f2268e60bfb305349fbc22d04a9b4693690d62d7efd939ea6bf7083b2462730` |
| `daemon/src/verification/native-existing-file-acceptance-host.ts` | `d2a010e62fe7f4b0dc0f626ff59e636c244e10ae185583ed1fe56ac46101d6ce` |

`readHistorical` is a separate provenance read. For a staged attempt it verifies saved parent/stage/request/child ownership, approved plan/policy/candidate/scope, canonical and digested setup/authority/cleanup payloads, validated account binding, exact publication path and identity against run staging authority and change root contract, and a terminal attempt with `active_cleanup_verified`, `rootAbsent: true`, and `metadataAbsent: true`. It avoids resolving the removed execution path; the parent publication root remains live and checked. `read` and `bind` retain their strict live cleanup denial. Both acceptance-history branches and native existing-file acceptance use the historical method.

The first audit found a real gap: setup publication path and root identity were only self-consistent and contained within the parent. A recomputed setup payload/hash could have changed them after trigger bypass. The worker added exact parent/run staging authority/change root contract comparisons, account-binding validation, and the verifier role guard before this verdict.

Independent focused command in `daemon`: `npx --no-install vitest run test/integration-stage-envelope.test.ts test/integration-acceptance-history.test.ts test/integration-native-existing-file-acceptance-host.test.ts --fileParallelism=false --maxWorkers=1` — **3 files, 31 pass, 1 platform skip, exit 0**. Root's separate final build exited 0. [Independent full-chain log](../20260919-native-success-chain/review-final-test.log) and [JSON report](../20260919-native-success-chain/review-final-test.json) show **2/2 pass**, including normal acceptance after committed publication and the stale-admission case. The frozen full-chain fixture asserts one staged implementation cleanup, two exact task receipts in the normal case, a historical positive read, strict live denial after cleanup, and three rollback-contained corruptions with recomputed canonical payload and hash (setup publication path, authority execution file identity, cleanup `rootAbsent: false`). Each corruption must fail historical reading and restore the original binding after rollback. The verifier is nonstaged, so one `attempt_staging_cleanup` row is expected; process cleanup observations are separate.

The evidence plan records pre-edit source observations, not contemporaneous preimage byte copies. This review relies on the pinned final source and executed gates. No provider, model, Qwen, network, or live service call was made by this review.
