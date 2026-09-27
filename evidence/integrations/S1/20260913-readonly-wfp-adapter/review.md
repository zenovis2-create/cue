# Independent review — native WFP observation lease adapter

## Verdict

**PASS for the concrete, inactive adapter and its offline executable seam after sticky-quarantine correction.** The adapter constructs the real `NativeWfp` implementation and the launcher's zero-time process wait, but the default launcher still passes a null provider. No live WFP query/subscription, AppContainer worker, network operation, model, provider, policy change, or historical gate ran. This is not runtime network-denial proof.

The first frozen candidate allowed a repeated `Dispose()` call to retry native operations after unsubscribe, free, or close failure had quarantined the same instance. Its initial PASS was withdrawn. The corrected `Dispose()` rejects an already quarantined lease before any native call, and the executable regressions prove repeated disposal adds zero unsubscribe, free, or close calls.

## Frozen inputs

- `scripts/reuse/native/readonly-wfp-collector.cs`: `5871FB8684AA3D8C2B6D635E3C31B6FD5A9FE45E18CDD9D7A1164C106C9CCB4F`
- `daemon/src/readonly-wfp-observation.cs`: `9C00E6A55D93BCC43CFBCA33CA2DBC305CF3BB72734E8A24469EF3154D882F60`
- `daemon/src/readonly-verifier-launch.ps1`: `6060955CD91AFB9D0470697C1B8945A75850AFD3A0307CF60AC0063C271A48FF`
- `daemon/test/integration-readonly-wfp-observation.test.ts`: `46E72B426F5D78AB25765524B5842F538310A7562B32BB1D4F23FFB2A1043C42`
- `DONE-CONTRACT.md`: `AD309A57A2FBDFCB0D7740196790F8E27D1D91E02BA288FFB92F2D5E29BC49B3`
- `implementation.md`: `A86BFDC16AFD68524E20189C6D0EC899491BF44A61D224C86ECDC280B8F2C317`

The maker reported build exit 0, scoped diff check exit 0, and source/dist parity for the launcher, collector asset, and adapter asset. I independently confirmed the adapter source/dist byte comparison was empty before the final gate.

## Independent gates

I ran the frozen focused suites once:

```text
cd daemon
npm exec vitest run -- test/integration-readonly-wfp-observation.test.ts test/integration-readonly-observation-lease.test.ts test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1

cd ..
node --test --test-reporter=spec scripts/reuse/readonly-wfp-collector.test.mjs
```

Results: **3 daemon files and 32 tests passed**; **17/17 collector tests passed**. These tests compile the actual embedded launcher C#, collector, `NativeWfp`, adapter, factory, and injected native/wait harness. The concrete factory is constructed inertly and does not call a native API until `Ready`.

After the sticky-quarantine correction, I independently reran the final adapter file: **17/17 passed**. The earlier combined and collector gates remain recorded as pre-correction regression evidence; the adapter-only rerun directly covers the changed source and repeated-disposal cases.

## Findings

The factory snapshots the request before it returns its process/job provider. The lease then captures the exact nonzero process and job handles before any fallible WFP work. `Ready` uses the shared validator and shared native-lifetime guard before calling open, collection-state query, exact executable app-ID lookup, and subscription. Invalid, denied, disabled, and ordinary failed readiness performs zero resume calls. A nonzero subscription handle paired with failure is ambiguous and poisons/quarantines the entire native lifetime.

The actual adapter and collector share one process-wide guard. The executable cross-path test proves a collector cannot open while an adapter subscription is active and can open after safe adapter disposal. A poisoned path prevents reuse. The adapter keeps its native facade, engine, app-ID allocation, subscription, callback root, request, process/job handles, and captured events owned for the lease lifetime.

`ObserveProcessDeath` rejects a foreign handle before invoking the wait delegate. The production factory binds `CueAppContainer.ObserveProcessDeathNow`, whose zero-time `WaitForSingleObject` result is accepted only when it equals `WAIT_OBJECT_0`. Timeout, failure, unexpected return, or exception remains unverified. Unknown death retains the subscription and skips unsubscribe/free/close.

After verified death, disposal calls unsubscribe before freeing the app ID and closing the engine. It holds no event-buffer or shared-guard lock during unsubscribe, which avoids blocking a completing callback that needs the event lock. Nonzero or throwing unsubscribe/free/close poisons and quarantines the owned state and cannot produce success. Quarantine is sticky on the same instance, so repeated disposal performs no further native operation. Callback rooting is checked across forced GC at unsubscribe.

The adapter exposes a separate diagnostic DTO rather than reusing `WfpResult` with false unattempted codes. It copies at most 64 events, clones application-ID bytes on capture and every read, and returns independent event objects. Null callbacks and overflow set loss and keep diagnostic state unknown. Refused readiness cannot become captured; capture completes only after a successful subscription, verified death, unsubscribe, free, and close.

The production factory creates `NativeWfp` and the exact launcher wait without performing acquisition in its constructor. The injected overload is confined to the executable test seam. The default PowerShell launch remains null-provider and the payload contains no WFP, observation, or lease authority field.

## Remaining boundary

The adapter is packaged production code but is not activated by the launcher or protected host. A later unit must decide when collection is available, install this provider internally, retain and persist its bounded diagnostic readout with exact attempt/session provenance, and keep unavailable or ambiguous collection fail-closed. Event capture is diagnostic only and does not by itself prove exhaustive external-effect denial, permission qualification, or acceptance.
