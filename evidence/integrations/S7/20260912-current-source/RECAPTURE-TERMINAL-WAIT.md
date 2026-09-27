# Current source recapture after terminal wait repair

Done: after the launcher maker and independent checker finish and production source is frozen, run `node scripts/reuse/cue-current-source-report.mjs` once. Independently verify the pointer, generation manifest, five artifact hashes and sizes, source-basis stability, and every scoped source hash against the worktree. Retain all older generations and reviews.

Attempt cap: one generator run. Failure requires a new hypothesis before any further mutation. Every pass checks the exact generator result and independent integrity receipt. No runtime, UI, network-denial, model, or qualification claim follows from this static capture. Scripts and tests remain outside the app/daemon source snapshot scope.
