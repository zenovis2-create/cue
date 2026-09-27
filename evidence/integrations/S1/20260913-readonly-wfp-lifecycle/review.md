# Independent review — read-only WFP lifecycle seam

## Verdict

**PASS for the bounded offline seam.** This is not a production worker/WFP bridge and provides no OS-backed worker-death, network-denial, permission, or acceptance authority.

## Frozen inputs and independent gate

- `scripts/reuse/native/readonly-wfp-collector.cs`: `F4FDCE9EA7BBD4E3066BDF86E04217EDE55301B66CE6FDE763FEFAB95C22EAD7`
- `scripts/reuse/readonly-wfp-collector.test.mjs`: `C4AB681A8F454EEC0B6EB2BC7307D2665AA5AE073BB5C96192C65D0D13D8401C`
- `DONE-CONTRACT.md`: `B7356C304FF6D7830687918C1F39E20328A7D2D62F343CDE255B45EA2C410B26`

I independently ran the final frozen command once:

```text
node --check scripts/reuse/readonly-wfp-collector.test.mjs
node --test --test-reporter=spec scripts/reuse/readonly-wfp-collector.test.mjs
git diff --check -- scripts/reuse/native/readonly-wfp-collector.cs scripts/reuse/readonly-wfp-collector.test.mjs evidence/integrations/S1/20260913-readonly-wfp-lifecycle
```

Result: **17/17 passed**, syntax exit 0, diff check exit 0. The executable test compiles the actual collector C# together with injected native and lifecycle implementations. No WFP API, worker, network, model, provider, profile, or historical native gate ran.

## Findings

The seam subscribes before its sole lifecycle start call. Collection-disabled and subscription-failure cases make zero lifecycle start calls. A direct `Dead` observation can complete collection. A rejected start remains unknown but reaches the common successful unsubscribe/free/close path.

Ambiguous or throwing start, unknown or throwing death, and failed stop/death verification remain unknown and retain the subscription, engine, application ID allocation, callback root, native facade, and lifecycle object in the process-lifetime quarantine. They do not unsubscribe or free callback-owned state. Nonzero or throwing unsubscribe and close failures preserve the existing poison/quarantine behavior.

`Alive`, `Cancelled`, and explicit `Timeout` require `StopAndObserveDeath`. Even when that injected stop reports `Dead`, the collection result remains unknown; the event set is not promoted to captured. The tests also verify that unsubscribe has not occurred while death is being observed.

The original `Collect(WfpRequest, IWfpNative)` API remains available, and the wrapper/source ABI tests remain green. The lifecycle observations are injected enums. They are not authenticated process facts and must not be accepted from a caller as production authority.

## Required production bridge

The existing embedded launcher creates a suspended process, assigns it to the single-process kill-on-close job, then calls `ResumeThread`. A minimal future bridge can add an internal observation-lease hook after successful job assignment and before resume, behind an injected native facade. Hook refusal or failure must terminate the still-suspended job and prove `WAIT_OBJECT_0` on the exact process handle before releasing observation state. No CLI-exposed boolean should control this decision.

The observation lease must remain rooted until the exact worker handle is verified signaled on normal exit, cancellation, timeout, parent death, and every error path. Only then may it unsubscribe and release callback/native state. If death or unsubscribe cannot be verified, it must remain quarantined and the result must stay unknown.

The initial launcher inspected for this review did not check the timeout/cancellation `WaitForSingleObject` result. That defect was separately corrected and independently passed in `evidence/integrations/S1/20260913-readonly-terminal-wait/review.md`: the production helper now returns normally only for `WAIT_OBJECT_0` and rejects timeout, failure, and unexpected statuses. That separate injected test proves deterministic stop-status handling, not actual OS process or whole-job death. The observer lease bridge remains unimplemented, and offline fake lifecycle observations in this unit cannot substitute for OS-backed observation authority.

The retained availability query returned access denied, so collection state and subscription availability have not been established. This seam must remain disconnected from production resume. A bounded next unit can test the internal subscribe-before-resume observation hook and lease lifetime through an injected native facade without starting a child or enabling WFP. Actual WFP subscription wiring remains a later protected-host gate.
