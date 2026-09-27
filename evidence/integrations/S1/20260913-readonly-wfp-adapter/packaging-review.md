# Independent WFP adapter packaging review

Status: **PASS for packaging and offline compilation only.** No WFP API, worker, provider, or native observation path was activated.

## Frozen packaging audit

- `daemon/scripts/copy-assets.mjs` contains the two bounded additions: canonical `scripts/reuse/native/readonly-wfp-collector.cs` to `daemon/dist/src/readonly-wfp-collector.cs`, and `daemon/src/readonly-wfp-observation.cs` to the same relative path under `dist/src`. The pre-existing launcher copy remains intact.
- Canonical and packaged SHA-256 values match exactly:
  - collector: `5871FB8684AA3D8C2B6D635E3C31B6FD5A9FE45E18CDD9D7A1164C106C9CCB4F`
  - adapter: `9C00E6A55D93BCC43CFBCA33CA2DBC305CF3BB72734E8A24469EF3154D882F60`
  - launcher: `6060955CD91AFB9D0470697C1B8945A75850AFD3A0307CF60AC0063C271A48FF`
- Copy script SHA-256: `CBE63AD29D3383435EB5DDD778635D729CA8CB318015B39DF9A0301E96828A5F`.

## Independent compile gate

Attempt 1 compiled the earlier adapter but was superseded by the quarantine correction and is not the acceptance receipt.

Attempt 2 extracted only the launcher's embedded C# type definition and passed that file, the packaged collector, and the packaged corrected adapter together to `Add-Type -Path`. It exited 0 and resolved both `CueWfpObservationLeaseFactory` and `CueWfpObservationLease`. This proves the packaged units compile as one assembly and their launcher-owned types resolve. It does not claim runtime loading or native availability.

The launcher contains no `$PSScriptRoot`, `Get-Content`, `Add-Type -Path`, or WFP-file load. The two new copies are therefore assets only; this packaging change does not activate them. A base64 `ScriptBlock` execution context must not infer a usable default asset path from `$PSScriptRoot`.

## Static-source scope note

The active S7 generation still hashes all 164 recorded JS/TS files without mismatch. Its broader source-basis is now stale: the stored status is SHA-256 `BF9A7E8A8A9E2886CC6DFB06BF3636623333854ED88485043638F8A5CCDCE5D5` with 125 entries, while the exact current `app` plus `daemon/src` status hashes to `CBE22984975A47121A4B96F75AFF3409A4A6E70F1C56B3F1B9290A6C64A88CE5` with 126 entries and includes `daemon/src/readonly-wfp-observation.cs`. The active generation remains evidence for its 164 recorded JS/TS bytes, but must not be described as a current snapshot of the full `daemon/src` status scope.
