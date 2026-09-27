# Startup correction maker result

Changed hypothesis: all child and parent work now lives inside async runProof(), started through the synchronous-returning startBootstrap helper. The entry module itself has zero top-level await. No product source/build/actual OS execution was performed. Old actual-attempt1 remains unchanged; corrected output is exclusively created as actual-attempt2.

Gate: `node --experimental-vm-modules --test evidence/integrations/S3/20260915-orchestration-ui/startup-correction/bootstrap.test.mjs` 3 PASS. Builtin VM links/parses actual complete harness without evaluating it and asserts hasTopLevelAwait false. Controlled readiness promise proves module caller returns before waiting and initialization only follows readiness; one-shot error propagation also passes. `node --check .../electron-proof.mjs` exit0. Test correction1 replaced unavailable installed TypeScript AST API (first 2PASS1FAIL) with builtin VM module parsing; initial test source preserved.

Child now writes fsync readiness-before.json and readiness-after.json around app.whenReady, before dynamic Core/IPC imports. All nine field-level captures, invocation assertions, unknown cleanup/retained ownership, expected Core close refusal, backup and fixture-only teardown remain unchanged. Helper and correction plan are included in selected before/after hashes. Prior offline real Core/IPC/UI proof remains valid for unchanged scenario/fixture.

Pending independent preflight; corrected actual attempt requires root signal after A03 completion. No actual attempt performed for this correction. Earlier readiness deadlock remains a supported harness hypothesis, not a proven product defect.
