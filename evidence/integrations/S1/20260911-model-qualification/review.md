# Independent collector review

Verdict: PASS for the bounded collector implementation and native fixture path. This is not live M qualification or default-host enablement.

Done gate: read-only source audit, focused fixture suite, typecheck, exact source hashes, and this review artifact. Review pass cap: 1; any source correction requires a diagnosed maker pass and a new source-bound gate. No product files edited.

Independent checks (2026-09-11):
- From daemon: `npx --no-install vitest run test/integration-model-qualification.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 6 passed, started 20:30:33, duration 41.72 s.
- From daemon: `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Source SHA256: `5A2D24FB09B305F98A87A5EE2E044B04CA0BC7D6ADDC94EDDCC57937E01BC0E8` (`daemon/src/model-qualification.ts`).
- Test SHA256: `EF1D67CB56944C7C39178DE0E10F86FE90AE246261128C2B01B83C87813E91E5` (`daemon/test/integration-model-qualification.test.ts`). Both match maker evidence.

Confirmed:
- Any fixture seam forces fixture evidence and eligible=false; model fixtures require an explicit transport. No live Qwen request was made by this review.
- Non-fixture execution requires the installed compiled collector path. Control and fixed diagnostic bundles are compared before and after measurement; the full subject and manifest must remain equal.
- Actual owned launcher sessions, suspended worker token/PID/Job observation, exact recipe and production-versus-diagnostic pins are checked. Diagnostics remain distinct from production execution.
- Filesystem measurements require actual denial errors, existing targets, unchanged host-observed contents and package ACLs. Controlled TCP requires host positive controls before and after, and no child connection/send or nonce receipt. Timeout is not relabeled as an observed firewall drop.
- Cleanup is independently observed and durably persisted; unknown/residual cleanup, abort, private-root cleanup failure, subject drift, or protocol failure prevents PASS. Raw journal bytes are reread inside the immediate publication transaction; tampering leaves zero capability records. Outer transactions and pre-abort refuse before launch.

Live integration constraint (not exercised): lines 23–24/59 pin the loaded collector file itself, but not every already-imported dependency at its load time. Rebuilding a dependency after module import but before the initial subject scan can leave stale in-memory code associated with current on-disk subject files. The maker's fresh compiled-process/source-freeze prerequisite must therefore be enforced by the live host/issuance entry point. This review does not approve in-process requalification after rebuild or claim that the API independently fences all loaded-module drift. Parent and maker were notified.

Limits: native tests use synthetic transport/subject seams; they demonstrate actual local Windows client isolation observations under fixture classification. M3 is the fixed-client controlled-loopback contract, not arbitrary network denial, B3, provider confinement, provider billing, or whole-machine security. Fresh real subject/transport measurements and their separate publication review remain necessary for live eligibility. Whole-project GOAL remains active.
