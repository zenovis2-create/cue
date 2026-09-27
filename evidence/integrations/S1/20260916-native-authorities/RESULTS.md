# Results (pre-build checkpoint)

Implemented bounded foundations only:

- migration 050 and exact bootstrap/asset wiring for immutable native runtime receipts;
- receipt persistence accepts only the original result authenticated by `readIssuedNativeRuntimeEvidence`, binds exact run/task/attempt/candidate/subject/session evidence, supports immutable replay, and does not burn proof on a failed insert;
- independent cleanup re-observes exact process creation identities, treats PID reuse as clean for the owned process, checks only ephemeral-owned resources, and never deletes or requires absence of retained profiles;
- opt-in `approved-existing-file-artifacts-v1` contract commits every target's expected SHA-256 and byte length and rejects missing, extra, duplicate, unchanged or mismatched expectations. It does not claim a natural-language goal was satisfied.

The complete authority constructor and Core positive path are not implemented. Source inspection proved there is no trusted pre-launch provider service authentication/entitlement producer. Provider installation and account presence are identity observations, capability probes are not service authentication, and downstream account binding cannot bootstrap the missing fact. No shaped `authenticated:true` input was added.

Validation chronology:

- TypeScript no-emit: PASS.
- Focused pass 1: checker and cleanup 4/4 passed; runtime receipt 0/3 because its test session referenced an absent nested run.
- Focused pass 2 after adding that run: checker and cleanup 4/4 passed; runtime receipt 0/3 because the test omitted the orchestration task row required by the session foreign key.
- The fixture was corrected to add the exact task row. The two-pass hypothesis cap prevents another maker rerun; this correction remains for the coordinated root build/gate.

No provider, model or network call was made. No setup/startup schema or resolver was added. No S1 closure is claimed.

## Coordinated final gate

Root's coordinated build passed. `foundation-gate.json` covers six requested files (reported by Vitest as nine nested suites) and records 22/22 tests passing with zero skips/failures, including runtime receipt persistence, cleanup, deterministic checker, native host regressions, and existing 048/049 migration definitions. The actual executor-to-050 production consumer was verified separately in the native-identity worker's 20-test final gate; it is not part of `foundation-gate.json`. The earlier foreign-key fixture failures are preserved above and the exact task-row correction passed in the foundation gate.

A subsequent focused migration-050 gate passed 2/2: the built package contains byte-exact 050 SQL, fresh and reopened ledgers install the complete schema, and partial or weakened definitions refuse startup.

The implemented production path now reaches 050 after an already legitimate native executor launch. It does not add or widen pre-launch authorization. The full native authority constructor remains incomplete because current account presence is not fresh provider-service authentication. The deterministic checker remains an explicit opt-in utility and is not wired as acceptance for ordinary natural-language coding goals.
