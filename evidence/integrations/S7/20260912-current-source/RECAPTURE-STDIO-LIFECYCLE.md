# Current source recapture after stdio and lifecycle repairs

Done: run `node scripts/reuse/cue-current-source-report.mjs` once and independently verify the new pointer, generation manifest, five artifact hashes/byte counts, and every scoped source hash against the current worktree. Preserve prior generations and reviews. Attempt cap: one generation run; no blind retry. Each pass checks source-basis stability and independent integrity evidence. No runtime, UI, model, performance, or qualification claim follows from static source capture.

Production source is frozen for this capture; concurrent diagnostic fixture work is outside the app/daemon source scope. On generation failure preserve evidence and investigate before any new run.
