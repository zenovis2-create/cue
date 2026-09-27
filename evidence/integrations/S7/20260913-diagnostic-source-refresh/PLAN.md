# Diagnostic implementation source refresh

Done means one new static source capture after the WFP diagnostic implementation has final independent source reviews and a successful daemon build. The existing report generator must produce a generation for the changed JS/TS bytes, with a matching current pointer, five artifact hashes, source inventory, and before/after Git source basis. All previously retained generations and failed staging files must remain byte unchanged. An independent reader checks these facts without rerunning the generator.

Attempt cap: one generator invocation for the newly changed source snapshot. This does not retry an old native or model gate. If the source is not stable, or generation fails, preserve its receipt and do not retry under this contract.

Before the invocation, record the generator hash, current pointer, retained generation and staging file hashes, and the source snapshot digest. Proceed only if the new digest differs from the existing pointer. Freeze app and daemon/src writes through the final audit.

Completion command from the repository root: `node scripts/reuse/cue-current-source-report.mjs`, exit 0 with `ready:true`. Every audit pass checks pointer/manifest/artifact hashes, exact recorded source bytes, unchanged historical files, and the stored source basis against current Git status. No additional build or test rerun is needed unless source changes or a failure warrants it.

Scope is bounded static JS/TS source and declared imports. This is no C#/PowerShell extraction, browser visual verification, runtime execution, native qualification, clean Git assertion, or whole-project completion. The full suite remains historical.
