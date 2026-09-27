# Independent S3 stage envelope and preparation hook review

Reviewer /root/contracts_review, 2026-09-11. Verdict PASS for the binder and parent preparation/resolution hook contracts. No remaining blocking finding in the reviewed scope. This is not live stage enforcement or complete application wiring.

Done gate: build exit 0, focused stage/engine/runtime assertions, exact source evidence and scoped diff check. Initial artifact was superseded during writing by the maker's persisted-read extension; this correction records its fresh review/test pass. No source edits, broad suite or live model/process execution by reviewer.

Commands (cwd daemon):

- `npm run build`: exit 0.
- `npx --no-install vitest run test/integration-stage-envelope.test.ts test/integration-engine.test.ts test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 35 passed (9 stage + 9 engine + 17 runtime), duration 1.84 s.
- After the persisted-read extension: `npm run build` exit 0; `npx --no-install vitest run test/integration-stage-envelope.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` exit 0, 10 passed, duration 1.23 s. This is the current stage source/test snapshot in the hash table; unchanged parent hook/runtime snapshots retain the earlier focused results.
- Scoped git diff --check: exit 0.

## Binder properties reviewed

The binder creates actual task/envelope/run rows for the child attempt and returns their matching SessionOwner cwd/task_id/run_id. It does not fabricate session_handle or PID records; those must come from actual owned launch later.

Parent full canonical envelope hash and persisted worktree/egress must match the workflow run, with an accepted approval for that same envelope. Stored plan is revalidated and bound to exact policy digest/revision and claimed task/attempt/candidate lineage. New binding requires active parent/attempt, unexpired envelope and host authorization.

Stage root is canonically contained in parent and applicable host scope grants. Actions and egress cannot exceed either authority; grants for another root cannot donate permissions. Symlink/junction escape is rejected in the real filesystem test. Supervised autonomy cannot expand to bounded, and child expiry cannot exceed parent expiry.

Planner/verifier actions are restricted to read/list/search. Empty-scope model-only binding permits no actions or egress. These are envelope constraints, not proof that a future adapter enforces them.

Canonical replay persists across database reopen without duplicate run creation. Conflicting requests/scope/plan/policy bindings reject. Immutable binding, child/workflow run lineage and bound envelope REPLACE guards preserve identities while allowing legitimate write_in_progress state changes.

The added read(attemptId) validates persisted parent/stage canonical hashes, request provenance and actual child owner/envelope rows, then reuses binding checks with the stored scope snapshot. Missing binding returns null; corrupted stage content rejects. Reopen and enclosing transaction rollback are tested. Reads preserve expired historical expiry and do not invoke fresh authorization or renew the binding.

## Parent hooks reviewed

prepareExecution runs synchronously inside the outer claim/reservation transaction and after reservation. Throwing preparation rolls back claim/reservation/lease and does not launch; replay skips preparation. The required return type is undefined (rather than void, which permits async assignment). Unexpected Promise results are observed and rejected; trusted callbacks must still perform synchronous persistence only.

Runtime resolveCandidate receives candidate ID, execution attempt run ID and role, allowing the host to load per-attempt bindings instead of mutating one shared candidate between concurrent executions. Tests verify the attempt ID reaches resolution. This interface does not itself instantiate the binder or launch a real child.

## Open integration gates

Historical binder replay is marked replayed and is not fresh permission: the replay branch does not re-authorize expiry/active state. Engine replay must not relaunch, and any actual new execution must recheck current envelope and admission.

Parent accepted-approval and scope callbacks must come from host authority. Filesystem layout may change after binding; real launch/enforcement must preserve canonical containment and current authority. Session creation, process ownership/cleanup, atomic binder invocation in the real application prepareExecution callback, migration startup wiring and final UI behavior remain separately verified integration work. Combined component tests are not an end-to-end live OS enforcement proof. User-deferred old binary pin was not inspected or treated as qualified.

## Reviewed SHA-256

| Path | SHA-256 |
|---|---|
| daemon/src/orchestration/stage-envelope.ts | 575E3BC95F39BBDBA37898657A9981B86A1B5540355B435D004EA826E4CDB3DE |
| daemon/migrations/012_stage_envelope.sql | 702B7678A59C48DE49710DDCACF5626A33E9A2796224979E828374E0837DB2A3 |
| daemon/test/integration-stage-envelope.test.ts | ADA4FA726F1804C8A202387085853BBBCE58C8DA311BBF11BBFD18D08F41BC81 |
| daemon/src/orchestration/engine.ts | 2EE778217902AD720843EE38BF9FF875B0ACE3E48FE360E0F056D1F4BEED796F |
| daemon/src/integration-runtime.ts | 8659E9F7D4D9BBF1449AE7AA934E6EAB2C799F6193DE24E9EE3ECFFAF137ACEB |
| daemon/test/integration-engine.test.ts | 841AE8830463E2A3D1B17C46957E8AACA35D8A9F2C33623855AC48E8D2D27FC5 |

