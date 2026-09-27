# Independent readonly terminal-wait review

Verdict: **PASS for production stop-status hardening**

The change introduces one shared `TerminateAndObserveProcess` helper and routes cancellation, command timeout, and parent death through it. The helper calls `TerminateJobObject` exactly once. If termination is refused, it throws immediately and does not wait. Otherwise it waits once for 5,000 ms and returns normally only for `WAIT_OBJECT_0`. `WAIT_TIMEOUT`, `WAIT_FAILED`, and every unexpected wait value throw distinct exceptions.

The executable offline test extracts the actual embedded C# from the production PowerShell launcher, compiles it through PowerShell `Add-Type`, and injects termination, wait, and last-error delegates. The five result cases confirm one termination call, at most one wait, and no normal completion for refusal, timeout, failed wait, or an unexpected value. A source assertion confirms all three production stop branches use the helper and that the prior ignored-wait timeout/cancellation form is absent.

The helper does not retry or duplicate termination. Codes 124 and 125 are returned only after the worker process handle signals. Parent death also requires the same observed signal before continuing to exit-code handling. Failures throw through the launcher; they cannot become successful worker results.

The outer `finally` still restores ACL/profile resources. Its cleanup frame states ACL/profile/root cleanup only; it does not claim process death. The coordinator separately requires verified process death before durable identity/cleanup authority, so a terminal-wait failure cannot create a valid final success receipt. The production bootstrap payload and invocation contract are unchanged.

## Independent gate

From `C:\Users\User\cue\daemon`:

```text
npm exec vitest run -- test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: exit 0; **1 file and 6 tests passed**. The maker's build passed, and independent hash comparison confirms source/dist launcher byte parity. I did not rerun the build or any historical/native gate and made no live worker, native API, WFP, model, or provider call.

## Frozen hashes

- `daemon/src/readonly-verifier-launch.ps1`: `2788DF21832E18822CE49348F0F1D2F454ADEFD61A78D579003C0835CE03FBC1`
- `daemon/dist/src/readonly-verifier-launch.ps1`: `2788DF21832E18822CE49348F0F1D2F454ADEFD61A78D579003C0835CE03FBC1`
- `daemon/test/integration-readonly-terminal-wait.test.ts`: `9B0926CB0AEB3CA018BE61C22F8E91E4A1B2223602E51BE8910EB9ECD4B41A97`

This proves deterministic stop-status handling in the injected harness. It is not evidence of actual OS process or whole-job death.
