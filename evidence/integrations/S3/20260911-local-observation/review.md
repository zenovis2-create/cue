# Independent local invocation observation review

Code/focused verdict: PASS; final compile awaits the separate driver's compile-ready signal. No product edits or model calls by reviewer.

Independent command: `npx --no-install vitest run test/integration-local-observation.test.ts test/integration-observation.test.ts test/integration-reports.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 20 passed (3 local, 10 observation, 7 reports), 2.59 seconds at 2026-09-11 21:30:30 KST (tool 3903b9).

The localAccounting property is absent without a local invocation budget, preserving the existing legacy DTO shape in that case. Its values explicitly mean committed dispatch intent, not provider request count or measured billing. Monetary budget projection remains separate and unknown monetary amounts remain null. The projection does not turn counts into cleanup verification or acceptance; the meaningful local fixture has one actual reserved orchestration attempt but still reports unknown cleanup and unverified acceptance.

Recorded count values require a persisted local policy binding, absence of a monetary binding, exact budget policy ID/revision matching that binding and the plan approval, the approval policy digest matching the immutable snapshot, and budget limit not exceeding the policy attempt ceiling. Invalid/missing local lineage yields an explicit unknown count object with null values. The existing budget reader validates its persisted policy/reservations before returning committed and remaining counts. The newly added policy display resolves the immutable run binding rather than inferring the mode from planned metadata.

Private local accounting source metadata is not projected. Returned local accounting is frozen. The test measures actual SQLite `SELECT total_changes()` before/after the read and observes no mutation; it no longer compares a nonexistent JS property. The focused regressions retain existing historical receipt, unknown cost, stage/history bounds and report observed/planned behavior.

Scope: fixture ledger projection only, no provider telemetry, live model proof, runtime accounting integration, current file acceptance, or external pricing claim. Exact lineage mismatch/over-ceiling branches are source-reviewed; the three new tests are not exhaustive corruption injection coverage. Protected ledger ownership remains the trust boundary.

Hashes:
- daemon/src/ui/orchestration.ts SHA256 7B4D6BB809E40BD0A1E10FECD6CACE71AFE140FF65FEC15424DB84CD5AD63227
- daemon/test/integration-local-observation.test.ts SHA256 4EF615865B5143C474F0A5D881177EF66C5901E2A220BAC88C89EFCA9701100B

Final independent compile: `npx --no-install tsc -p tsconfig.json --noEmit`, exit 0 (tool a1be7d), after parent confirmed driver overload correction compile-ready. Final bounded review verdict PASS. No full regression rerun or model calls.
