# Native existing-file runtime independent review

Date: 2026-09-16 (Asia/Seoul)  
Reviewer: `provider_installation72`, independent of maker `native_verifier75`

## Initial verdict

**NOT CLEAR — invalid authority can start a controller before refusal, and non-write calls can enter the generic worker path**

The first frozen source pass was reviewed read-only. No provider/model/network call, shared build, or production edit was performed by this reviewer.

### Stop-ship findings

1. `launchHostCodexRun` spawned and registered the controller before it queried `attempt_staging_authority` or validated `approvedExistingTargets`. A missing or mismatched staging row, hostile target accessor/proxy, malformed target, or duplicate target could therefore throw after process/session creation outside the asynchronous teardown path. Refusal must occur before directory creation, executable resolution, spawn, session insertion, or any other runtime mutation.

2. The approved existing-file runner intercepted `write_text` but passed every other parsed `cue_workspace` operation to `executeWorker`. This mode has exact `file_change` authority and must reject status/generic-command attempts inside the host with zero worker launch. It cannot rely on downstream worker-envelope refusal as the authority boundary.

Required correction evidence includes real top-level launcher fixtures showing invalid authority/target input creates zero controller or worker sessions; non-write calls fail with zero workers; and unapproved, missing/new-file, changed/contended, or unknown native snapshots never write. The positive case must still use the exact ledger-bound staging root, host-native snapshot plus compare-and-swap, report only approved changed paths, complete the runtime lifecycle, and preserve verifier/default-mode regressions.

This initial failure is retained even if a later correction passes. It makes no claim about provider qualification or the broader native workflow.

---

## Correction re-review

Final verdict: **CLEAR for the bounded native replacement of approved existing files**

The initial findings above remain preserved. The frozen correction validates a descriptor-safe dense target array and the exact durable staging authority before controller-directory creation, executable resolution, process launch, or session mutation. Proxy arrays and accessor targets are refused with zero traps/getters, ledger queries, or controller filesystem creation. The execution envelope must contain exactly `file_change` with empty egress, and the ledger row must bind the attempt, execution path, and native root identity.

The approved mode now rejects every non-`write_text` tool call in process. It never falls through to the generic worker launcher. Approved writes use host-owned `snapshotRelativeNative` preimages and `compareWriteExistingNative` identity plus content compare-and-swap against the exact ledger-bound staging root. The runtime has no command permission and no create fallback.

The real top-level launcher fixtures prove:

- an approved existing target changes through native CAS, returns the approved changed path, completes successfully, and creates only the controller session with zero workers;
- a generic command, an unapproved path, a raced/contended preimage, and an absent/new-file target each produce zero successful tool calls and zero workers, preserve any independently changed bytes, and never create an unauthorized file;
- broader action authority and hostile target descriptors refuse before controller launch or state mutation.

The native implementation host binds workflow targets into the implementation candidate's runtime options while staging the implementation task with `file_change` and empty egress. The verifier remains a distinct read-only candidate with empty action and egress authority. Existing default workspace behavior, controller enforcement, activity observation, and read-only verifier behavior passed the separate regression gate.

Reviewed final SHA-256 identities:

- `daemon/src/host-codex-controller.ts`: `E14BEB1E0C0DD70E853C40FCB8ABDEB62BBF7781C5640DBDEC70E018278DA29D`
- `daemon/src/host-codex-runtime.ts`: `1E06C7FCD370610F70AF6748D002E94010164A54AAAE944F53C7970FB005077A`
- `daemon/src/adapters/integration-executors.ts`: `0F5B3B77FF28F957C68B43D4EFE76A34810482D3EA0D7580FE3038EB06E33AB6`
- `app/native-implementation-host.mjs`: `5D10AEFEC0DB3F73812A821CA945D7C3AC9FAE5A859BD01C3A6305C2C24FD45A`
- `app/native-implementation-host.d.mts`: `93F8D4F23FBC268CD50ED5F2E21190254D0ACC0C53A18F2706FF6A50CB8F7C37`
- `daemon/test/integration-native-existing-file-runtime.test.ts`: `51BA37CC45617CBA0B6272A0CFC75B93773FB11685BF36F2C691ECD94B38B540`
- Maker `RESULTS.md`: `C59956069D6F3FDE67776CF56322F8369449C3D7FBDCE79E73D66C2C548DA1C9`

Durable evidence records the coordinated build and TypeScript no-emit passing, the focused native gate passing **12/12 tests in 3 files**, and the existing controller/runtime regression passing **28/28 tests in 3 files**, all at exit 0. The reviewer did not run a provider, model, network call, shared build, or production mutation.

This verdict covers replacement of explicitly approved existing files in an attempt-owned staging root. It does not authorize arbitrary commands, new-file creation, direct writes to the approved publication root, provider qualification, final publication, or the broader native workflow.
