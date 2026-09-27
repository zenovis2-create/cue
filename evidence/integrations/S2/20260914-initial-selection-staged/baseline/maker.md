# Initial-selection baseline maker receipt

Status: PASS on final revision 2; no product files changed.

The new fixture uses the current validated implementation/verifier plan shape, real selection policy and run binding, monetary budget manager, orchestration store, and orchestration engine. It proves first launch, exact replay without repeated observation/authorization/preparation/reservation/launch, immutable attempt-selection creation, rollback of claim/reservation/activity/selection/write lease after synchronous preparation failure, and unavailable-candidate denial before authorization or launch.

Revision 1 passed build and 22 tests but its preparation rollback assertion relied only on engine-owned claim/lease effects. Revision 2 adds an artifact write inside `prepareExecution` before the injected failure, proves the artifact and workspace lease persist on the successful/replayed attempt and both roll back on failure, and counts one reservation callback across exact replay.

Final gate: daemon build exit 0; 3 test files, 22 tests passed, exit 0. Raw output and exit markers are in `logs/`.

## Proposed next API

Add a single immutable run-bound initial-default record rather than a global strategy registry. Public host/store input should bind `{version:'cue-initial-default-v1', runId, policyId, policyRevision, policyDigest, defaultCandidateId, conservativeEstimate, source, boundAtMs}` before approval/first attempt. The estimate must contain known quality, conservative cost and time bounds, matching currency, provenance and freshness.

The engine may accept an optional own-data observation `{version:'cue-initial-observation-v1', candidateId, disposition:'no-statistics', source, observedAtMs}`. Only an exact configured candidate with a null empirical estimate may receive the configured baseline. Existing non-null estimates are never overwritten; stale, low-quality and wrong-currency values retain the v1 selector result, while unknown bounds remain excluded whenever the corresponding policy limit requires them. All six checks, pin, forced recovery, task/plan allowlists, cost/time/quality filters remain in the existing selector. A configured run with a null/absent hook uses legacy selection and records a durable ordinary marker; a run without config keeps exact historical semantics. Paid exploration stays outside this layer for a later separately authorized run-level subcap store.
