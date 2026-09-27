# S3 explicit staging authority: first wired slice

## Outcome

Implement one bounded capability: an implementation attempt may launch in an isolated execution root while its workflow lease, native journal, and final publication remain bound to the approved publication root. The capability is explicit, durable, attempt-bound, and absent by default.

This slice wires the driver with an injected trusted staging factory. A production Git-worktree factory is a follow-up. Normal writable runs keep current same-root behavior. Isolated execution without the injected factory fails before filesystem mutation or launch. Dirty roots, reparse points, caller-supplied staging paths, and unproved cleanup are unsupported.

Done means focused offline suites, retained regressions, and `npm run build` pass and prove: create once; host owner/stage use the execution root; capture/publication use the publication root; exact approval/plan/policy/candidate/subject/root lineage is durable; replay creates and launches zero more times; cleanup unknown retains the lease. Providers, billing, model quality, port 8085, and unknown Codex SHA remain outside this slice.

## Existing split

`stage-envelope.ts` currently normalizes the requested stage and calls `envelopeHash(stage)` before its transaction, then returns `owner.cwd === stage.worktree_realpath`. `host-codex-runtime.ts` already uses `owner.cwd` for AppContainer work and snapshots, so it needs no edit.

The driver registers `change_root_contract`, `change_target_contract`, `workspace_write_lease`, and `orchestration_attempt.worktree_realpath` against `run.envelope.worktree_realpath`. These remain the publication root. Only the child stage envelope and owner cwd use the execution root.

## Migration 047: four-table model

Add `daemon/migrations/047_attempt_staging_authority.sql`, loaded by `daemon/src/ledger.ts` with migration-046-style partial-install refusal and canonical definition comparison. All four tables are append-only and have strict payload/hash, no-update, no-delete, and no-replace triggers. `run_staging_authority` records an immutable enabled or disabled decision for every newly prepared run before approval; enabled rows bind the exact run/envelope/plan/policy, factory protocol/hash, publication native identity, clean HEAD/snapshot, and target-contract digest. An approved disabled row cannot later be upgraded, and legacy approved runs without this record cannot acquire isolated execution authority.

1. `attempt_staging_setup`

```text
setup_id TEXT PRIMARY KEY
attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id)
run_id TEXT NOT NULL
task_id TEXT NOT NULL
candidate_id TEXT NOT NULL
publication_worktree_realpath TEXT NOT NULL
publication_volume_serial TEXT NOT NULL CHECK(length(...)=16)
publication_file_id TEXT NOT NULL CHECK(length(...)=32)
base_commit_id TEXT NOT NULL CHECK(length(...) IN (40,64))
clean_snapshot_sha256 TEXT NOT NULL CHECK(length(...)=64)
expected_subject_digest TEXT NOT NULL CHECK(length(...)=64)
factory_protocol TEXT NOT NULL CHECK(factory_protocol='cue-attempt-staging-factory-v1')
factory_sha256 TEXT NOT NULL CHECK(length(...)=64)
created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0)
payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(...)=64)
payload BLOB NOT NULL
FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
```

Insert immediately after claim and before `factory.create()`. Its guard joins attempt, attempt selection, `orchestration_account_identity` on run/candidate, parent run/envelope, change root, and live lease. Publication path must equal attempt, envelope, change-root, and lease paths; native identity/protocol must equal the change root; attempt/step must be running and lease acquisition must match. `json_extract(orchestration_account_identity.payload,'$.subjectDigest')` is the authoritative prelaunch subject and must equal `expected_subject_digest`. The account payload's plan/policy/envelope digests must match persisted records. No fourth subject table is needed.

2. `attempt_staging_authority`

```text
attempt_id TEXT PRIMARY KEY REFERENCES attempt_staging_setup(attempt_id)
stage_envelope_hash TEXT NOT NULL UNIQUE REFERENCES orchestration_stage_envelope(stage_envelope_hash)
parent_envelope_hash TEXT NOT NULL
plan_digest TEXT NOT NULL CHECK(length(...)=64)
policy_digest TEXT NOT NULL CHECK(length(...)=64)
execution_worktree_realpath TEXT NOT NULL UNIQUE
execution_volume_serial TEXT NOT NULL CHECK(length(...)=16)
execution_file_id TEXT NOT NULL CHECK(length(...)=32)
activated_at_ms INTEGER NOT NULL CHECK(activated_at_ms>=0)
payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(...)=64)
payload BLOB NOT NULL
```

The FK explicitly targets unique `attempt_staging_setup(attempt_id)`. Its guard joins setup, stage envelope/run/envelope, parent approval, plan/policy, attempt, and lease. It requires exact attempt, hashes, digests, paths, and live publication lease; no cleanup may exist. Execution and publication roots must differ by case-folded canonical path and native identity.

3. `attempt_staging_cleanup`

```text
attempt_id TEXT PRIMARY KEY REFERENCES attempt_staging_setup(attempt_id)
result TEXT NOT NULL CHECK(result IN ('create_failed_verified','create_unknown','active_cleanup_verified','active_cleanup_unknown'))
observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0)
evidence_sha256 TEXT NOT NULL CHECK(length(...)=64)
payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(...)=64)
payload BLOB NOT NULL
```

This references setup, so creation failure terminates without authority. `create_*` is legal only without authority; `active_cleanup_*` only with authority. Verified payloads require `rootAbsent:true`, `metadataAbsent:true`, and exact setup/factory identity. Unknown requires an explicit reason and never allows lease release. Missing cleanup after restart is unresolved and forbids another create. All results are terminal and immutable.

## Non-circular insert order and exact hash trace

Add `daemon/src/orchestration/staging-authority.ts`, a narrow coordinator over injected `inspectCleanRoot`, `create`, `inspectRoot`, and `cleanup`; configuration never supplies a raw execution path.

1. `prepare()` inspects the publication root. Accept only exact clean tracked/untracked/index status, 40/64-hex Git object ID, stable native identity, and reparse-free observation. Modified, staged, untracked, conflicted, detached/unborn, ambiguous, or unparsable states fail.
2. After claim/lease, `prepareExecution()` rechecks that snapshot and inserts setup before calling create.
3. Factory returns a new canonical execution root, native identity, and provenance. Reject same/case-alias/contained/native-alias/reparse roots and record a `create_*` terminal observation.
4. Export one pure `normalizeStageEnvelope(attemptId, stageRequest)` helper from `stage-envelope.ts`. Both coordinator and binder call it; it performs current strict validation/normalization and returns `{envelope,envelopeHash}`. Thus the stage hash has one computation path.
5. Call `binder.bind({...request, stagingSetupId, stagingRootIdentity})`. In the existing immediate transaction, repeat current checks, validate setup, insert stage task/envelope/run and `orchestration_stage_envelope`, then insert `attempt_staging_authority` with the precomputed hash. SQL can now join the stage row, and commit is atomic. If authority insertion fails, the stage transaction rolls back; coordinator cleans by returned identity and records `create_failed_verified` or `create_unknown` against setup.
6. `read()` validates the persisted stage as today, then requires matching authority and no cleanup. It returns `publicationWorktreeRealpath` from setup and owner cwd from stage. Legacy rows without setup retain current containment and expose no isolated-root capability.

The binder waives only parent/scope filesystem containment for this exact setup. Actions, egress, role, autonomy, expiry, approval, revision, candidate, and permission-subset checks stay unchanged. Scope still authorizes publication root and exact targets; the sibling execution root is not another publication scope.

## Driver wiring and ownership

Edit only `app/orchestration-driver.mjs`, `daemon/src/orchestration/stage-envelope.ts`, the new coordinator, migration 047, `daemon/src/ledger.ts`, and focused tests. Do not edit `recovery.ts`, `host-codex-controller.ts`, `integration-executors.ts`, `host-codex-runtime.ts`, or current restart fixtures owned elsewhere.

- `prepare()` accepts `executionStaging` only with `stagedPublication:true`, exact targets, and injected factory identity/protocol. It performs clean preflight. Without the option behavior is unchanged.
- `prepareExecution()` performs setup/create/bind above. Unresolved create blocks and retains lease.
- `recordLaunchIntent()` requires catalog digest, account payload subject, and setup subject to match. Use `binding.publicationWorktreeRealpath` for `captureChangeSet` and staged-publication contract; candidate launch keeps stage binding/owner and therefore execution root.
- After successful host completion, publish first, then identity-bound cleanup. Only committed publication plus `active_cleanup_verified` permits receipt/attempt completion and lease release. Contention/unknown, cancellation, crash, absent cleanup, or cleanup unknown blocks and retains lease. Immutable publication prevents replayed writes.
- Reopen with setup never calls create again. This slice reports unresolved ownership and adds no automatic resume/cleanup authority.

## Offline gates

Add:

- `integration-staging-authority-migration-definition.test.ts`: canonical reopen, partial/altered refusal, payload/FK guards, setup-before-authority, authority requires stage row, four cleanup classes and illegal combinations, immutability.
- `integration-stage-envelope-staging-authority.test.ts`: helper/binder hash equality; sibling succeeds only atomically; absent/mismatched/cleaned setup refuses; approval/plan/policy/revision/candidate/permission/expiry/root/subject drift refuses; legacy containment stays closed.
- `integration-driver-staging-authority.test.ts`: create once; launch sees execution root; capture/contract/publication see publication root; reopen side-effect counts zero; dirty/reparse/alias/identity drift refuse before launch; subject drift refuses; committed+verified cleanup completes/releases; create/cleanup unknown blocks/retains; stage transaction failure records one cleanup.

From `daemon/`:

```text
npx vitest run test/integration-staging-authority-migration-definition.test.ts test/integration-stage-envelope-staging-authority.test.ts test/integration-driver-staging-authority.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
npx vitest run test/integration-stage-envelope.test.ts test/integration-driver-publication.test.ts test/integration-publication-migration-definition.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

An independent checker inspects SQL guards and driver arguments and records current hashes, command/exit status, both roots/identities, lease rows, and create/cleanup/launch/capture/publication counts. Cap implementation at three passes; change hypothesis after a failed pass.

## Follow-up: production factory and Windows qualification

Implement the production Git-worktree factory separately after this slice. Its cleanup receipt must prove both root absence and Git administrative metadata absence. Then run a harmless owned temporary clean repository through the compiled factory on Windows. Verify distinct file IDs, no reparse traversal, execution-root-only writes before publication, exact target publication, host cwd equal to execution root, restart creates no second root/write, and root plus Git metadata are absent before lease release.

## Remaining risks

- External writers can dirty publication root after preflight. Recheck snapshot/identity before launch and rely on migration 046 target preimages at publication.
- Persist exact Git 40/64-hex object ID and separately SHA-256 the canonical inspection payload.
- Multi-target publication remains sequential, not group-atomic; any unresolved target retains the lease.
- Crash after setup without cleanup is deliberately unresolved. Startup must not infer absence, recreate, or release; later recovery consumes the durable setup evidence.
