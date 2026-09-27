# Read-only observation lease hook — implementation receipt

The launcher now has an internal optional observation-lease provider. `LaunchCore` acquires the lease after the suspended process is assigned to its single-process job and the parent handle is opened, then uses the lease owner's shared pre-resume method before `ResumeThread`. The default PowerShell invocation supplies `null`, so its payload and CLI contract remain unchanged.

The same owner retains the lease through terminal handling. It releases only after the launcher has observed exact process-handle death and the lease independently confirms that handle. Refusal, acquisition failure, resume failure, cancellation, timeout, parent death, and later errors terminate and observe the process before release. Failed termination, observer refusal/throw, or disposal failure uses a sticky quarantine state and retains the process/job handles. Repeated cleanup cannot convert quarantine into success. The corrected production finalizer throws over a pending successful worker return when observer death or disposal is unverified, while structural nested `try/finally` always runs independent cleanup exactly once. The default path tracks termination attempts separately so catch cleanup never repeats a failed terminal stop.

Verification:

- New executable injected test: 9/9 passed.
- New test plus existing terminal-wait regression: 15/15 passed.
- `npm run build`: exit 0.
- Source/dist launcher SHA-256 parity: `8F7FBCCA3FC96C53ED4585571FBBB89593A944AD8D5A9EF12D5068F4F6A0870C`.
- Offline boundary-probe regression: 11/11 passed.\r\n- Scoped `git diff --check`: exit 0.

Final source hashes:

- Launcher: `8F7FBCCA3FC96C53ED4585571FBBB89593A944AD8D5A9EF12D5068F4F6A0870C`
- Test: `1C67B140D7CC3C81F0D44BAA82A2B2904E98156C95A9DC15A9EE5EE3FDAF0936`
- Done contract: `9554612FBDBC9067DA03E7F74F2B628707F6F7EE86AB3C2D6869B04C929BD458`

The earlier independent PASS `60B38000...` was withdrawn after it exposed the pending-return fail-open defect. The final nested-cleanup correction independently passed; review SHA-256: `320B62E2A862D9BBAFCBE9EDDE9CFAC8C9DDFB9AD4B6CF43B062B5D33972F369`.

No concrete WFP provider is connected. A future provider must clean or quarantine partial native state if acquisition throws before returning its owned lease. This hook does not prove whole-job death, network denial, or qualification, and no live worker/WFP/model/provider operation ran.
