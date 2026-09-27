# Independent review — read-only observation lease hook

## Verdict

**PASS for the final bounded production hook and offline injected seam.** No concrete WFP provider is registered, and this review supplies no live worker, WFP, network, whole-job-death, permission, or acceptance proof.

The initial frozen implementation could execute `return exitCode` inside `LaunchCore` and then have `observation.Finish(...)` return false in `finally`. That version retained native handles but did not replace the pending return, so worker exit 0 could escape despite unverified lease death or disposal. The initial PASS was withdrawn and this counterexample remains recorded as the reason for correction.

A second/final correction (`readonly-verifier-launch.ps1` `FF363B8F45D59552A99BECE1BE19F6F7EC85034D9DF0CEF0DC21BCD59C73C21C`) fixed the pending-success escape and duplicate default-path termination, but its immediate rethrow inside `finally` skipped the independent cleanup below it. The original two-correction cap and both failures remain preserved. Root then authorized one distinct nested-cleanup hypothesis with a one-attempt cap. The final source routes observer finalization and independent cleanup through one shared nested `try/finally`: observer failure still overrides a pending return 0, cleanup runs exactly once, and only process/thread/job handles remain retained when quarantine requires them.

The DONE contract records that it was written immediately after the initial source insertion rather than before it. That process deviation remains visible and does not change the limited technical verdict.

## Frozen inputs

- `daemon/src/readonly-verifier-launch.ps1`: `8F7FBCCA3FC96C53ED4585571FBBB89593A944AD8D5A9EF12D5068F4F6A0870C`
- `daemon/test/integration-readonly-observation-lease.test.ts`: `1C67B140D7CC3C81F0D44BAA82A2B2904E98156C95A9DC15A9EE5EE3FDAF0936`
- `evidence/integrations/S1/20260913-readonly-observation-lease/DONE-CONTRACT.md`: `9554612FBDBC9067DA03E7F74F2B628707F6F7EE86AB3C2D6869B04C929BD458`
- `evidence/integrations/S1/20260913-readonly-observation-lease/NESTED-CLEANUP-CONTRACT.md`: `0969196E43E441C8742154F4613544E94A92FC8BD7B37714CB6DE5FED6B55EC6`

The source and built launcher bytes matched in the final workspace. The maker reported build exit 0 and diff check exit 0.

## Independent gate

From `daemon` I ran the final combined focused gate once:

```text
npm exec vitest run -- test/integration-readonly-observation-lease.test.ts test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: exit 0, **2 files and 15 tests passed**. I also independently ran `node --test scripts/reuse/readonly-verifier-boundary-probe.test.mjs`: **11/11 passed**. That boundary test performs local NUL-handle/GetHandleInformation checks and a benign argv child; it does not run an AppContainer, WFP/provider operation, or historical `--run` gate. The daemon test compiles and executes the actual embedded C# lease owner, finalization/cleanup helper, and terminal-wait helper with injected delegates. It does not invoke `Launch`, create its worker child, or call WFP. Placement inside `LaunchCore` is verified by direct source inspection and a bounded ordering assertion.

## Findings

`LaunchCore` preserves its original public/default overload with a null provider and accepts no payload or CLI observation flag. The internal provider is called only after successful suspended process creation, job assignment, and parent-handle opening, and before `ResumeThread`.

The shared production owner behaviorally enforces readiness before resume. A refused or throwing readiness check produces zero resume calls, terminates the suspended process/job through the injected exact-death action, and releases the lease only after its own exact process-handle death observation. Resume failure follows the same stop/death path.

Normal process signaling, cancellation, timeout, parent death, and unexpected wait handling set death observed only after the production wait logic establishes the exact process handle signal. The terminal-wait regression confirms that cancellation, timeout, and parent death return normally only for `WAIT_OBJECT_0`; refusal, timeout, failed wait, and unexpected wait values fail closed.

Unknown or throwing lease death observation, failed termination/death verification, and throwing lease disposal retain the lease plus process and job handles in the static quarantine. Once retained, repeated finish/release calls continue returning false and cannot later authorize cleanup. Successful disposal occurs only after verified death. The launcher's finally block skips process/thread/job handle closure when retention is required.

The production-shared nested finalizer test proves that false/throwing observer finalization overrides a pending successful worker return. Its cleanup sentinel runs exactly once on both success and failure. Source inspection confirms the independent cleanup closure still closes the parent and NUL handles and frees capabilities, environment, handle-list, and attribute-list allocations; quarantine selectively suppresses process/thread/job closure. The default null-provider fallback tracks whether termination was already attempted, preventing the general catch from repeating a failed timeout, cancellation, parent-death, or unexpected-wait stop.

Provider acquisition failure terminates and verifies the suspended process before launcher handle cleanup where that verification succeeds. If it fails, launcher handles remain retained. The launcher cannot retain native observer resources that a provider allocated and then hid by throwing before it returned a lease. A future WFP provider must therefore make acquisition exception-safe: it must clean or quarantine all partial allocation internally, or return an owned lease before fallible readiness work begins. The present hook does not prove that future provider contract.

## Remaining production boundary

No provider activates this internal hook, so ordinary production invocation remains unchanged and no subscribe-before-resume observation occurs today. A future protected adapter must bind the exact process/job handles, own partial WFP acquisition safely, keep the callback/native context alive through verified process death, and quarantine on unknown death or unsubscribe/dispose failure. Injected delegates and lease booleans are test observations only; they must not become caller-supplied authority.
