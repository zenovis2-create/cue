# Independent actual probe review

## Verdict

**BLOCKED.** The single authorized `attempt1` was consumed and failed with exit 1 before the AppContainer launcher boundary. No retry is authorized. Unit A retains its source and offline-test evidence, but it has no successful actual permission proof and must not be used to claim project RX, runtime M, sibling denial, loopback denial, ACL restoration, profile cleanup, or durable verifier identity in a real launch.

## Done contract and attempt cap

This review is complete when the retained marker/result, frozen runner inputs, owned-root inventory, and source call order are independently checked without launching PowerShell, the native helper, AppContainer, Node worker, model, provider, or cleanup action. The actual native attempt cap is one and is exhausted. Up to two read-only correction hypotheses may be recorded; neither authorizes another execution.

Every review pass reads the retained JSON, hashes its inputs, and inventories the owned root. A failure remains a failure and is reported to the root; it is never retried or relabeled PASS.

## Retained actual evidence

- Intent marker SHA-256: `485F2913D4A52FF00BDF100D95A138021EA54765AE714E9DE9B5F65A571D2C08`
- Failure result SHA-256: `0EB338E0A70D96724EB385C8BD5175A2D32DE8C545753E29B396994ADE643A39`
- Frozen manifest SHA-256: `2E120EFC324A20EB42642A641EB7862EE98CD5125FCDBC2078D2A0B61E283311`
- Runner SHA-256: `35AA35FD4BB15D93FA828EFA4E3ACCD2FFCCF69EBB936CEEA913AB04607A693B`
- Offline test SHA-256: `71D96C974F832FBD186B71B4483A771551809BC33ED20E7A0FB16F049598FDAC`
- Embedded client SHA-256: `530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587`
- Launcher SHA-256: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`

The marker records `startedAt: 2026-09-12T14:33:30.980Z`, `maxBoundaryLaunches: 1`, and zero model, provider, and external-network calls. The retained result records `passed: false`, `error: "acl preflight failed"`, and `diagnosticsRetained: true`.

The owned root `D:\Temp\User\Cue.ReadonlyVerifier.UnitA.Actual1` remains present. It contains the empty `runtime` directory, `sibling\secret.txt`, and the three unchanged initial worktree files (`existing.txt`, `delete-me.txt`, `rename-me.txt`). There is no worker-created result or mutation artifact in the inventory. This is consistent with failure before worker launch, but inventory alone is not process-execution proof.

## Call-order finding

The frozen runner verifies all five manifest pins before exclusively creating `intent.json`. It then creates the owned directories and fixture bytes, identifies the root, and invokes a host PowerShell ACL observation. The exact failing condition is `acl.status !== 0 || acl.stderr`; it throws `acl preflight failed` before creating the loopback server, building the launcher payload, or calling the second `runProcessSync` that executes the captured launcher bytes.

Because the executed runner hash equals the frozen manifest pin and the durable error names that exact throw site, frozen-source control flow supports **zero AppContainer boundary launches**. A host PowerShell ACL-observation process was attempted. The receipt did not retain its status, signal, error object, stdout, or stderr, so the cause cannot be distinguished offline. Plausible hypotheses are a nonzero PowerShell status or nonempty stderr despite otherwise usable stdout; neither is established.

No cleanup frame, worker PID, profile observation, post-root identity, or post-ACL observation exists because those fields are computed only after the launcher returns. Therefore no actual cleanup claim is available or required for an AppContainer process that source evidence says was never launched. The retained owned directories are diagnostic residue from the host-side preflight and must not be removed as part of this review.

## Scope that remains source-only

Focused source/offline tests cover control hashes, root-handle identity binding, RX/M ACL strings, zero capabilities, a one-process job, bounded output, abort/timeout handling, exact cleanup persistence schemas, runtime/worktree separation, and the probe's strict argv/error predicates. They do not substitute for an actual Windows permission result. The probe also directly targets the frozen launcher; it does not invoke `createReadonlyVerifierWorker`, ledger session attribution, or durable identity/cleanup stores.

Core/bootstrap, code acceptance, P13, entitlement, provider/model provenance, and ordinary writer behavior remain outside this unit. Unit A is not eligible for production registration on this evidence.
