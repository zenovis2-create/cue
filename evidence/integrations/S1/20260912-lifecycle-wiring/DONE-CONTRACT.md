# S1 Unit 3 lifecycle wiring — completion contract

Recorded: 2026-09-12 KST

Status: implementation authorized after independent PASS reviews of Unit 1 and Unit 2. Unit 2 stable source SHA-256: `d33b6ecb9498e4264de4fe35408634c871e224550786392d93bdf7667faefb67`.

## Scope and fixed inputs

This unit may change only:

- `daemon/src/integration-runtime.ts`
- `daemon/test/integration-runtime-contract.test.ts`
- `app/orchestration-driver.mjs`
- `app/orchestration-driver.d.mts`
- `daemon/test/integration-driver.test.ts`
- evidence under this directory

The stable source inputs are `daemon/src/orchestration/provider-lifecycle.ts` and `daemon/src/adapters/integration-executors.ts`; this unit will consume their reviewed contracts and will not edit them. No real provider, model, native launcher, Electron, paid, or network call is permitted. Tests use deterministic synthetic adapters and temporary SQLite databases.

## Done means

1. Runtime records one `cancel-requested` event when cancellation is first requested and records `client-cancel-acknowledged` only if the adapter cancellation promise resolves. Repeated cancel calls neither append duplicates nor invoke adapter cancellation twice.
2. Runtime forwards only explicit, typed, adapter-originated provider lifecycle events and provider references. Every write is bound to the runtime's trusted run/task/attempt/candidate lineage and the Unit 2 store validates ordinal, replay, terminal, seal, and reference ownership rules.
3. Adapter completion or `succeeded`/`failed` outcome never creates a provider-terminal receipt, provider death, cleanup, billing finality, acceptance, or budget release. Missing receipts remain `unknown`.
4. A host-verified cleanup receipt is recorded only as a local cleanup observation. It does not imply provider terminal state, provider death, or billing finality.
5. Lifecycle and cleanup callback errors or bounded timeouts fail closed: they cannot settle a run successfully, release funds, verify acceptance, or erase unresolved ownership. Late callback results cannot mutate the accepted projection.
6. Stale attempts, wrong run/task/candidate lineage, duplicate or late events, and events after a terminal/sealed boundary do not change the current projection.
7. The driver exposes the durable lifecycle projection with matching declarations. A fresh driver instance can read an existing projection without prepare, activation, launch, resend, HTTP, native, Electron, or adapter calls.
8. Existing runtime admission, pending-launch, late-resolution, receipt run/subject binding, driver retry, acceptance, cleanup, and engine behavior remain green.

## Approved seam interpretation

The current `AdapterExecution` has no provider lifecycle/reference channel, while the Unit 2 store requires explicit provider receipt digests and full `runId/taskId/attemptId/candidateId` lineage. Unit 3 will add an optional bounded typed lifecycle callback to `RuntimeContext`. A synthetic adapter can exercise explicit provider-terminal receipt material and opaque thread/turn/subtask references. The current Codex adapter has no authenticated provider receipt and therefore emits no provider-terminal fact; its provider terminal/death/billing projection remains unknown. Runtime will not derive receipts by hashing completion/status.

The driver registry and persisted stage/attempt records provide trusted task/run/attempt/candidate scope for append/project through the Unit 2 store. Caller-supplied lifecycle scope is not authority. Callback count, payload size, wait time, and late writes must be bounded and fenced.

## Correction and rollback policy

- Maximum product correction hypotheses: 2.
- After every implementation pass, run the hostile focused subset below before broader gates.
- A failed pass requires a new stated hypothesis. Repeating the same approach is forbidden.
- Keep a change only when the measured gate improves. If a gate regresses, revert only this unit's change and try the next hypothesis.
- After two unsuccessful hypotheses, stop without live-provider fallback and hand the blocker and raw command output to the root owner.

Correction record:

- Hypothesis 1 exposed two reviewer-found gaps before final acceptance: nested reference arrays were not copied descriptor-safely, and event/reference persistence lacked an outer atomic transaction. The earlier transaction removal was rejected as an unsupported diagnosis because the simultaneous driver regression belonged to Unit 3's downstream S3 boundary.
- Correction 1 snapshots bounded dense reference arrays without invoking caller accessors or methods and restores one immediate outer transaction around event plus all bindings. `RuntimeHost.recordLifecycle` is synchronous-only; the product callback persists before returning, so the supported contract does not claim it can cancel arbitrary delayed host side effects.

## Every-pass hostile subset

From `daemon`:

```text
npx --no-install vitest run test/integration-runtime-contract.test.ts test/integration-driver.test.ts test/integration-provider-lifecycle.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

The focused cases must cover separately: cancel acknowledgement without provider terminal; provider terminal without cleanup; clean local cleanup without billing; callback throw/timeout/late resolution; duplicate replay; stale or foreign lineage; post-terminal writes; and reopen with zero launch/resend calls.

## Final completion commands

From `daemon`:

```text
npx --no-install vitest run test/integration-runtime-contract.test.ts test/integration-driver.test.ts test/integration-provider-lifecycle.test.ts test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
npm run build
```

Completion evidence must record exact exit codes, pass counts, changed-file hashes, and a checklist mapping each hostile case to its assertion. A local pass does not claim actual remote provider termination, billing finality, P13, or M-gate completion.
