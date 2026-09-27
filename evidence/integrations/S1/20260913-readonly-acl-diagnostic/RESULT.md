# Read-only ACL diagnostic result

## Verdict

The single host-only diagnostic reproduced the pre-launch failure. `runProcessSync` started the same Windows PowerShell executable with the same `-NoProfile -NonInteractive -Command (Get-Acl ...).Sddl` shape, but PowerShell returned status `1`, no signal or spawn error, empty stdout, and a bounded `CommandNotFoundException` diagnostic. Its stable identifiers state that `Get-Acl` belongs to `Microsoft.PowerShell.Security`, the module could not be loaded automatically, and `FullyQualifiedErrorId` is `CouldNotAutoloadMatchingModule`.

This establishes the immediate cause of this diagnostic process failure: `Get-Acl` was unavailable because its security module did not autoload in the inherited parent environment. The frozen probe retained no raw ACL subprocess fields, so this result cannot establish that its earlier failure had the same cause. The diagnostic environment also differs from the production boundary's sanitized environment. No AppContainer, ACL grant/change, native helper, model/provider, or network operation ran.

## Repair proposal

No production correction is established by this reproduction alone. A sanitized-environment comparison must first determine whether the inherited host environment caused the module-autoload failure. If that comparison succeeds, a future harness should align its ACL observation environment rather than infer that the native boundary needs rewriting. Any later diagnostic or runner must retain raw subprocess fields before classifying failure.

A second, weaker hypothesis would explicitly load the system `Microsoft.PowerShell.Security` module from a separately pinned installation path before `Get-Acl`. That path and its module-loading behavior were not tested here, so it is not a supported repair claim.

The consumed Unit A native probe remains closed and must not be rerun. A future boundary attempt requires a new contract and independent review; this diagnostic grants no such authority.

## Evidence

- Diagnostic source SHA-256: `66AF07A3C901D9389818C006B19CD711DFF41EE6648E0A95F1554E72E8E7BC10`
- Offline test SHA-256: `DD4E10AD500683AB9F67DAABF61AC48E6E79DC9D1138E9D205A8C240C19E7DFF`
- Intent SHA-256: `22E9B84A7D178A65079FF0F501CDE6317B258393725CD5D035E625BD3CA1DA11`
- Raw result SHA-256: `8A94D7F2B698AFAD21976061C8F9CF8E28E4E833DA2C2167145E9FF223C17D56`
- Offline classifier: 3/3 test groups passed, including valid SDDL, spawn error, signal, nonzero status, stderr diagnostic, empty output, and malformed SDDL.
