# Local JSON Electron gate v2 implementation receipt

Date: 2026-09-12

The v2 runner is a distinct frozen entry point. The historical v1 runner remains byte-identical at SHA-256 `AD2E76151122492AC8FF1765823B384E5D559306F1B4D06C44673530A9655848` and its failed evidence is unchanged.

V2 preserves one qualification process, one workflow process, at most two intended inference legs, no retry/resume, owned profile roots, current installation generation checks, strict ledger backup/reopen, and the production UI/IPC path. Its audit adds:

- exact requirement contract, target, observation, plan/policy and acceptance lineage;
- checker revision derived independently from the frozen installed checker-core bytes, with the protected qualification `production-pass` boundary required to report the same pin;
- evidence source revision derived from input SHA-256, target, producer task, measured checker revision and parameters digest;
- two durable native identities and exact six-field session agreement with the terminal cleanup observations and attempts;
- strict requirement, native identity, cleanup, generated-output and acceptance readers after close/reopen;
- honest counts: qualification artifact and workflow producer attempt are observed; provider HTTP request count remains `null`.

Offline gates only were executed:

- v2 contract: 8/8 PASS.
- v2 selected hostile auditor checks plus original `runs shared-ledger`: 4/4 PASS, 20 unrelated tests skipped by the name filter.
- generated-host original regression separately passed +- daemon build/TypeScript: exit 0.
- scoped diff check: exit 0.

No Electron, native helper, cleanup process, model request, checker execution, or inference was started.

## Zero-inference preflight

After independent review, this read-only command records the new script hash and current installation digest and performs only `GET /v1/models` against the fixed localhost endpoint:

```powershell
node --input-type=module -e "const g=await import('./scripts/reuse/local-json-electron-gate-v2.mjs'); console.log(JSON.stringify(await g.zeroInferencePreflight(),null,2))"
```

It reports `inferenceRequests:0` and `nativeProcesses:0`. It is not execution authority. Root must separately freeze the returned identities before any v2 execution.

## Frozen hashes

```text
E34418BA6397F2403540D1C291EB1A1A043EBA358F77EB6CB5E3F1F2A6B2241C  scripts/reuse/local-json-electron-gate-v2.mjs
BED50E0D5556EFF6901B81911015AC753D4A5D3A7F8B79B4198169C43AFBD25E  daemon/test/integration-local-json-electron-gate-v2.test.ts
```
