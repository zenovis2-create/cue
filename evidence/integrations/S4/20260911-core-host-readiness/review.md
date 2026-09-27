# Explicit host readiness result — independent review

2026-09-11. Reviewer contracts_review; maker root. PASS after one diagnosed DTO correction. No product edits/live calls.

Done: inspect explicit unavailable versus invalid constructor result, immutable bounded reasons, no-write preparation rejection/no fallback, ownership cleanup; focused tests/typecheck exit0; record hashes. Cap2 corrections, used1. One evidence write then read/hash check.

Finding1: original Array.every skipped sparse slots and spread invoked user iteration, permitting a public reason snapshot different from validated codes. Maker corrected factory output to nonproxy plain record (ordinary/null prototype), own exact available:false/reasons data fields, standard dense array with direct index descriptors and copied validated strings. Sparse, inherited, accessor, proxy and custom-iterator cases reject without executing getters. Existing host object results remain distinct from explicit readiness data.

Independent checks:

- From repository root: npx --prefix daemon --no-install vitest run daemon/test/integration-driver-core.test.ts daemon/test/integration-selection-preference-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 — exit0,2files/8PASS,20:16:00,1.63s (chunk14543a).
- From daemon: npx --no-install tsc -p tsconfig.json --noEmit — exit0 (f7ecc3).

Explicit unavailable keeps core/ledger open and exposes frozen bounded reason codes through selectionPreferences, without constructing a driver or falling back to legacy execution. prepareGoal checks unavailable before requested-mode processing or transactions, so both omitted and explicit mode attempts create no tasks/runs/envelopes. Later mutation of host reasons cannot change the public snapshot.

Missing/invalid factory result remains a constructor error; previous owned-versus-borrowed daemon cleanup behavior is retained and covered. Current unavailable is a startup snapshot; no automatic requalification/hot activation is claimed.

Default main host is not enabled and there is no live model qualification or accepted real goal in this unit. Reasons are diagnostics, not authority.

Current SHA256:
- app/core.mjs : B97D5890A59498370B74D10CA4DAE0DC93EA02002300A95C232C3FB37A953C4F
- app/core.d.mts : 157BEE74DB6C871E8D06EA800209307B3993E7EAA1BE51BA07FABD35013CE4F0
- daemon/test/integration-driver-core.test.ts : DB4B572B6D6A7E20C1D557B1FCE6561FFA945DCF0B47DE84D7FCE7FA26E4381D
- daemon/test/integration-selection-preference-core.test.ts : B2874647D6FB937EB20895453932487E690050FA30E5282B1C4E0D4959FEB3FE
