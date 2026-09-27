# Sanitized environment comparison result

## Verdict

**PASS for the bounded comparison.** The one authorized host call supplied exactly `SystemRoot` and `WINDIR`. The same Windows PowerShell executable, `Get-Acl` argv shape, timeout, encoding, and 65,536-byte bound returned status `0`, no signal or spawn error, empty stderr, and one valid trimmed SDDL value.

The initial inherited-environment diagnostic failed with `CouldNotAutoloadMatchingModule`; this two-key sanitized comparison succeeded. This supports aligning any future diagnostic or probe ACL observation with the production sanitized environment. It removes the evidence basis for proposing a native handle rewrite solely because of the initial module-autoload result. It does not prove why the inherited environment prevented autoload, and it does not exercise or authorize the AppContainer boundary.

No ACL was changed. No AppContainer, native helper, network endpoint, model, or provider was invoked. The comparison call cap is consumed, and the original native probe remains closed.

## Frozen evidence

- Comparison script SHA-256: `A776028F8DAE4CB13FD0BED316F7E4731203696A36A68B237B179141CF7BAC7E`
- Intent SHA-256: `A91E7A6A71E5A79C2F3620D8850C7C77BD53FC4896D8CE933E8223B80B811B83`
- Raw result SHA-256: `962FA2BB08D80088ED965C7AAE667CA03D1E32642DB5F57473467A645DE57F68`
- Corrected initial result narrative SHA-256: `A459069439D8256ADCB3E7E7B10550CE677D1901FFDB77EA6C7430A976B10615`
