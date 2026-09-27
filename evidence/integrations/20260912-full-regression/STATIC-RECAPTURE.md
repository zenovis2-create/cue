# Current static source recapture

Done: offline current-source generator exits 0 on frozen app/daemon source; independent checker verifies snapshot pointer, manifest, every artifact hash, and source scope. No runtime or screenshot claim.
Attempt cap: one generation command; failure preserves evidence and receives diagnosis before any retry. Every pass: extractor self-test and generated artifact integrity review. Latest root build a29e77 exit0 is reused; no repeated build.
Command: node scripts/reuse/cue-source-structure-report.mjs --self-test, then node scripts/reuse/cue-current-source-report.mjs.
