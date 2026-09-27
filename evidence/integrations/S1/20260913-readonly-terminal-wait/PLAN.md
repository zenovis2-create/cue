# Read-only launcher terminal wait

## Done contract

- Focused command: `npm exec vitest run -- test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.
- Parity gate: `npm run build` followed by byte equality between `src/readonly-verifier-launch.ps1` and `dist/src/readonly-verifier-launch.ps1`.
- Attempt cap: 2 focused/build passes. Every pass executes the focused test; a retained change must pass it. Final pass also executes build and parity.
- Done means injected-delegate C# tests prove termination refusal, `WAIT_TIMEOUT`, `WAIT_FAILED`, unexpected waits, and `WAIT_OBJECT_0`; every case calls termination exactly once and wait at most once. Timeout, cancellation, and parent-death launcher branches use the same helper and return 124/125 only after observed process-handle signaling.
- A failure gets one new hypothesis and retry; a second failure is reported without broadening scope.

This unit does not run a worker or native WFP/provider API and does not claim whole-job death or identity qualification.
