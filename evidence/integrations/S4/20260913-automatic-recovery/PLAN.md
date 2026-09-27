# Automatic approved recovery loop

## Done contract

From `daemon/`, run:

`npm exec vitest run -- test/integration-driver.test.ts test/integration-recovery-policy.test.ts test/integration-held-recovery-admission.test.ts test/integration-recovery-claim-limits.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Done means a prepare-time `recoveryMode` is exactly `manual` or `automatic-approved`, is exposed in the immutable approval summary, and automatic mode is accepted only with approved retry requirements and a trusted recovery host. The actual driver must automatically persist and apply store-derived retry/switch decisions, honor quota delay, persist stop/replan without launching a replacement, retain explicit-plan authority for replan, and preserve manual/default behavior. Cancellation, deadline, held recovery, budget, candidate approval/authentication, and replay remain checked by the existing policy/store/engine boundaries. Automatic handling never resets the in-flight driver promise.

Attempt cap: two coherent implementation passes. Every pass runs the exact four-suite command. A failed pass requires a new source-supported hypothesis; a second failure is preserved and handed back. False-done includes a unit-only decision test, a fabricated default recovery host, an automatic replan without an explicit plan, or a passing command that lacks real driver/store assertions.

No native helper, model/provider, live workflow, production default observation, or build runs in this unit. Root owns the shared build and documentation after source freeze. Independent review is required.
