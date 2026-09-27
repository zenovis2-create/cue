# Native journal wiring plan

Date: 2026-09-12 KST  
Status: design only; product edits require root authorization after native-helper review

## Done contract

Done for this design means an exact file/seam map for persisting the approved native root identity and replacing the pathname-based snapshot in capture and observation, plus runnable negative tests that prove the journal is connected to the launch lifecycle. Design attempt cap: 1. This file is the only mutation. Restore and SQL `pass` remain disabled.

## Minimum seam

### 1. Persist the approved root identity

Add an append-only `daemon/migrations/038_s4_native_change_journal.sql`; do not rewrite the deployed/reviewed migration 037. Migration 038 adds one immutable `change_root_contract` row per `(run_id, task_id)` rather than duplicating identity on every target:

```text
run_id, task_id                    primary/foreign key to orchestration_step
worktree_realpath                  exact approved canonical root
volume_serial                      16 lowercase hex
file_id                            32 lowercase hex
snapshot_protocol                  cue-change-snapshot-v1
snapshot_helper_sha256             64 lowercase hex
observed_at_ms                     trusted host time
payload_sha256, payload            canonical immutable contract
```

The insert trigger must bind every scalar to the hashed payload; require an existing original run envelope whose case-folded `worktree_realpath` equals the contract root; require at least one matching `change_target_contract`; and reject insertion after any accepted approval or attempt for the run. It must not require an orchestration stage envelope, because stage binding correctly occurs only after approval inside engine start. Update/delete triggers keep it immutable. Migration 038 cannot add a SQLite foreign key to the existing `change_set` without rebuilding migration-037 tables, so add immutable `change_native_binding` keyed by `change_set_id`, with foreign keys to both `change_set` and `change_root_contract`, carrying the same volume serial, file ID, protocol, helper digest, and hashed canonical payload. Its insert trigger compares run/task through both parents and requires the change set's launch/stage/lease lineage already accepted by migration 037. `captureChangeSet` inserts the change set, entries, and native binding in the same immediate transaction. Migration 038 also records every preexisting change set/attempt in a closed immutable legacy table with reason `legacy-native-journal-unavailable`; those rows gain no root authority and cannot be replayed as native-journal captures.

Add a narrow registration function in `daemon/src/change-records.ts` (or a same-module store) that accepts the already validated run/task/original-run root plus trusted time, calls `identifyChangeSnapshotRoot`, reads the host-owned helper identity from `change-snapshot-host.ts`, and inserts the root contract. Call it from the same preapproval preparation path that registers `change_target_contract`; do not accept volume/file IDs or helper paths from UI/request DTOs. If the current configuration has no target-contract registration seam, add one host-only preparation method beside requirement/generated-target binding and invoke it after plan/orchestration-step installation but before approval. The later stage envelope must independently resolve to the same persisted root identity during capture. An absent target declaration leaves journal launch unavailable rather than inferring broad workspace coverage.

`daemon/src/change-snapshot-host.ts` needs only a frozen metadata accessor returning the fixed protocol and import-time helper SHA-256. It must never expose an executable override. Registration fails closed when `identifyRoot` is unknown/unavailable or when helper identity cannot be published.

### 2. Replace Node capture/observe snapshots

In `daemon/src/change-records.ts`, remove production use of `lstatSync`, `realpathSync`, pathname `openSync`, `statSync`, and `readRegular` from `snapshot`. Keep lexical relative-path validation. Load the immutable root contract and exact target rows, then call `snapshotRelativeNative` once with:

- the persisted root path;
- persisted `{volumeSerial,fileId}` as `expectedRoot`;
- the canonical ordered complete target list;
- the already approved common per-target byte cap, while preserving the 16 MiB aggregate host limit.

Capture must require an `ok` batch with the same returned root identity and one result per ordered target. Map `ok` to a file snapshot using the helper bytes/hash/full file ID and map `absent` to the existing absent form. Any `unknown`, `unavailable`, protocol mismatch, root mismatch, nonregular/reparse/sparse/hard-link result, or over-cap condition aborts the entire prelaunch transaction and writes no `change_set` or `change_entry`. The helper’s full identity becomes `fileIdentity`; do not narrow it back to Node `dev:ino`. `comparisonHash` is the helper SHA-256, removing the injectable production hash/collision hook; collision tests should mutate stored bytes or use a test-only host seam instead.

Observation reloads the root contract by the change set’s bound keys and invokes the same native batch with the persisted expected root. A valid batch produces one observation per entry in a single immediate transaction. Per-target or batch uncertainty writes a complete same-time set of `unknown` observations, without pathname fallback, so held recovery sees explicit non-current facts. Observation must reject a sealed/reconciled held case and must not partially append a subset. Keep `observed_bytes` bounded and payload-bound as migration 037 already requires.

Restore remains unchanged: no host means `atomic-race-closure-unsupported`; the native snapshot helper supplies no replace/remove CAS and must not be adapted into `AtomicRestoreHost`. `verification_pass_disabled` remains installed.

### 3. Connect the real launch lifecycle

Use the existing synchronous transaction in `app/orchestration-driver.mjs`:

1. In `recordLaunchIntent`, after `store.handoffActivity.recordLaunchIntent` succeeds, read the stage binding and immutable target/root contracts and call `captureChangeSet`. Because `recordLaunchIntent` already executes inside `engine.start`'s immediate prelaunch transaction, any native snapshot failure rolls back claim, reservation, stage binding, launch intent, and change journal before `runtime.start` can run.
2. On replay, require the existing attempt’s unique `change_set`; compare its payload lineage/target/root contract to the replay request and do not capture again.
3. Immediately after `entry.handle.reconcile()` returns a terminal receipt, call `observeChangeSet` before retry scheduling, completion acceptance, or clearing `entry.request`. If observation is unknown or incomplete, hold/block the attempt and do not advance. A repeated reconciliation must reuse or explicitly supersede the same-time observation contract; it must not silently create a contradictory “latest” tie.

No change is needed in `integration-runtime.ts`: lifecycle already calls the host launch only after the engine’s prelaunch transaction commits. A small driver helper may centralize change-set lookup, but a second engine journal interface would duplicate the existing transaction seam.

### 4. Build/package the helper as a required asset

Update `daemon/scripts/copy-assets.mjs` and the daemon build contract so migration 038 and the reviewed `daemon/native/change-snapshot/change-snapshot.exe` are copied to deterministic runtime asset locations used by the ledger and `change-snapshot-host.ts`, and fail the build if its SHA-256 differs from the checked manifest. Do not compile or download native code implicitly during application startup. Source-tree tests may use the source asset; compiled tests must resolve the copied asset, proving production lookup rather than accidentally falling back to the developer tree.

## Required negative tests

Extend `daemon/test/integration-change-records-native.test.ts`, `integration-change-records.test.ts`, and the real driver regression (currently `integration-driver.test.ts`):

- root contract rejects caller-supplied/fake identity, helper digest drift, wrong run/task/root, postapproval registration, update/delete, and legacy attempts;
- capture rejects root replacement after approval, junction/ancestor swap, target replacement during read, target order/count mismatch, missing contract, cap overflow, sparse/hard-link/nonregular target, helper timeout/malformed output, and writes zero journal/claim/reservation/launch rows on failure;
- successful driver start has exactly one change set before the candidate launch callback observes control; replay creates neither a second set nor another native capture;
- terminal reconciliation records every ordinal before retry/acceptance; helper/root uncertainty records a complete unknown observation set and prevents retry/acceptance advancement;
- observation cannot use Node fallback, cannot append partial coverage, cannot create ambiguous equal-time latest rows, and cannot append after held final seal;
- compiled-build test temporarily removes/changes the source helper while proving the compiled host resolves the copied reviewed asset; missing/hash-mismatched asset fails closed;
- `restoreStoppedChangeSet` without an atomic host still returns `atomic-race-closure-unsupported`, and direct SQL `pass` remains rejected by `verification_pass_disabled`.

Focused gate after authorization:

```powershell
npx --no-install vitest run test/integration-change-records-native.test.ts test/integration-change-records.test.ts test/integration-driver.test.ts test/integration-held-recovery.test.ts test/integration-verification.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
git diff --check -- migrations/038_s4_native_change_journal.sql src/change-snapshot-host.ts src/change-records.ts scripts/copy-assets.mjs ../app/orchestration-driver.mjs test/integration-change-records-native.test.ts test/integration-change-records.test.ts test/integration-driver.test.ts
```

This is an incremental journal integration only. It creates an honest prelaunch preimage and post-terminal observation through the reviewed read-only native helper. It does not implement automatic restore, conditional replacement, executor recovery, or verification/acceptance pass authority.
