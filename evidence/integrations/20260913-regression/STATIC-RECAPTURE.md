# Static recapture after ledger startup correction

Done: regenerate static source artifacts once for the changed frozen ledger.ts; independent checker verifies source hashes, pointer and all artifact hashes/byte counts. No runtime or visual claim. Attempt cap1; no generator/source edit. Existing reviewed build is reused. A failure is diagnosed, not retried blindly.
Command: node scripts/reuse/cue-current-source-report.mjs
