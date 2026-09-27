# Pre-readiness created-process identity

## Done contract

- Focused command from `daemon`: `npm exec vitest run -- test/integration-readonly-created-identity.test.ts test/integration-readonly-observation-lease.test.ts test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Attempt cap: 2; every pass runs the exact focused command.
- Done means the embedded C# compiles and an injected lifecycle harness proves the exact PID/creation-time line is emitted and flushed before observation-provider refusal/throw, refusal performs termination and never resumes, and GetProcessTimes failure emits nothing while propagating through existing failure cleanup.
- A failure gets one new hypothesis and retry; a second failure is reported.

No native worker, WFP, provider, or OS process API is invoked by the test. This ordering exposes created-process identity for death checking and grants no resumed, dead, readiness, or acceptance authority.
