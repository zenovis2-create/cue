# Independent staged probe diagnostic review

Status: **PASS for the offline diagnostic primitive.** It provides bounded failure evidence only. It grants no permission, launch, readiness, or acceptance authority.

Done was the contract in `DONE-CONTRACT.md`: exact CLI port/nonce binding; a closed stage set; single-shot exclusive diagnostic/result writes; bounded fields; distinct exit classifications; coverage of synchronous and late failures; preservation of the historical client; and no native, model, provider, credential, or network operation. Two correction hypotheses were permitted.

## Frozen artifacts

- Diagnostic client: `64BFCA108AFF18D020001962C32027468C0F658420B54B8F27632704E2B16CB9`
- Executable test: `E23B64C64DD53A0B7F1CD6E3E27DBDEDD024AE08B703A9BE3015722ECBF5AB86`
- Done contract: `BC5FB9FA04FE3DFCEEEFEDCB5ADA0CB9DF304953E8DE9353E8900181F562ACA2`
- Preserved historical probe client: `530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587`

## Review findings

- `parseInvocation` accepts only the standalone CLI shape `[node, "48193", 64 lowercase hex nonce]`. `execute` safely extracts a syntactically valid nonce before full port validation, so an invalid fixed port can produce a nonce-bound `port` diagnostic without accepting the invocation.
- The only stages are `evaluation`, `setup`, `port`, `socket`, `callback`, and `result-write`. Diagnostic JSON contains only version, stage, nonce, and validated 1–64 character name/code fields. It excludes error messages and paths.
- Diagnostic and result writes both use `wx`. The recorder marks itself recorded before accessing hostile input or writing. A successful diagnostic sets exit 71; any context, hostile-getter, serialization, or write failure sets exit 72. Both paths are single shot and remove installed handlers, so a hostile Proxy/getter cannot escape into recursive recording.
- The actual wrapper installs injected `uncaughtException` and `unhandledRejection` handlers before executing the body and removes them after diagnostic or successful result completion. CommonJS parse/load failure before wrapper entry remains explicitly unobserved.
- Every asynchronous completion checks `isRecorded` before writing. Once any diagnostic attempt starts, a later socket callback cannot create a valid result. Normal completion writes the original observation shape exclusively and emits no diagnostic.
- The diagnostic is never interpreted as permission evidence. Missing/malformed results remain nonauthoritative. A future gate must additionally reject diagnostic/result coexistence rather than selecting the result.

## Executed evidence

The initial candidate test run produced **4/12 PASS, 8 FAIL** because its synthetic Windows path literals embedded a carriage return and did not address the source issues. This failure was preserved and drove corrections to path fixtures, nonce staging, hostile input handling, and late failure coverage.

On the frozen candidate:

- `node --test scripts/reuse/fixtures/readonly-verifier-diagnostic-client.test.cjs`: **15/15 PASS**, exit 0.
- `node --check` on the client and test: PASS.

The executable tests invoke the production `createDiagnosticProbe` path with injected filesystem, socket, scheduler, exit, and process-emitter seams. They cover exact argv, all six stages, result/diagnostic write failure, exclusive writes, malformed and oversized fields, hostile Proxy getters, duplicate recording, both late-process handlers, handler removal, blocking a result after diagnostic, normal observation preservation, and the historical client hash.

No native child, AppContainer/profile operation, model, provider, credential, or real network action occurred. A separately reviewed gate is still required before this wrapper may be used in a native experiment.
