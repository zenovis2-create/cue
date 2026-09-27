# Pre-readiness created-process identity result

Status: focused maker PASS after independent-review correction. Shared build is deferred to the root after concurrent source makers freeze.

- Final focused command: `npm exec vitest run -- test/integration-readonly-created-identity.test.ts test/integration-readonly-observation-lease.test.ts test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
- Result: exit 0; 3 files and 17 tests passed on pass 2 of 2.
- Pass 1 ran 2 files and 8 passing tests because the plan used the wrong observation-lease filename; the new harness passed, but that was not treated as the final gate.
- Review-correction gate: the same 3 files and 17 tests passed after replacing the manually sequenced harness with the internal production continuation seam.
- Launcher SHA-256: `9181e9d20c4137fb7472fac8d0fef1c43583df0e5ad71fb3fdbd593f496fb3c9`
- New test SHA-256: `e6c8190d6bf8d46ee196475355316e38835b99ee2926ddae2de8488c8aeff25b`

The existing GetProcessTimes/PID line/flush operation now occurs through an internal continuation seam immediately after successful job assignment. The same production seam encloses parent opening, observation-provider acquisition, and resume. The executable injected harness proves the exact line and flush precede the continuation and provider refusal, refusal terminates without resume, and GetProcessTimes failure skips the continuation and propagates through the harness finally. Existing observation lease and terminal-wait regressions remain green. The unchanged outer `LaunchCore` finally is visible by structural source inspection, but this harness does not runtime-prove execution of that exact finally block.

This supplies created-process identity for subsequent exact death checks. It does not claim provider readiness, resume, process death, identity authority, or acceptance. No native process, WFP, or provider API was invoked.
