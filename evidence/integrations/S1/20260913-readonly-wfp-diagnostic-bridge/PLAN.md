# WFP diagnostic bridge plan

## Completion contract

Done means the generated WFP launcher owns one invocation-local observation object from provider construction through `LaunchWithObservationLease` finalization, then emits at most one `CUE_READONLY_WFP=` nonce/root-bound diagnostic frame. Its exact JSON keys are `version`, `nonce`, `rootIdentity`, `state`, `overflow`, and `events`; version is `cue-readonly-wfp-diagnostic-v1`. Events use the agreed camelCase fields, preserve unsigned timestamp/filter ID as canonical decimal strings, cap decoded application ID at 4096 bytes, cap package SID at 184 characters, cap count at 64, and cap total UTF-8 JSON at 524288 bytes. Any invalid/unbounded event or oversized JSON becomes `unknown`, empty events; overflow forbids `captured`. No static/latest diagnostic state, native-query status invention, payload authority switch, denial conclusion, identity, qualification, or acceptance claim is introduced. The base launcher and its default null-provider route remain byte unchanged.

Correction cap: two total implementation corrections. Every pass runs the focused generator and adapter tests, exact generated C# compile, deterministic byte/hash checks, and scoped diff check. A failed pass requires a new measured hypothesis; after two corrections the unit stops for review.

Completion commands:

```text
cd daemon
npx vitest run test/integration-readonly-wfp-launcher-generation.test.ts test/integration-readonly-wfp-observation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npm run build
git diff --check -- daemon/scripts/build-readonly-wfp-launcher.mjs daemon/test/integration-readonly-wfp-launcher-generation.test.ts daemon/src/readonly-wfp-observation.cs daemon/test/integration-readonly-wfp-observation.test.ts evidence/integrations/S1/20260913-readonly-wfp-diagnostic-bridge
```

## Design

1. Add an adapter-owned invocation object. Its constructor snapshots the fixed request and exposes the existing `CueObservationLeaseProvider`; the provider records exactly one lease created for the launcher's exact process/job handles. Duplicate provider invocation becomes unknown/fail-closed. The object is local to one generated `LaunchWithWfpObservation` call and is never stored statically.
2. After `LaunchWithObservationLease` returns or throws, the generated public entry reaches one `finally`. Only there it asks the invocation object for a deep-copied diagnostic snapshot. Thus the snapshot follows the launcher's lease finalization on success and failure. If no lease exists, finalization is incomplete, or snapshotting fails, it emits `unknown` with no events.
3. Pass the already validated parent payload nonce and host-held `$heldIdentity` into the narrow generated entry. The entry accepts no diagnostic state or authority boolean from the payload. It serializes one bounded frame with the exact shared schema. Nonce must be 64 lowercase hex; root identity is nonempty and at most 256 characters.
4. Frame writing is best effort inside its own catch. Write failure cannot replace the launch result, suppress the original exception, or change cleanup. A one-shot local guard prevents a second frame if snapshot/serialization/output paths throw.
5. Keep `readonly-verifier-launch.ps1`, the collector, worker parser, control schema, and default launch route unchanged. This unit does not select or execute the generated variant. A separate trusted worker parser/persistence unit must authenticate the frame against the invocation nonce and selected control digest before any durable use.

## Required focused evidence

- Actual adapter invocation object: one provider/lease, duplicate/absent lease unknown, deep-copy isolation, captured and overflow serialization bounds.
- Generated entry success and throwing launch paths both execute final snapshot after the stubbed launch finalizer and emit exactly one matching-nonce frame.
- Snapshot/serialization/output exceptions preserve the pending return or original throw and never emit a second frame.
- Decimal-string precision for `ulong.MaxValue`, base64 cap, 64-event cap, malformed/oversized callback data becomes unknown.
- Generated PowerShell outside embedded C# differs from the base only at the existing WFP route; default launcher hash is unchanged.
- Deterministic generation, dependency mutation, anchor refusal, exact generated C# compile, and packaged byte parity remain green.

No real PowerShell wrapper, AppContainer, WFP API, worker, network connection, model/provider, policy, elevation, or historical gate is run in this unit.
