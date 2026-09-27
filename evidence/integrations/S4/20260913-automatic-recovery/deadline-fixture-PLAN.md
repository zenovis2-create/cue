# Deferred recovery deadline fixture plan

Done: the four-file integration gate exits 0 and the deferred-replan regression deterministically proves that resuming an exposed decision preserves the original monotonic deadline, aborts an entered acceptance capture after that deadline, and launches no work after expiry.

Attempt cap: two diagnosed correction passes for this fixture approach.

Every pass: run `npm exec vitest run -- test/integration-driver.test.ts test/integration-recovery-policy.test.ts test/integration-held-recovery-admission.test.ts test/integration-held-retry-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon` and record exit status/counts plus SHA-256 hashes of the owned test and evidence files.

Method: use scoped Vitest fake timers and a scoped spy on `node:perf_hooks` `performance.now`. First let automatic recovery persist and expose a deferred replan under a comfortably future original deadline. Resume that exact decision with an explicit plan, wait until the replacement flow reaches the fixture's hanging acceptance capture, then move host and monotonic clocks beyond the original deadline and run pending timers. Assert the capture signal aborts, the run records `orchestration_deadline`, finalization does not occur, and launch count stays fixed. Restore the capture and all timer/clock controls in `finally`.

On failure: diagnose the observed state and retry only with a new hypothesis. If both passes fail or a production defect is exposed, stop and report the exact state to the root owner; do not edit production source.
