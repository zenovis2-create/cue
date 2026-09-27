# Held legacy retry admission reproduction contract

The before behavior is preserved in `RESULT.md`: a real decision-free retry launched while its prior attempt remained held.

Implementation is done when the store's final admission read checks every distinct prior attempt supplied by the retry reference and recovery decision after all host callbacks. Open, corrupt, or reconciled-stop cases must reject before attempt, retry-link, activation, writer-lease, stage, or reservation mutation. Valid eligible-for-disposition and no-held retries remain admissible, a held case created by the final authorization callback is observed, and an already inserted exact claim replay remains `launchRequired:false`.

Implementation attempt cap: two passes. Every pass runs, from `daemon/`, `npx vitest run test/integration-held-retry-admission.test.ts test/integration-held-recovery-admission.test.ts test/integration-retry-backend.test.ts`. A failed pass requires a new evidence-based hypothesis or handoff. Root owns the shared build.

No native, model/provider, network, external-effect, shared build, or historical live gate runs.
