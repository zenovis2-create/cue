# Independent goal proposal handoff review

Read-only review of frozen source and a separate focused test run. No source edits, build, provider calls, model calls, or service calls by this reviewer.

**Verdict: bounded handoff passes.** `Core.prepareGoalFromProposal` is explicit and resolves a strict content-addressed declarative proposal through protected runtime input. The proposal captures the exact goal digest, plan, requirements, change targets, and one instruction per task; accessors, missing/duplicate instructions, and a proposal for a different goal are refused. The driver uses proposal plan/requirements/targets rather than host.prepare alternatives on this opt-in path, validates the plan against policy-approved candidates/scopes, rejects untrusted checker arrays, and requires the host's registered checker resolver and acceptance host. Existing `prepareGoal` and the default native host remain opt-out.

The proposal bytes are persisted with the run/task before approval. Approval shows the proposal reference and instruction/criteria counts. `approve` and `execute` re-read the bound artifact; changed bytes are rejected before an approval event or launch. At dispatch, the driver re-reads the selected task instruction from the persisted proposal and passes its run ID, plan digest, task ID, proposal ref, and text to the candidate launch context. The focused fixture proves that the exact approved implementation instruction reached dispatch. It deliberately throws before a provider exists; the attempt stays unresolved and `core.close()` refuses cleanup. This is dispatch evidence, not successful execution, acceptance, billing, or a live planner.

The maker's focused gate in `FOCUSED-GATE.log` passed 30/30. I independently ran `npx vitest run test/integration-goal-proposal-handoff.test.ts test/integration-native-implementation-host.test.ts test/integration-acceptance.test.ts --reporter=verbose --no-file-parallelism` from `daemon/`: 30/30 passed, exit 0 after the final unknown-checker assertion (14.5s wall clock). The proposal test uses real Core, SQLite, Git staging, and synthetic offline capability/host fixtures. It proves preapproval and postapproval artifact mutation refusal, separate goal digests, unknown checker rejection with transactional rollback and no new run, approval visibility, exact dispatch instruction, and unresolved cleanup after intentional offline launch failure. It does not execute a real provider or prove semantic correctness of a proposal's content. The protected resolver is supplied by the application; this change does not implement autonomous planning.

Frozen SHA-256 pins:

| File | SHA-256 |
|---|---|
| `app/goal-proposal.mjs` | `1b63038831dcd4d664a1bbcc609599df9af57df48a77d7d5e81893fcb8953d5f` |
| `app/goal-proposal.d.mts` | `4f003146f6d3e5528cfc0a28fc7a07cfe3867ffece2864354b00bea6defa8679` |
| `app/core.mjs` | `b232a43204f43399a6d8c7e58d316187cd36be1f2992ed10574a3264467fc626` |
| `app/core.d.mts` | `e03672da9c5acf597b7ee7d7b9c82e48c6bc61accf0f6ab63db9a75648584e3a` |
| `app/orchestration-driver.mjs` | `2fdfdfe5c2337fa5c24c398d4d6277020f5a8f60f836bb43da9c1e96447de78a` |
| `app/orchestration-driver.d.mts` | `7428a1a7aeb887185d5283048bb024463b7dbae7af1808c91af79dc973975658` |
| `daemon/test/integration-goal-proposal-handoff.test.ts` | `134e056ccd7bbf21f73b95ca4cc6270bfa31c596019a39b92733a930c08afa5b` |

Final typed-consumer check: `daemon/src/integration-runtime.ts` adds only the optional readonly `RuntimeContext.goalTaskInstruction` declaration (`runId`, `planDigest`, `taskId`, `proposalRef`, `text`) compared with captured preimage; no runtime statement changed. Its SHA-256 is `22768f8a022df531a765ef5278c94dbd09975eb875fa2bac721f5956cf969f7f`. Root's coordinated `build-typed-final.log` exited 0 after this declaration. The preceding independent 30/30 behavioral gate remains applicable; it was not repeated for this type-only addition.
