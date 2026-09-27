# Exploration engine maker receipt

The orchestration engine accepts an optional deeply snapshotted `cue-exploration-request-v1` intent. An explicit intent requires migration 041 and an exact immutable run/policy/candidate authorization digest before selection or host callbacks. Selection remains subject to the existing task, plan, policy, forced-candidate, pin, eligibility, quality, freshness, currency, cost, and time checks. A no-statistics initial-default observation conflicts with exploration and fails closed.

The ordinary reservation is made once, then the matching exploration subbudget reservation is made in the same immediate transaction before preparation and launch intent. Later synchronous failure rolls back both reservations, the claim, and preparation artifacts. Exact replay validates the request journal, grant, exploration row canonical payload/hash, and linked ordinary reservation without recharging or relaunching. Missing or tampered links fail closed. Grant presence without an explicit request remains ordinary execution.

The local engine rejects the explicit flag immediately after request snapshot and before policy, ledger budget, host, or provider work. Ledger opening registers migration 041 once and rejects partial installations rather than silently accepting missing tables or guards.

## Revision evidence

- Revision 1: build 0; 46/47 tests. The only failure was the baseline fixture's intentionally untrusted final-receipt verifier rejecting the synthetic debt receipt before the engine path.
- Revision 2: used an explicitly trusted budget manager for that named synthetic billing test and added schema, mutation, conflict, and ordinary-filter coverage. Build 0; 51/51 tests.
- Revision 3: added pre-callback migration preflight, canonical replay-lineage validation, local rejection coverage, and strict partial-migration detection. Build 0; 53/53 tests.
- Compiled fresh-file and reopen smoke: both migration 041 tables and all eight triggers present on both passes; exit 0.

## Frozen pins

- `daemon/src/orchestration/engine.ts`: `4390cb6640ecf9e34feebcf983fc2016b59728aed6789178671fe33b653b680a`
- `daemon/src/ledger.ts`: `82fb44eeeb7cf69402a8c54af185dd1de77798fe66c96f973734091377c0c2e7`
- `daemon/test/integration-exploration-engine.test.ts`: `293262856fc4664ffe760a5880ee6e494ab4f35f58cd6777147b5e495038c4b2`

This qualifies mocked daemon orchestration and ledger behavior only. It does not qualify live providers, credentials, native helpers, UI, or production host ingestion.
