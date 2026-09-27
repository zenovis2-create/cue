# Independent WFP availability-helper preflight

Status: **PASS — ready for one separately authorized read-only query of the corrected frozen script.** This review compiled the embedded C# and exercised pure formatting/error cases; it did not query WFP.

The initial frozen candidate had a fail-closed defect: a managed exception after partial decoding could preserve state and falsely report `disabled`. The corrected candidate routes decoding through one `TryDecode` helper that resets type/value and returns false on any read failure; the outer catch also clears presence. An executable reflection test drives the actual helper through type-3 success followed by a throwing union read and proves `false/type0/value0`.

## Frozen artifacts

- PowerShell helper: `C7B44F9B481F27F46A54C6B6DF88CD0B98FC2EFF2F45C49C8FB70E3561E4784B`
- Offline test: `F5749A322E0A3D5A6B0B69AB9BCBC73AD761E68C1D52960D05FA5B4FB25EB157`
- Done contract: `6618FA1527562D20A8A6A304E9632F1C66D232C8E8C330126F37F6E375B8FE42`
- Reviewed network-plan basis: `3E7A75B6AD7A461C40B81FB5D5E609006DF53E2FEC887411348F0C7FF93684F1`

## ABI and authority review

- The native surface is limited to `FwpmEngineOpen0`, `FwpmEngineGetOption0`, `FwpmEngineClose0`, and `FwpmFreeMemory0`. The script contains no setter, subscription, audit command, policy/configuration call, service action, socket, worker, elevation, or network operation.
- `FWPM_ENGINE_COLLECT_NET_EVENTS` is correctly encoded as option 0. The documented return is `FWP_VALUE0**`; the helper models it as `out IntPtr`, requires a non-null returned allocation, and frees it with `FwpmFreeMemory0(ref valuePtr)`.
- `FWP_UINT32` is correctly encoded as type 3. The `FWP_VALUE0` tagged-union payload offset is derived using `Marshal.OffsetOf` on a sequential `uint` plus native-width union-storage layout. This yields the native union alignment on x86/x64 rather than assuming a hard-coded offset. The helper reads the inline UINT32 value at that offset.
- An enabled/disabled answer requires open, get, and close return code zero; a present value; exact type 3; and exact value 0 or 1. Any native error, close failure, absent allocation, type drift, unexpected value, or managed exception reports `unknown` rather than availability.
- Cleanup is guarded: returned memory is freed when present and the engine is closed when opened. No query result grants subscription access or permission authority; it only reports whether collection is currently enabled.

## Executed offline evidence

- `node --test scripts/reuse/readonly-wfp-availability.test.mjs`: **6/6 PASS**, exit 0.
- `node --check scripts/reuse/readonly-wfp-availability.test.mjs`: PASS.
- The tests compiled the exact embedded C#, behaviorally verified enabled/disabled and native/type/value/close-error formatting, checked alignment-derived union access, parsed PowerShell syntax, and inspected the bounded read-only call surface.

After immediately rechecking the corrected script SHA-256 above, the exact proposed read-only command is:

```text
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/reuse/readonly-wfp-availability.ps1
```

The expected output is one bounded JSON object with `state` equal to `enabled`, `disabled`, or `unknown` and the native return/type/value fields. The command opens and queries the local filter engine and still requires root's separate authorization. It must not be treated as permission to subscribe, enable collection, alter audit policy, or launch a worker.
