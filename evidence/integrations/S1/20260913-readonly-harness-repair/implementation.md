# Read-only harness repair receipt

## Result

The offline harness repair is complete. All four host PowerShell calls now receive exactly `SystemRoot` and `WINDIR`; the isolated launcher payload retains its separate eight-key environment. Bounded raw status, signal, structured error, stdout, and stderr survive both exception and normal terminal-result paths.

The consumed historical runner, test, and manifest are archived byte-for-byte. The original manifest remains unchanged and pins the historical runner, so the corrected runner fails its old hash authorization before its marker callback, owned-root creation, PowerShell call, or launcher call. No native execution or retry is authorized, and this repair provides no native qualification.

## Evidence

- Offline focused tests: 9/9 passed.
- Syntax check: exit 0.
- Corrected runner SHA-256: `C6C689FCD6ED28BE4577EE42DE826C3EBA7C77A394E0FB939A99462D4B4D75FF`
- Corrected test SHA-256: `48E05FCF3FC8DA4011C61A6E103C6F81FA8A346BAD7C8C554F27F80C46852CC5`
- Archived historical runner SHA-256: `35AA35FD4BB15D93FA828EFA4E3ACCD2FFCCF69EBB936CEEA913AB04607A693B`
- Archived historical test SHA-256: `71D96C974F832FBD186B71B4483A771551809BC33ED20E7A0FB16F049598FDAC`
- Archived historical manifest SHA-256: `2E120EFC324A20EB42642A641EB7862EE98CD5125FCDBC2078D2A0B61E283311`
- Independent review: 9/9 and PASS; `review.md` SHA-256 `87C41E023FB8746B894210AD483875493C6E2611D4467E94ACC3FF691D74AFDA`.

No production source or build output changed. The historical intent, failure result, and manifest remain immutable.
