# Independent source audit

Audited without running tests or external/native providers.

- `app/orchestration-driver.mjs` `79d44e00ef70e9d28acfe54a71fbcee5ebc2bdd39198141d65bf35b511076cdf`
- `daemon/src/request-queue.ts` `d6694ca7344cedad43e36e88054873c3f4995b2b3f214107f9f31a5cce0d322f`
- `daemon/migrations/035_orchestration_wait_checkpoint.sql` `efe79e0d2b7a86806c342745313cbba6e2790847bfd9b5370a21ca5a71869e92`
- `daemon/test/integration-driver.test.ts` `0356a0b34f3220c9e190946a067b1d263f3c5aa690767027974c9e4fed3654cd`

Source contract findings:

1. `applyRecovery` derives retry/switch/replan from the durable recovery store, records the activation, and places one exact task/candidate/revision in `pendingRecovery`.
2. `drive` constructs the replacement attempt from that durable decision and clears `pendingRecovery` only after `engine.start` returns.
3. `request-queue.current` admits waits only for a running attempt with matching immutable identity and launch-intent hashes; the failed predecessor cannot acquire a new wait.
4. `deliverWaitResponse` claims an exact request/response/attempt/identity/durable-ref payload before invoking the host. A replay sends nothing: it reports delivered only from an immutable delivered observation and otherwise remains blocked-unresolved.
5. The table-driven test exercises public retry, switch, and replan recovery paths, distinct predecessor/replacement identity, replan digest binding, exact delivery bytes, reopen replay, and predecessor rejection. Its fixture remains synthetic and therefore establishes no provider qualification.

Pre-test result: no source-contract defect found. Final verdict waits for the single frozen combined gate.
