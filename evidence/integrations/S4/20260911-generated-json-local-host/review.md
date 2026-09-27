# Independent generated JSON local host review

Verdict: PASS for protected host composition. No source corrections required, no product edits or model calls by reviewer.

Independent gate: `npx --no-install vitest run test/integration-generated-json-host.test.ts test/integration-generated-json-local-host.test.ts test/integration-generated-acceptance-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 25 passed (15 established host + 3 local host + 7 generated acceptance), 13.38 seconds at 2026-09-11 21:34:07 KST (tools 32efdd / 3b7ea5). This includes actual Node import compatibility of the compiled dependency graph and the delayed/persistent/cancelled guardian regressions; a redundant shared build was not run.

Local accounting is explicitly discriminated and accepts only its source/timestamp metadata after the host data snapshot. It requires each of four persisted local policies with exact reference digest/mode and exact producer/checker pair. Count must cover both stages; safe bounded counts/output sizes and policy-derived task/launch timeout caps are enforced. Policy snapshots and accounting are copied at assembly. Candidate observations remain fresh callbacks, with exact identity, boolean host checks, current qualification and native subject/evidence gates rechecked through the local engine/runtime. This is a protected function-bearing host API, not a descriptor-only renderer/settings parser; trusted host callbacks and cloning semantics remain part of its TCB.

Prepared local config contains only the local invocation budget fields and policy references, not fabricated currency, estimates, price, or billing. Local engine exposes the fixed-candidate observation/authorization/receipt surface, removes monetary reservation/mapping/final-billing hooks, and preserves captured execution receipts. The local fixture uses the actual shared ledger, output capture, cleanup observation persistence, driver and acceptance composition with synthetic executors/evidence. It records two committed dispatch intents, zero monetary reservations and a criteria acceptance receipt. This is not a live model qualification or an independent OS containment proof from those synthetic executor observations.

Existing strict JSON/depth/known output-size preflight and exact localhost read-only parent template remain in force before prepared persistence. Shared native producer/checker construction and runtime cleanup polling are retained: bounded residual-guardian reobservation with cancellation, execution ownership, persisted cleanup evidence, and no process-exit-to-acceptance shortcut. Failed/unknown cleanup does not become clean because local accounting is selected. The old monetary path's unknown final billing behavior and all four modes pass unchanged regression coverage.

Scope limits: local modes currently use the approved fixed pair, not quality/cost optimization; timeout caps are per-stage engine limits rather than a new total-goal wall-clock guarantee. Count semantics are committed dispatch intents, not actual provider requests. Actual configured local model runtime/bootstrap/UI checks and live paid or local-model canaries are separate work.

Current source hashes:
- app/generated-json-host.mjs SHA256 8A7EA3E9DC23C6DD2A64BBF51A1D08083AA292C5D5DBBA4AFA19C00C1796B080
- app/generated-json-host.d.mts SHA256 0B43C75DF442F0DE58486F6D3EFC2BDA00D64DBBAF5A7F75E334203395FD6CCC
- daemon/test/integration-generated-json-local-host.test.ts SHA256 9EEEB2D0669B80F5E9DB9C115527DBF1BAC7B576E2FE3CCED0960E0521C4D77E
- daemon/test/integration-generated-json-host.test.ts SHA256 E54102D6B73ACC7AA9535BA508A88836D36DBC90F8E6B289A7DB68FDC5CB52A2
- daemon/test/integration-generated-acceptance-host.test.ts SHA256 FB753ECE05F150AC1338F9448356FCD57BD2B7735CDA5D0860F754DB4C561230
