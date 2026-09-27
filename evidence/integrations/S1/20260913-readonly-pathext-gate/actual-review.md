# Independent PATHEXT gate actual review

## Verdict

**FAILED and closed; the worker process was created but the permission scenario did not run.** The one authorized attempt is consumed and no retry is authorized. The launcher reported PID `37904`, creation FILETIME `134337307186190988`, and exit `-1073741502`; the host reported the same unsigned status `3221225794` (`0xC0000142`). There is no worker result, and none of the project read/write, runtime write, sibling, or loopback assertions executed to an observable result. Those permissions remain unproven.

The retained evidence does prove a narrower native lifecycle: ACL preflight succeeded, a worker PID was created, the launcher returned a nonce-bound nonzero exit, exactly one nonce-bound cleanup frame was emitted, root identity and SDDL were restored, the named profile was absent, and the worker PID was subsequently verified dead. No model, provider, external network, coordinator, durable identity store, or acceptance path ran.

## Frozen evidence

- Manifest: `7C453E3C739B56721F4AF4ED9B6CC895AE6289DF01836AA934CD06F54041074A`
- Intent: `AADC687E7F28DF35301B91520D18C976E6C492ABE29158AEA02F6B7E81DD84BD`
- Result: `D9A925D7F426E5CBCD0E8A3BF73D63BFB5EB58D18BF5346F950F2A7330FCEB9`
- Runner: `B06A08AAF302CC9B63C6AE5F5F261A07BD744D0F194819298B15C3D85F328F63`
- Test: `C79846773752AA67C6EF1DF39A6A22ED733B47D41D4E2D9593D97A4BD387ACFD`
- Unchanged production launcher: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`

The expected nonce is `58bf8bc2cb18bc4c4b2134449287bda6fb7014b96df1caacb458cb996810c28e`; it matches both the exit and cleanup frames. The expected command-line SHA-256 is `1616f2a2739bdf3200489071f65b8ae0676ef99ea1f7a9a0cfb345aeabdbdcc7`. Launcher stderr is empty. `acceptedConnections: 0` is retained, but it is not network-denial evidence because the worker produced no scenario result.

## Independent bounded post-state

The retained owned root is `D:\Temp\User\Cue.ReadonlyVerifier.PathextGate1`.

- Native root identity remains `f575486a9f486ade:710f000100009d010000000000000000`, matching the before/after result and cleanup frame.
- Current root SDDL exactly matches both retained preflight and post-launch SDDL.
- Exact profile `Cue.Verifier.11111111111111111111111111111111` has count `0`.
- PID `37904` is verified dead.
- `runtime` is empty and contains no `result.json`.
- `existing.txt`: 9 bytes, `aaa8d3c8d74ad3e8f6b1772aa9c7e0eaa528cb42fc93599ce2f125b00d4c424c`.
- `delete-me.txt`: 6 bytes, `6197595503f01ee2a34e403fe08d2e1d9d0c14cf1cdfc2b74739895dc9a15a04`.
- `rename-me.txt`: 6 bytes, `9e84869d369b2a5336f6aa599b6e91116cc3d761827ef5f4b90841b8848ec35e`.
- `sibling\secret.txt`: 6 bytes, `2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b`.

These observations establish unchanged fixture bytes, restored root ACL/identity, empty runtime, exact-profile absence, and worker death. They do not prove that the worker lacked project mutation, sibling, or network access because process initialization ended before the probe wrote its result.

## Exit-code limit

The retained numeric status is exact. Interpreting `0xC0000142` as a named Windows status can classify the failure family, but it does not by itself identify which DLL or initialization step failed. No loader trace or worker stderr exists. Any deeper causal claim requires separate official-code lookup or a new bounded diagnostic contract; neither authorizes another boundary run.

This experiment grants no production registration, code acceptance, P13, entitlement, or public qualification.
