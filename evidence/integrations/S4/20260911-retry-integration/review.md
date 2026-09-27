# Independent connected retry review

2026-09-11 · `/root/contracts_review` · **PASS for connected retry driving, acceptance/history, observation and ledger upgrade**. Makers: `reuse_pure` driver, `transport_review` acceptance/history, `admission_impl` UI/tests, parent ledger wiring. Reviewer edited only this artifact.

Done gate: stable source review, build before compiled-helper tests, connected focused regressions, resolution of concrete failures, and final hashes. Correction cap: two reviewer findings, both resolved. No broad baseline or native/model/provider probes were run.

## Independent execution evidence

From `daemon`, `npm run build` exited 0. Then:

`npx --no-install vitest run test/integration-retry-backend.test.ts test/integration-driver.test.ts test/integration-driver-core.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-observation.test.ts test/integration-observation-core.test.ts test/integration-approval-plan.test.ts test/integration-runtime-contract.test.ts test/p5.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

At 17:30:01 this returned **106 PASS / 1 FAIL across 10 files**. The failing observation fixture deleted a past attempt to simulate zero attempts; migration 016 correctly rejected this with `immutable_attempt_identity`. The maker changed only fixture construction to create distinct ledgers with one or zero attempts. No immutable-history guard was removed.

Final independent `npx --no-install vitest run test/integration-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` exited 0 at 17:31:51 with **9 PASS**; final `npm run build` exited 0. Core production hashes below were unchanged between runs. This is the actual verification sequence, not a claim of a single final 107-pass run.

## Resolved findings and reviewed behavior

1. **Launch deadline fence:** timer/loop checks alone could miss a synchronous host callback crossing the retry deadline. Driver now checks before/after host runtime authorization and again in the returned candidate's launch wrapper, after evidence callbacks. The wrapper captures the original bound launch, rejects cancellation/closing/expired approval, and refuses side effects after deadline. Tests cover authorization and evidence-callback clock advancement with zero actual launches and retained uncertain reservations. Existing final-manifest pre/post deadline guards prevent late acceptance.
2. **Immutable-history fixture:** the independent connected run exposed the obsolete attempt deletion described above. Separate actual zero-attempt fixtures now preserve both negative billing assertions and the production SQL guards.

- Retry limits and contract digest are frozen in approval before execution and cannot exceed the approved envelope expiry. No-contract and unclassified failures remain blocked. Exact clean failed receipts form explicit retry references/new IDs; backend independently checks classification, previous-attempt consumption, caps, deadline, policy and cumulative budget. Stop/close interrupt active work and collection; unknown cleanup remains owned and reserved.
- Driver uses host-clock and monotonic elapsed-time deadlines, cancels active ownership on expiry, rejects further launches, and ignores late collected evidence. This does not preempt arbitrary synchronous host code or establish remote provider termination.
- Acceptance validates complete per-task root-to-tip retry chains, immutable retry contract/link references, latest receipts and clean state for **every** attempt. It uses the successful tip verifier, while reviewer identity must differ from every historical implementation principal, including failed attempts. Dirty, orphaned, reversed, stale or altered lineage cannot finalize.
- Legacy single-attempt lineage encoding remains compatible. Historical integrity includes all retry attempts, stages, links, receipts and contract; callbacks are not re-run to display a past accepted record. Current acceptance still requires trusted registered checker observations and manifest rechecks.
- UI projects one latest attempt per stage and retains total/failed counts, bounded past-attempt history and prior activity. Final cost requires every historical attempt terminal and clean and every reservation covered by a final provider receipt; latest-stage success alone cannot hide previous unknown cost. Approval displays immutable retry limits/digest.
- `openLedger` invokes migration 016 after 015 outside any surrounding transaction and closes the database on upgrade failure. The legacy upgrade fixture now constructs actual raw SQLite schema 001–015 independently of current `openLedger`; compiled migration and reopen tests preserve existing linked history. P5 migration/recovery regressions passed in the connected run.

The earlier flaky acceptance timeout assertion was separately diagnosed by its maker before this run: total time could expire between callbacks, when no inner abort listener existed. The test now uses controlled fake time and waits for the intended collector before asserting abort and late-result rejection. Production timeout semantics were not relaxed; acceptance/history tests passed in the independent connected run.

## Source snapshot

| Path | SHA-256 |
| --- | --- |
| app/orchestration-driver.mjs | 88671539BB7945D16A0A2A9CECC7FC9E88507459C60D01EAEE2DC8318D4186B0 |
| app/orchestration-driver.d.mts | 4C98CF53C9F06D5116F5001FFE3D0B2B0A4A74C5D82974B00D9B5C0846D49697 |
| daemon/src/ledger.ts | 95071A449382759E007ABD39762E32C3EE7FDC62EFF49CCAD06C2D8A1638A770 |
| daemon/src/verification/acceptance.ts | 256D64317BFCB24719556B2A1EBE57E93E2E274B3AEE382ED2564FE26F6401E0 |
| daemon/src/ui/orchestration.ts | 588143D98845E2C0CD582A42EA896BE43D6092B9DF189F3EA3BCB93453330A41 |
| app/renderer/index.html | F99E32F9693FDAD088B98B8FB5A3BAFDBC6DD902B59630F2A782DAF75614C3C0 |
| app/renderer/renderer.js | 0ADF850D63C1CBA22C2B6F2B8FF033AB9B3DC443C27C1F238B233B3FF3280BC5 |
| daemon/test/integration-driver.test.ts | DC5A3E2401C6BD9918E2919C06E71499851684D55365EDFB8922C3CE547BFE10 |
| daemon/test/integration-acceptance.test.ts | 500A4870A400B66C31CC6CF798530571D0B72E7F637276C08FAA1CE5C6E76C90 |
| daemon/test/integration-acceptance-history.test.ts | 4C708EC1A10D52EB99F7BC654B7138CFD3A48CF92895FDADF9975F878C614EFB |
| daemon/test/integration-observation.test.ts | 517D8CFFE45F679CA24BAEB0A773B6A994BDF89B11DE40B45A4E7372B678C7D9 |
| daemon/test/integration-approval-plan.test.ts | 83FB7AD23A7787014A5F449D04FE5BD03EC90A90B200CA0208E0BA0DA327E553 |
| daemon/test/integration-retry-backend.test.ts | 952A91AF27CBA2A76482E4043602EA853459FFEAAB7ECDA1471CF803EAA57E72 |

## Limits

Real SQLite, worker concurrency, local owned-process recovery fixtures and DOM rendering were tested with synthetic trusted orchestration/checker callbacks. No real model/provider or transient-failure classifier was qualified. The driver performs bounded retry admission/driving; it does not add exponential backoff, crash-time automatic resumption, or remote stop/billing proof. Historical hashes are integrity checks, not authentication against a hostile full-database rewrite or fresh verification of present files. No independent Electron visual QA was performed in this review. Whole-project completion remains separate.
