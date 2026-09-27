# Independent local driver integration review

Result: no actionable source blocker found. Independent existing gate **33 PASS** (3 local + 30 legacy driver scenarios), 2026-09-11 21:33:29 local time. No model calls or product edits.

Reviewed hashes:

- `app/orchestration-driver.mjs`: `3BB1B0D69DF0D5E5EB915AA42905C409D2CF5BC3661FD1D12C74BBA08E08F48D`
- `app/orchestration-driver.d.mts`: `2250CC62916B97139F402D2FD5C9C5A577712F7D9F1F950A1FAAB1E17ADD0642`
- Initial `daemon/test/integration-local-driver.test.ts`: `8A689F7565791338218F22F42D721BFCE5E8984FB7BCF44EFBA564C40DB7CB9B`

The explicit local-invocation host discriminator selects local policy/count managers and the local engine. Other nonempty discriminator values are rejected; legacy omission preserves monetary behavior and declaration overloads. Local approval summaries contain count and timeout fields without fabricated currency/unit/limitUnits. Preparation uses one transaction for the exact policy binding, count limit, plan, requirements and generated target snapshots; contamination, mode/count mismatch and rejected preparation leave no partial policy/budget/plan rows.

Activation requires the original approval/envelope and is idempotent. The local deadline is the earlier of activation plus policy timeout and envelope expiry, further constrained by a retry deadline when present. A monotonic timer accompanies the host clock. Repeated activation returns early without rearming; later start and runtime callbacks are checked against the same deadline. Existing cancellation, pending-launch ownership, cleanup fencing and acceptance finalization checks are preserved. Count exhaustion or unknown cleanup prevents the checker, and execution counts do not produce acceptance or billing receipts.

Command from daemon: `npx vitest run test/integration-local-driver.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`, exit 0. Existing regressions cover replay, approval snapshots, retries, rollback, cancellation and absolute retry-deadline fences. Maker reports typecheck/build success; this reviewer did not repeat the shared build amid unrelated core/renderer work.

A bounded test-only follow-up was requested for the new local activation deadline specifically: frozen host clock, repeated activation, delayed start beyond the original deadline, zero dispatch and blocked state. The existing 33 checks and source inspection pass; that additional direct regression is recorded below once available.

Follow-up complete: final test-file SHA `2312417E182397B1BF626BB85FE65B3CD87A0E4C75F44604E473173A2F591E48`, driver source/declaration unchanged. Independent `-t 'activation deadline'` run passed at 21:36:20 (1 PASS, 3 filtered), proving the frozen-clock/repeated-activation case blocks after the original elapsed deadline with zero launches/reservations. The maker corrected an initial assertion that expected a rejected promise where start intentionally throws synchronously; no product correction was required. Combined independent coverage is the original 33 checks plus this one new deadline regression; a combined 34-test run was not repeated.

Limits: local dispatch remains fixed-pair routing, not performance/cost optimization. Fixtures use synthetic host qualification and no provider requests. This is not evidence of a successful local bootstrap, newly qualified production installation or a completed live generated workflow. Historical failed canary receipts remain unchanged.
