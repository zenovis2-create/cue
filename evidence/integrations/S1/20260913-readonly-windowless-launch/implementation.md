# Read-only windowless-launch repair receipt

## Result

The production read-only launcher now adds `CREATE_NO_WINDOW` (`0x08000000`) to its existing `CREATE_SUSPENDED`, `EXTENDED_STARTUPINFO_PRESENT`, and `CREATE_UNICODE_ENVIRONMENT` flags. No other launcher behavior changed. The writer launcher remains untouched.

This is an offline repair only. The preceding PATHEXT gate remains failed and closed after worker creation returned `0xC0000142`; that status is not attributed to a DLL or other root cause. No native worker, AppContainer, model, provider, or network call was made after this edit.

## Preservation and verification

- Archived executed launcher: `archive/readonly-verifier-launch.ps1`, SHA-256 `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`.
- Archived executed gate manifest: `archive/pathext-gate-manifest.json`, SHA-256 `7C453E3C739B56721F4AF4ED9B6CC895AE6289DF01836AA934CD06F54041074A`.
- Current source launcher: SHA-256 `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`.
- Packaged launcher: identical SHA-256 `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`.
- Focused boundary test: 10/10 passed; test SHA-256 `DD8136C72E8923DEF7CA3C669E0DEFFC08FAB09CA18E3FE1FE8C284DC8D1E7FF`.
- PowerShell syntax parsing, build, asset copy, and scoped diff check: passed.

The flag test evaluates the numeric bitset and requires all four reviewed flags. It separately confirms the existing model-only launcher contains the same required windowless bitset; this is contract parity evidence rather than native execution evidence.

The failed PATHEXT gate's independent actual review remains authoritative: `evidence/integrations/S1/20260913-readonly-pathext-gate/actual-review.md`, SHA-256 `BEA5DDDE724712E6B56EC5D899F3EBED696811435F7E348AACC1529309465548`.

Independent offline review: PASS; `review.md` SHA-256 `8F1633B8C0B6356AFE2457D8224C214D750C1103634FDB13045BB40EFC801953`.
