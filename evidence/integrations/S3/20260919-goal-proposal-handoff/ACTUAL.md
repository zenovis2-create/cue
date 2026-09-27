# Goal proposal handoff result

Status: bounded offline handoff implemented. Public `Core.prepareGoalFromProposal` resolves a completed, content-addressed declarative proposal through a protected runtime callback. The driver validates its plan under the selected policy, requirements against host-registered checkers, and target scope; stores the exact proposal in the preapproval transaction; and checks its bound bytes, goal, plan revision/digest, and requirements binding again at approval and execution. The selected per-task instruction is read from the bound artifact at candidate dispatch and placed on `goalTaskInstruction`. Existing `prepareGoal` and native fixed host remain opt-out.

Gate: `daemon` cwd, `npx vitest run test/integration-goal-proposal-handoff.test.ts test/integration-native-implementation-host.test.ts test/integration-acceptance.test.ts --reporter=dot --no-color`; 3 files, 30 tests passed before the final unknown-checker assertion. Exact output: `FOCUSED-GATE.log`. A dedicated rerun after that assertion passed 2/2. The independent reviewer also ran the final three-file gate after the unknown-checker assertion: 30/30 passed, exit 0, recorded in `REVIEW.md`. Root-owned final type build after the optional RuntimeContext declaration passed, exit 0, at `../../planning/20260919-progress-reconcile-83/build-typed-final.log`; the declaration edit does not change emitted runtime behavior. Dedicated tests cover distinct goal digests, wrong-goal swap, duplicate/missing/accessor instructions, unknown host checker rejection with transaction rollback, Core plan consumption, pre/post-approval proposal artifact mutation rejection before launch, and exact selected instruction arriving at an offline candidate launch callback.

Fixture boundary: deterministic synthetic capability probes permit admission, a real local Git staging fixture reaches dispatch, and a fixture staged registration permits the candidate callback to run. The callback intentionally throws before creating a provider process. The test asserts `core.close()` refuses with `orchestration_cleanup_unverified` and the durable attempt remains unresolved. This is a dispatch handoff proof, not a completed execution or live qualification. No model, provider, Qwen, network, or paid call was made. The first wrong-cwd gate failed to locate daemon migrations; rerunning from `daemon` passed baseline tests. Initial fixture lacked capability probe evidence and did not reach launch; the final fixture supplies deterministic synthetic probe evidence. No successful cleanup or acceptance receipt is fabricated.

Remaining work: an approved bounded planning producer/UI must create these trusted proposal artifacts for arbitrary goals; a native host must consume per-task instructions with its own authority and independent live acceptance. Host checker registry and semantic acceptance remain trusted inputs. This slice does not claim arbitrary native task completion.

Source SHA-256 at freeze:

| Path | SHA-256 |
| --- | --- |
| `app/core.mjs` | `b232a43204f43399a6d8c7e58d316187cd36be1f2992ed10574a3264467fc626` |
| `app/core.d.mts` | `e03672da9c5acf597b7ee7d7b9c82e48c6bc61accf0f6ab63db9a75648584e3a` |
| `app/orchestration-driver.mjs` | `2fdfdfe5c2337fa5c24c398d4d6277020f5a8f60f836bb43da9c1e96447de78a` |
| `app/orchestration-driver.d.mts` | `7428a1a7aeb887185d5283048bb024463b7dbae7af1808c91af79dc973975658` |
| `app/goal-proposal.mjs` | `1b63038831dcd4d664a1bbcc609599df9af57df48a77d7d5e81893fcb8953d5f` |
| `app/goal-proposal.d.mts` | `4f003146f6d3e5528cfc0a28fc7a07cfe3867ffece2864354b00bea6defa8679` |
| `daemon/test/integration-goal-proposal-handoff.test.ts` | `134e056ccd7bbf21f73b95ca4cc6270bfa31c596019a39b92733a930c08afa5b` |
| `daemon/src/integration-runtime.ts` | `22768f8a022df531a765ef5278c94dbd09975eb875fa2bac721f5956cf969f7f` |
