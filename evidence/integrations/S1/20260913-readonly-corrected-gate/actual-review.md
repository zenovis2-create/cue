# Independent corrected-gate actual review

## Verdict

**FAILED, closed, and cleaned within the observed pre-launch scope.** The one authorized corrected-gate attempt exited `1`; its marker is consumed and no retry is authorized. The retained launcher observation has status `1`, no signal or spawn error, no PID frame, no exit frame, one cleanup frame, and `CantActivateDocumentInPipeline` naming `C:\WINDOWS\System32\icacls.exe`. The runner then attempted to read the absent worker result and persisted `ENOENT` as its top-level error while preserving the more useful launcher diagnostic.

Frozen source order places the launcher failure at the first worktree `icacls` invocation: the profile and held handles already exist, while `CueAppContainer.Launch` occurs only after both ACL grants succeed. Therefore the evidence supports zero AppContainer worker launches. This is source-and-receipt reasoning; there is no worker PID to observe directly.

No rerun, ACL mutation, cleanup action, profile creation/deletion, model, provider, external network operation, or unrelated profile inspection was performed by this review. The only post-failure operations were read-only inventory/hash, exact-root SDDL, exact profile-name absence, and native root-identity observations requested by the root task.

## Retained evidence

- Frozen manifest: `92F8D9994CA3E7E9A1700CF848C3DBCEF49968E973C8E0A4CC0D0030B92CB4D3`
- Intent marker: `DFCA06C39ED097211401614D68FC156B5FBB4060D80383C0FF3D2840E17F4D66`
- Failure result: `E5F353431A9EA39448DE6493D21645DDC6D15B7D32F84D690EF6D3C58BE74738`
- Executed runner: `2992ED7DD8182A62415F689E766FC5D06867383B9E81E7F4826920702A2F1B2A`
- Unchanged production launcher: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`

The ACL preflight observation succeeded with status `0`, empty stderr, and a nonempty SDDL. The launcher observation failed with status `1`, empty stdout except for its cleanup frame, and bounded stderr whose stable identifier is `CantActivateDocumentInPipeline`. The retained result contains neither `workerPid`, `cleanupFrameCount`, nor a parsed expected nonce because it followed the exception path. The cleanup line's nonce is therefore attributable to the frozen payload flow, but the retained receipt does not expose a second expected-nonce field for an independent value comparison.

## Bounded post-failure observations

The retained owned root remains at `D:\Temp\User\Cue.ReadonlyVerifier.CorrectedGate1`.

- Native root identity is `f575486a9f486ade:980b0001000046000000000000000000`, exactly matching the cleanup frame.
- Current root SDDL exactly matches the retained successful ACL-preflight SDDL.
- Exact profile `Cue.Verifier.11111111111111111111111111111111` has count `0`.
- `runtime` is empty. No worker `result.json`, created project path, or renamed path exists.
- `worktree\existing.txt`: 9 bytes, `aaa8d3c8d74ad3e8f6b1772aa9c7e0eaa528cb42fc93599ce2f125b00d4c424c`.
- `worktree\delete-me.txt`: 6 bytes, `6197595503f01ee2a34e403fe08d2e1d9d0c14cf1cdfc2b74739895dc9a15a04`.
- `worktree\rename-me.txt`: 6 bytes, `9e84869d369b2a5336f6aa599b6e91116cc3d761827ef5f4b90841b8848ec35e`.
- `sibling\secret.txt`: 6 bytes, `2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b`.

These values match the runner's fixed initial fixture contents. Together with exact root SDDL and identity, they establish no observed project-byte or root-ACL residue and absence of the named profile. They do not establish project RX, runtime M, sibling denial, loopback denial, worker process containment, or successful native cleanup after a worker because no worker launched.

## Diagnostic boundary

The source passes only `SystemRoot` and `WINDIR` to the outer PowerShell process. The launcher invokes the fully qualified `icacls.exe` through PowerShell's call operator. `PATHEXT` is absent from that host environment, so missing `PATHEXT` is a plausible explanation for PowerShell's application-activation error. The retained evidence did not vary `PATHEXT` or execute an isolated `icacls` comparison, so it does not establish that cause. No production or harness repair should be described as proven by this result alone.

Any future experiment requires a new bounded contract and independent preflight. This failed attempt grants no production registration, coordinator or durable-identity claim, code acceptance, P13, entitlement, or public qualification.
