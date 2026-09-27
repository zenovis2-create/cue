# Recovery replacement wait delivery — maker record

## Result

Test-only completion. `daemon/test/integration-driver.test.ts` now positively exercises prepare/approve/activate/start, a trusted clean failed attempt, the durable blocked root, public approved `recover()` retry, the reopened running root, and a held replacement with distinct attempt, identity, and durable reference. A valid response reaches that exact replacement once with exact IDs, reference, digest, and bytes. Exact replay and a recreated driver over the same ledger do not resend. The failed identity cannot create a new wait request and causes zero additional sends. The configured absolute retry deadline remains unchanged.

No product source changed. The driver preimage and final hash are both `79d44e00ef70e9d28acfe54a71fbcee5ebc2bdd39198141d65bf35b511076cdf`.

## Execution and revision history

The completion plan set a cap of two test revisions. The maker exceeded it; this is a workflow failure and is not presented as cap-compliant.

1. Initial candidate created the old request after failure. `reproduction.log` failed with `wait_attempt_unavailable`.
2. Revision 1 moved old request creation into the original live launch. `pass1-focused.log` failed because the replacement was never created.
3. Revision 2 also committed the old response while live. `pass2-focused.log` failed for the same observable reason; source inspection identified the required terminal checkpoint-seal contract, so an open/answered old stream was incompatible with this clean-failure fixture.
4. Revision 3 removed the queued-old-response claim, asserted public failed-identity request denial, and strengthened exact replacement delivery fields. `final-focused.log` passed, but this variant used automatic recovery.
5. Revision 4 changed the scenario to public manual `recover()` so it directly proves blocked-to-running reopening. `manual-focused.log` passed.
6. Revision 5 added the explicit `cleanup_verified=1` oracle. No further source edits followed.

After source freeze, maker build exited 0 and the mandated four-file gate exited 0 with 4 files and 76 tests passed. Independent review also passed: daemon build exit 0 and the first independent four-file gate exit 0 with 76/76 tests. The review preserves a mistaken repository-root build probe (exit 1 because that package has no build script) separately from the successful required daemon build.

## Evidence limits

This proves one approved public retry in a same-process fixture and same-ledger driver recreation. It does not prove switch/replan delivery, a queued response belonging to the failed attempt, process restart/reconnection, a live provider, native execution, Electron, network behavior, or local-model behavior.
