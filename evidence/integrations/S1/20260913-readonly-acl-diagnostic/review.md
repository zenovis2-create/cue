# Independent ACL diagnostic review

## Verdict

**PASS for the new host-only reproduction and classifier; wording correction required for historical attribution.** The retained diagnostic establishes that its own PowerShell invocation failed with status `1`, empty stdout, and `CouldNotAutoloadMatchingModule` for `Microsoft.PowerShell.Security`. It does not prove that the earlier Unit A probe failed for the same reason because that probe retained no raw ACL subprocess fields. The two invocations have the same executable and command shape, so the new result is a strong repair hypothesis, not historical proof.

No AppContainer boundary, ACL mutation, native helper, network endpoint, model, or provider was invoked by this independent review. The consumed Unit A attempt remains closed.

## Evidence audit

- Diagnostic source: `66AF07A3C901D9389818C006B19CD711DFF41EE6648E0A95F1554E72E8E7BC10`
- Offline test: `DD4E10AD500683AB9F67DAABF61AC48E6E79DC9D1138E9D205A8C240C19E7DFF`
- Intent: `22E9B84A7D178A65079FF0F501CDE6317B258393725CD5D035E625BD3CA1DA11`
- Raw result: `8A94D7F2B698AFAD21976061C8F9CF8E28E4E833DA2C2167145E9FF223C17D56`
- Maker result: `4C57C47203744F66AF16DED7FB5C8B17A6B18F669BD05427E5D778C30699D73B`

The intent bounds the diagnostic to one owned fixture, one attempt, zero ACL mutations, zero AppContainer launches, zero native-helper calls, zero network calls, and zero model/provider calls. The source performs only directory creation and the single `runProcessSync` ACL observation when invoked with `--run`. The raw receipt matches that contract and contains the exact executable, argv, timeout, output bound, status, signal, structured error, stdout, and stderr. It inherits the diagnostic parent's environment, as did the frozen probe preflight; it does not reproduce the production worker's sanitized `SystemRoot`/`WINDIR`-only environment.

The classifier is deterministic and fail closed. Its tests execute normal output, spawn error, termination signal, nonzero status, stderr with status zero, empty output, newline/NUL/missing-prefix malformed values, and a valid trimmed value. Independent command:

`node --test scripts/reuse/readonly-acl-diagnostic.test.mjs`

Result: **3/3 passed**. The SDDL check is intentionally only a diagnostic shape check; it is not a security-descriptor parser and must not become acceptance authority.

## Production impact and bounded repair

The production boundary depends on the same module-backed commands in two places:

1. `readonly-verifier-worker.ts` calls `Get-Acl` before creating its runtime and launcher process.
2. `readonly-verifier-launch.ps1` calls `Get-Acl` before grant, then `Get-Acl` and `Set-Acl` during restoration and final comparison.

These are genuine module-backed dependencies, but the new reproduction does not establish their production behavior. The production worker's ACL observation passes only `SystemRoot` and `WINDIR`, and its launcher wrapper is also spawned with that bounded environment. The diagnostic inherited its parent environment. Production could therefore fail differently, or module discovery could behave differently. Fixing only the diagnostic would prove nothing about production; replacing only the worker call would still leave the launcher's capture and restoration dependent on `Get-Acl`/`Set-Acl`.

If production-targeted offline tests establish the same dependency, preferred bounded repair ownership is the worker/launcher ACL primitive only. Extend the launcher's existing held-directory Win32 implementation to capture and restore the security descriptor through that exact handle. The handle must be opened with the access rights required to read and restore owner/group/DACL information, the captured descriptor must be copied into host-owned memory, and final observation must use the same handle and compare the intended security components after restoration. All error paths must retain the root handle until restoration finishes and emit no clean receipt if capture, grant, restore, or comparison is uncertain. Existing `icacls` grant/removal can remain only if the final handle-based restoration overwrites the temporary change and is independently verified. Tests must cover capture failure, grant failure, restore failure, descriptor drift, root replacement, and cleanup-frame suppression. This repair must not broaden worker write permissions or alter the ordinary writer boundary. This is a design recommendation, not evidence that a native rewrite is presently necessary.

A smaller alternative is an explicit import of `Microsoft.PowerShell.Security` from a fixed system module path before every `Get-Acl`/`Set-Acl`. That alternative needs a protected-installation pin for the complete loaded module closure, a controlled environment that does not rely on ambient `PSModulePath`, and an offline failure test for missing/hash-drifted modules. The current diagnostic did not test explicit import, so it provides no evidence that this alternative works.

Any future actual boundary attempt needs a new done contract and independent preflight. Neither this diagnostic nor a source repair authorizes a retry.

## Sanitized-environment comparison

The retained comparison is **PASS within its host-only scope**. Its one consumed call supplied an environment object with exactly `SystemRoot` and `WINDIR`, both derived from the same system root. It used the same Windows PowerShell executable and `Get-Acl` command shape as the first diagnostic against a new owned fixture. The raw result records status `0`, no signal, no spawn error, empty stderr, 983 bytes of stdout, and `valid-sddl`.

Frozen comparison hashes:

- Done contract: `7878ED45B5C7B67A427DDF3C0D4EA81751C32ED177127ADA4C19FC21A0635955`
- Script: `A776028F8DAE4CB13FD0BED316F7E4731203696A36A68B237B179141CF7BAC7E`
- Intent: `A91E7A6A71E5A79C2F3620D8850C7C77BD53FC4896D8CE933E8223B80B811B83`
- Raw result: `962FA2BB08D80088ED965C7AAE667CA03D1E32642DB5F57473467A645DE57F68`
- Comparison result narrative: `447AF22C6C00D0C9C5829C26476E3E3AF4F79467C450C6F10395BB5292DB1186`
- Corrected initial narrative: `A459069439D8256ADCB3E7E7B10550CE677D1901FFDB77EA6C7430A976B10615`

The comparison shows that `Get-Acl` works in the two-key environment used by the production ACL observation on this machine. Together with the inherited-environment failure, it supports aligning any future diagnostic harness with the production environment and retaining raw subprocess fields. It removes the present evidence basis for a Win32 ACL rewrite or explicit module import solely because of the inherited-environment result.

It still does not establish the exact cause of the historical probe failure: that receipt lacks its ACL subprocess fields. It also does not exercise the launcher's later `Get-Acl`/`Set-Acl` operations, AppContainer permissions, ACL mutation/restoration, native cleanup, durable identity, or public qualification. No additional PowerShell or native call was made during this independent comparison review.
