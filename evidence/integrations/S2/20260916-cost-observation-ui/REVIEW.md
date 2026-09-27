# Cost observation UI independent review

## Verdict

**CLEAR within the stated observation-only scope.** The implementation adds a real Core-to-UI consumer for persisted per-attempt monetary observations without granting acceptance, settlement, billing-finality, or selection authority. The coordinated build passed and the compiled projection matches the reviewed source path.

## Runtime and projection review

`createCueCore().completion()` now invokes `readOrchestrationSnapshot` with one host `Date.now()` value. The snapshot reads the immutable policy bound to the run and uses its `maxEstimateAgeMs`; it does not accept a UI-provided age or infer one from receipt text.

For each attempt, the projection requires exactly one reservation request bound to that run and attempt. It calls the existing persisted budget observation reader with the host time and policy maximum age. Missing policy, missing or ambiguous reservation lineage, invalid time, corrupt receipt payload, or reader failure yields the frozen `unavailable` observation for that attempt while allowing other stages to render.

The UI DTO is deliberately reduced to status, `observation-only` authority, cost state, numeric units, currency/unit, freshness, observation time, and descriptive billing state. It does not project the account reference, provider/tool identity, free-form receipt source, source reference, source digest, or raw payload. The snapshot read remains inside a read transaction and does not settle reservations or alter acceptance.

## Renderer review

The renderer accepts only the `observed`/`observation-only` shape and allowlisted cost/freshness states. It validates amount fields before displaying them and otherwise shows `금액 미확인`. Every orchestration refresh replaces stage and attempt rows, so an unknown, unavailable, invalid, or new-run snapshot cannot retain a previously rendered amount. The text explicitly says the observation is not final billing for the whole task, and existing Stop controls remain independent.

## Evidence

The retained first pass records 24 passing and 3 failing tests. All three failures exposed the same omission: `costObservation` was present on current stages but absent from `attemptHistory`, which caused both history checks and the history-based renderer check to fail. The correction added the same bounded observation to attempt history rather than weakening assertions.

The second focused run passes all 27 tests across:

- the new persisted cost-observation UI tests;
- existing orchestration observation tests;
- local observation tests; and
- cost/capacity observation and persisted bridge tests.

Those tests cover fresh, stale, future, unknown, actual-final-descriptive, invalid/corrupt receipt isolation, redaction, read-only behavior, acceptance remaining unverified, renderer clearing, and preserved Stop controls. The pass-1 failure log and pass-2 success log are both retained.

## Compiled wiring and limits

The root-owned coordinated build completed with exit 0. `app/core.mjs` imports `daemon/dist/src/ui/orchestration.js`; the compiled module contains the reviewed policy-age lookup, exact reservation lookup, persisted cost reader, reduced DTO, and both stage and history projections. Compiled projection SHA-256 is `37e61cf4a56ac8016ab4a0401634310c0773d9ad40d8223cfae16d79062e03bf`. The retained build log SHA-256 is `89f372151bf1861e05da5fcf17034620efbad440875f28d2f36289729f3aac06`.

- The UI is a descriptive consumer of persisted receipts. It does not create trusted subscription/API/local price or usage facts.
- `actual` and `billing: final` describe the selected persisted receipt only; they do not finalize the run budget or prove provider billing termination.
- No additional test, provider, model, local-model, or network call was made during this review.
