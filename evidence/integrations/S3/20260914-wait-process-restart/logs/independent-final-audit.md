# Independent final audit

## Pins and handoff

- Final test: `da86e5ced7ba7c51404eece51c208f166d64e0e73ade671f45ef8a20dc5553fe`
- Final child fixture: `3481da5c8817a13b66af693838dbc28b1c48f2bff934eaf305983f72842ea121`
- Unchanged production driver: `79d44e00ef70e9d28acfe54a71fbcee5ebc2bdd39198141d65bf35b511076cdf`
- Root repair preimages independently match their manifest: test `ace81ee99d2a052199e3e54794cc32a10eaee40278465f18329f445dbc418fe7` (4148 bytes), fixture `d76ea8d6c1d622908e71add99b1797cc3d7df0e03814c925d0a2bb3108392267` (10405 bytes).

## Process and claim evidence

- The test spawns two separate `process.execPath` children. It registers the second child's close promise before awaiting stdout, compares the two emitted PIDs as unequal, and requires the second exit code to be 0.
- The first child emits its attempt/identity/durable reference, enters the real public `deliverWaitResponse` callback, and appends one PID/identity marker after the durable dispatch claim. The parent verifies one claim and zero delivery observations, then terminates and awaits that exact owned child.
- The second child independently opens the same resolved SQLite path, invokes the public delivery method, and must return the same request/response/attempt/identity with `newlyClaimed:false` and `blocked-unresolved`.
- The second process separately reads the persisted attempt identity and proves its durable reference equals the first process value. It reports callback count 0, claim count 1, observation count 0. The marker remains exactly one line from the first PID, proving no resend.
- The fixture's protocol strings satisfy an existing public driver admission contract solely to reach the synthetic lifecycle seam. They do not constitute a real provider, model, native helper, Electron, or network qualification.

## Independent gate

One combined frozen execution only:

`npx vitest run test/integration-driver.test.ts test/integration-driver-real-restart.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Exit 0; 5/5 files and 79/79 tests passed. Complete output: `independent-combined-vitest.log`, SHA-256 `ba56296376da5acb2ebe1f942b5efe92d91018f0ed40b189c3210de4297a0946`.

Verdict: PASS for the exact synthetic post-effect/pre-acknowledgement crash and fresh-process SQLite reopen/no-resend claim.
