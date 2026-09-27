# Replan cumulative budget and requirements contract

Done means a focused real SQLite test uses `createOrchestrationEngine`, the real budget and orchestration stores, and an injected inert runtime to create an initial reserved failed attempt, issue and persist a valid replan decision/revision, then prove:

- spending the remaining original budget before revised `engine.start` rejects atomically with no replacement attempt, activation, stage envelope, selection, or runtime start;
- an in-budget revised start adds to the original committed reservation, and exact replay neither resets budget nor starts runtime again;
- changing the approved authority or removing an original requirement is rejected by `appendRevision`, leaving the stored original requirements unchanged.

Attempt cap: two offline fixture corrections. Every pass runs, from `daemon/`, `npx vitest run test/integration-replan-budget.test.ts`. No product source, shared build, native helper, model/provider, network, or live workflow is changed or run.

The original cap was exhausted: pass 1 exposed generated test SQL syntax loss, and pass 2 reached the real store but failed initial start with `explicit_revision_required`. Root authorized one distinct reviewer-confirmed fixture correction: because `registerScope` installs explicit revision authority before initial start, bind that initial request to revision 0 and the original plan digest. This final pass runs the new test with retry-backend, recovery-policy, and claim-limits regressions once; any further failure stops the unit.
