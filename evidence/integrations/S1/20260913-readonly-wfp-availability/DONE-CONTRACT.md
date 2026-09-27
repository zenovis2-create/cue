# Done contract: WFP event-collection availability query

Done means a standalone PowerShell script compiles an exact embedded C# query using only `FwpmEngineOpen0`, `FwpmEngineGetOption0(FWPM_ENGINE_COLLECT_NET_EVENTS)`, `FwpmFreeMemory0`, and `FwpmEngineClose0`. It emits one bounded JSON object containing schema version, state `enabled|disabled|unknown`, raw open/get/close Win32 codes, returned FWP type, and collection value when valid.

The query requires `FWP_UINT32` and value `0` or `1`; every other type/value or native error is unknown. The returned value is freed whenever non-null and the engine is closed whenever opened, including errors. No setter, subscription, audit-policy operation, loopback exemption, network connection, elevation, service start, native worker, model, or provider operation is present.

Attempt cap: two evidence-based corrections. Every pass compiles the exact embedded C#, runs offline formatter cases for enabled/disabled/type/value/native failures, verifies the exact P/Invoke surface and cleanup guards, runs PowerShell AST and Node syntax/tests, and checks scoped diffs. The real query is not run until independent preflight and root authorization.

Primary contracts: Microsoft [`FwpmEngineGetOption0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmenginegetoption0) documents option `FWPM_ENGINE_COLLECT_NET_EVENTS` returning `FWP_UINT32` value 0 or 1 and requiring read access. `FwpmEngineOpen0`, `FwpmEngineClose0`, and `FwpmFreeMemory0` define the local engine/value lifecycle. The embedded C# derives the native union offset through `Marshal.OffsetOf` on a sequential ABI layout instead of assuming a fixed x86/x64 offset.
