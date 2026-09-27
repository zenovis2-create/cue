# Independent windowless-gate actual review

## Verdict

**FAILED and closed.** The single authorized windowless attempt is consumed; no retry is authorized. The worker was created as PID `48620` with creation FILETIME `134337317266244235`, then exited `-1073741502` / unsigned `3221225794` (`0xC0000142`). `observed` is null, so the permission scenario did not produce evidence. Adding `CREATE_NO_WINDOW` did not resolve the observed startup failure.

No causal DLL or initialization component is identified. The repeated numeric status describes the failure class only. Project RX, runtime M, project mutation denial, sibling denial, and loopback denial remain unproven.

## Frozen evidence

- Manifest: `08CDAF2598F08AF5811F18F8C823D384B8C4B9B8AD2DF263051B7B7D8A2CB577`
- Intent: `EE345C7C082C4D50799FAA3479C4ECCE421E83514C82799CCACA633886602FBF`
- Durable expected evidence: `52FD107F202C9E91B07D2835227603761A8237E76190532D426CF378561C68C7`
- Result: `C783546F33AAF02084D9849092F50A902C62F6D2EBA5B7460B3FD01A99EA8A0C`
- Runner: `DFC1A40B3824A4B271C80E3698F76DF86DCD479880C7FD841C93530598AB0012`
- Test: `F488C634FF318148140917DE4E8EFC5C9EA2F80AE442C8CD802854D0A8A414D9`
- Windowless launcher: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`

The expected record was durably written before launch. Its nonce `b7403441b2d2801fdc541f52a7278bf31c9587d80b9181352e859c1dac8f294f` exactly matches both retained launcher frames. Its command-line digest is `1616f2a2739bdf3200489071f65b8ae0676ef99ea1f7a9a0cfb345aeabdbdcc7`.

The launcher observation has no signal, spawn error, or stderr. It contains one PID frame, one nonce-bound nonzero exit frame, and one nonce-bound cleanup frame. The result records cleanup-frame count `1`, matching root identity, `aclRestored: true`, `profileCount: 0`, unchanged bytes, and zero accepted loopback connections. The zero connection count is not denial evidence because no worker result exists.

## Independent bounded post-state

The owned root remains at `D:\Temp\User\Cue.ReadonlyVerifier.WindowlessGate1`.

- Native root identity is `f575486a9f486ade:7b0f000100002d010000000000000000`, matching before, after, and cleanup observations.
- Current root SDDL exactly matches the retained preflight and post-launch SDDL.
- Exact profile `Cue.Verifier.11111111111111111111111111111111` has count `0`.
- PID `48620` is verified dead.
- `runtime` is empty and has no worker result.
- `existing.txt`: 9 bytes, `aaa8d3c8d74ad3e8f6b1772aa9c7e0eaa528cb42fc93599ce2f125b00d4c424c`.
- `delete-me.txt`: 6 bytes, `6197595503f01ee2a34e403fe08d2e1d9d0c14cf1cdfc2b74739895dc9a15a04`.
- `rename-me.txt`: 6 bytes, `9e84869d369b2a5336f6aa599b6e91116cc3d761827ef5f4b90841b8848ec35e`.
- `sibling\secret.txt`: 6 bytes, `2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b`.

These facts establish worker creation and death, exact root/ACL restoration, named-profile absence, empty runtime, and unchanged fixture bytes. They do not establish that the probe client initialized or executed any permission test.

No launcher, model, provider, acceptance, cleanup mutation, or retry was invoked by this review. The only additional operations were the specifically authorized read-only root identity, SDDL, exact-profile, process-death, runtime, and byte observations. This result grants no production registration, code acceptance, P13, entitlement, or public qualification.
