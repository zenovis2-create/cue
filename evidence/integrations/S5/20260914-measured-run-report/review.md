# Independent measured run report review

Verdict: **PASS**

The final implementation preserves the original `readRunOutcomeReport` digest as `measuredEvidenceBaseReportDigest` and adds a separately branded, separately read measured-evidence summary. Core rejects closed/outer-transaction reads and non-current-workspace runs before orchestration or measured-evidence callbacks and before creating report output. The summary query is exact-run scoped, scans at most 64 stored candidates, emits at most 20 records and 20 attempt identities per record, and declares scan, omission, corruption, and attempt truncation counts without claiming whole-database coverage.

The safe projection exposes identifiers/revisions, producer class and time, measurement availability, and elapsed time only. It does not expose evidence references or bytes, uncertainty reasons, quality scores, accounting totals/kinds, candidate/attempt identities, or private digests. Host absence is fixed unavailable, an accessible empty run is explicitly scan-complete, corrupt or changed evidence is counted generically, offline fixtures remain identified by producer class, and all levels retain `trialReady:false` and `promotionEligible:false`. The branded append boundary rejects arbitrary injected objects before ReportIR construction.

The actual Core export fixture uses SQLite plus the existing measured-fact store and host. It verifies current-run revalidation, changed evidence bytes, stored tamper, foreign/rejected runs, zero measured capture and database writes during report reads, reopen/replay stability, safe HTML content, original digest preservation, and delivered receipt stability. The fixture is synthetic: it injects terminal-integrity authority and seeds lineage rows after disabling selected triggers/foreign keys. It therefore verifies report behavior over actual stored measured-fact machinery but does not qualify a real provider/runtime, native execution, trial, measurement accuracy, or promotion.

Independent focused gate (single checker pass): **5 files, 37 tests passed, exit 0**. The build was not duplicated; maker pass 2 records build exit 0. Full command and result are preserved in `logs/independent-focused-test.log`.

Final SHA-256 pins were independently recomputed and match `final-pins.json` for all six declared files:

- `app/core.mjs`: `937a0ac719d21bc99cb330a8efef580dc49aff065b9ffc6b3fa3eb1d81dde420`
- `daemon/src/reports/ir.ts`: `ba8c83a672a772c8c495fb917b639baf2f8f6d71c87a06f21d1c3d1e183f50ca`
- `daemon/src/reports/measured-evidence.ts`: `3009b623b489540de7b461113abb265a5df6c03b1c918c1ba6b11bb595d339d6`
- `daemon/test/integration-run-outcome-report.test.ts`: `373e4132e764eb5c5ad3943d005db399e3f0d4c22c8175d2e21376c44ecb1353`
- `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts`: `95b0863010fb3c139006a248b4938c21840a4bd509bd10d52ee987a410b374e0`
- `daemon/test/integration-run-report-measured-evidence.test.ts`: `fc7d6fcaa86b6fca39cdb43a7b756f15247f00adde061abc38d55699387fcef1`

`git diff --check` reported no whitespace errors for the scoped source and tests. No model, server, network, native helper, live Electron session, commit, or push was used.
