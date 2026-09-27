# Independent windowless-gate preflight

## Verdict

**READY for exactly one root-authorized execution, with no retry.** No `--run`, PowerShell, native helper, AppContainer, ACL operation, network, model, provider, or cleanup action was performed during this review.

Exact command: `node scripts/reuse/readonly-verifier-windowless-gate.mjs --run`

The gate owns only `D:\Temp\User\Cue.ReadonlyVerifier.WindowlessGate1` and `evidence/integrations/S1/20260913-readonly-windowless-gate/actual-attempt1`. The owned root, intent, expected, and result paths were absent at final preflight.

## Frozen closure and checks

- Runner: `DFC1A40B3824A4B271C80E3698F76DF86DCD479880C7FD841C93530598AB0012`
- Test: `F488C634FF318148140917DE4E8EFC5C9EA2F80AE442C8CD802854D0A8A414D9`
- Manifest: `08CDAF2598F08AF5811F18F8C823D384B8C4B9B8AD2DF263051B7B7D8A2CB577`
- Windowless launcher: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`
- Corrected done contract: `7A1F4A79F9EA3CB98FB5AB3CAB55CB803AFC462EBB1D293BD954DED8278C1ED2`

All 11 runner/test/client/launcher/adapter/compiled/native/Node pins independently matched. Pin verification precedes authority imports, marker creation, owned-root creation, and native activity.

Independent offline command: `node --test scripts/reuse/readonly-verifier-windowless-gate.test.mjs`

Result: **15/15 passed**.

The gate durably creates `expected.json` with exclusive `wx` semantics before launcher execution and stores the expected nonce and command-line digest. It requires exact nonce-bound cleanup and exit frames, a positive PID with verified death, exact post root identity and SDDL, exact-profile absence, unchanged fixture bytes, a host-positive/worker-denied loopback result, and only `EACCES`/`EPERM` for the tested mutations. Missing or malformed worker output remains FAIL while post-root, ACL, and profile observations still run and persist bounded raw fields.

The permission scope is exact: project read; runtime write; project create, overwrite, remove, rename, and `fs.chmod`; sibling read/write; and controlled loopback. Node `fs.chmod` does not establish arbitrary DACL or security-descriptor mutation denial, which the corrected contract explicitly excludes.

The windowless flag remains a hypothesis. The gate does not identify a DLL or explain the earlier `0xC0000142`, and it cannot establish coordinator behavior, durable identity storage, production registration, acceptance, P13, entitlement, or public qualification.
