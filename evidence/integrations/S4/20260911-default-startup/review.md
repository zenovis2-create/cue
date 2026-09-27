# Independent protected startup/discovery review

Verdict: PASS for the bounded module refactor/discovery unit; default package activation is still pending. No product edits or live health/model calls by this reviewer.

Independent gates:
- startup + protected-installation + guarded-entry + resource UI: 19 passed, exit 0, 5.58 seconds at 2026-09-11 22:14:08 KST (tool beb668).
- p9 + p13-lifecycle-barrier: 20 passed, exit 0, 1.93 seconds at 22:14:55 KST (tool 595ef9). A preceding regex-filter CLI invocation failed before test execution because npm.cmd interpreted the pipe alternative; the two bounded fixture files were then run directly. No product failure was hidden.

start.mjs statically imports only Electron and the guarded-entry helper, then dynamically imports main through the capture/post-import assertion. Main now defines functions without beginning readiness/config/daemon/window work at import time. Its explicit single-attempt initializer checks the private generation brand and source assertions, retains first-run workspace/config flow, passes the same owned AppDaemon to discovery/core and awaits core/daemon close on initialization failure. Existing quit barrier and strict main-frame resource IPC remain wired. Automatic CUE_LIVE_RUN inference invocation was removed; a leftover function definition alone cannot invoke it.

Discovery binds canonical root/dependency paths and loaded SQLite native cache identity to the captured file label/hash inventory and current generation. It rejects reparse/type mismatches and ambiguous native candidates. Known folders come from fixed read-only PowerShell with 5-second/8-KiB limits; no request-selected command or installation path is accepted from renderer data. Descriptor validation keeps exact loaded host/runtime and measurement paths. Dependency/native bytes are covered by guard.assertCurrent, not merely the presence of a hash-shaped string.

Missing/disabled v2 settings return before native discovery or HTTP. Enabled discovery performs a fixed GET to 127.0.0.1:8085/v1/models with redirect:error, 2-second abort and a 32768-byte streamed response limit, requires the exact model ID and rejects stale cached observation after ten minutes or non-ready daemon. This is cached model-presence health, not guaranteed capacity. Readiness quotaAvailable means no additional host quota beyond local invocation accounting, not a provider quota measurement. No inference, policy creation or qualification records are written by this code.

Material integration limit: package.json still points `main` at app/main.mjs, now definitions-only. Thus ordinary `npm start` has not been proven to initialize this new path and needs the parent-owned switch to app/start.mjs. Current PASS does not certify a working default app startup before that change and actual Electron verification.

Test boundaries: startup tests mock Electron/core/discovery, and discovery tests mock filesystem, native cache, PowerShell and HTTP. Guarded-entry executes real Node/Electron but against a synthetic installation, not the actual project addon/ABI closure. Resource IPC tests use actual core/store with host chooser fixture. Native dialog, actual project startup, actual known folders/native cache and current model server health remain separate QA. The initial Electron/helper/environment-derived OS paths and protected host ownership remain TCB assumptions.

Source hashes:
- app/start.mjs SHA256 A26E9548C1EA6DEDC2E3E451927CE11F66AD1C2B70F58575E79A5DF289AE4C26
- app/main.mjs SHA256 5C052A303EB14E7596AB847CF7F18176C5F138CBF6A4C0A66B479F8E7829372A
- app/main.d.mts SHA256 F83EE074D0D29C07BC15EEC9532BB71CA7836BE154C8392E9CA254F205A1484A
- app/protected-installation.mjs SHA256 482B241A542C8E4659512391328F9395534C0BC11F9E085A3CE1CAE6FCDC57AB
- app/protected-installation.d.mts SHA256 D6564FFB003DDC25BED1CE977B486A9499214A08B061810E5F1AAFE6D12471C0
- daemon/test/integration-default-startup.test.ts SHA256 BAD047665BD08230593987F39CBF4B65E1D5A169CAFCB816116933C859EDFD8B
- daemon/test/integration-protected-installation.test.ts SHA256 26C5FAE1BA887605E01BF248B1BA2E6F55ECEE953209854059F429FAE58F155E
- app/guarded-entry.mjs SHA256 9A7E954B633259211B870D6BC6FA526F0CE65F48BAD7954C28B763AC78EE17C1
- package.json SHA256 E31543E329CDC883BDD270B969F41E8C41D9F8A4FD1F397B0AF0D9B8FFC5FB42
