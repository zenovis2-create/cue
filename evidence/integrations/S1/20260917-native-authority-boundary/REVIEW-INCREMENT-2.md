# Independent adversarial review — native existing-file AcceptanceHost (increment 2, pass 2)

Reviewer: independent (did not author the unit). Adversarial goal: prove or disprove that the
read-only verifier receipt gate is load-bearing and unforgeable, and resolve the author's open
finding that individual-guard necessity was unmeasured. Windows 11 / PowerShell. All numbers
below are reproduced tool output.

## Verdict summary

- Both owned pins match on disk exactly.
- STEP 1 gates reproduced exactly as RESULTS.md claims (6 files / 53+1 / exit 0; tsc exit 0).
- STEP 2 (the point of this review): the receipt gate **as a whole is LOAD-BEARING** — M3 (both
  guards removed) and M4 (`readOnlyVerifierReceipt` neutered) BOTH FAIL the owned suite (2 failed
  each). The three new receipt tests are therefore NOT vacuous. Individually, M1 and M2 each PASS,
  confirming the author's honest finding that the two guards cover each other; neither is isolated
  by a test. That is a NON-BLOCKING coverage note, not a false-pass hole, because M3/M4 fail.
- STEP 3 attacks all fail closed: a forged/hand-written row is rejected by the migration 050
  insert triggers and by `receipts.read()` revalidation; a receipt for a different attempt does
  not unlock the verifier stage; a dropped table yields no principal (not an exception that skips
  the check); role/verificationMode are checked against the STORE-VALIDATED receipt.
- STEP 4 (fixture honesty): **BLOCKING.** The fixture fabricates a session-handle shape that the
  real production launcher never produces. Migration 050's lineage clause requires the receipt's
  session handle to carry the PLAN task id (`check`); the production launcher (`spawnOwned` via
  `stage.owner`) always records the SYNTHETIC stage task id (`stage-task-<sha>`). As wired today
  the real production receipt insert (`integration-executors.ts:237`, `sessionHandle:
  owned.session.handle`) would be REJECTED by the `native_runtime_receipt_lineage` trigger. The
  test only passes because it hand-inserts a second, differently-shaped handle. The gate is real,
  but the receipt it gates on is not demonstrably obtainable through the production path.
- STEP 5 blast radius: only the owned test consumes the factory; full daemon suite 270/270 files,
  1786 passed | 10 skipped, exit 0. No regression; skip count 10 (9 + the one owned non-Windows
  skip).
- STEP 6: RESULTS.md is largely honest; the pass-1 post-mortem is corroborated by source. One
  material understatement: RESULTS.md does not disclose that the receipt lineage the fixture
  builds diverges from the production launcher's session-handle shape (STEP 4).

Overall: REVIEW_BLOCKED (fixture fakes the receipt lineage relative to production).

---

## STEP 1 — reproduced gates and pins

### Owned SHA-256 pins (match RESULTS.md exactly)

    daemon/src/verification/native-existing-file-acceptance-host.ts
      d7138dd051b9d5f95f657c37a523d046ca9dcb786eb75b2f8f876587c10864cc   19102 bytes   MATCH
    daemon/test/integration-native-existing-file-acceptance-host.test.ts
      60be3a0705d2b15c3894968d14127da6a4e5dd526dfea3a5b8352efe2e857993   20644 bytes   MATCH

### Vitest (verbose, --fileParallelism=false --maxWorkers=1), six files as required

    Test Files  6 passed (6)
    Tests       53 passed | 1 skipped (54)
    exit 0

Owned suite alone: 15 tests, 14 passed + 1 skipped. The single skip is the `skipIf(win32)`
non-Windows path.

### tsc

    npx --no-install tsc -p tsconfig.json --noEmit
    TSC_EXIT=0   (no diagnostics)

All reproduced counts match RESULTS.md's increment-2 gate block.

---

## STEP 2 — guard necessity, measured (M1–M4)

Method: the file was copied to a backup pinned at `d7138dd0…`. Each mutation was applied with a
Node script (`readFileSync`/`String.replace`/`writeFileSync`), never PowerShell -replace. After
every mutation the file was restored from the backup and its SHA-256 was re-verified equal to the
pin before the next mutation. Only `test/integration-native-existing-file-acceptance-host.test.ts`
was run each time (verbose, single worker). Baseline: 14 passed | 1 skipped, exit 0.

| # | mutation | result | counts | exit |
|---|---|---|---|---|
| M1 | `principalForAttempt` gate → `return principal;` | PASS | 14 passed \| 1 skipped | 0 |
| M2 | delete `if (!readOnlyVerifierReceipt(stage)) fail('verifier_receipt_missing');` in `collect` | PASS | 14 passed \| 1 skipped | 0 |
| M3 | both of the above removed | **FAIL** | 2 failed \| 12 passed \| 1 skipped | 1 |
| M4 | `readOnlyVerifierReceipt` neutered to `return { outcome: 'succeeded' }` (always truthy) | **FAIL** | 2 failed \| 12 passed \| 1 skipped | 1 |

M3/M4 failing tests (identical for both): the two receipt-necessity tests — "without a verifier
receipt acceptance is never reached" and "a receipt for the wrong verification mode does not unlock
the principal" — both wrongly reach `pass` (`AssertionError: expected 'pass' not to be 'pass'`).

Restoration proof after each mutation and finally:

    RESTORE sha=d7138dd051b9d5f95f657c37a523d046ca9dcb786eb75b2f8f876587c10864cc match=true

Final on-disk SHA-256 of both owned files equals the pins (verified after deleting all temp
artifacts). `git status --porcelain` shows the owned test as untracked (`??`), never modified.

Judgement:
- The receipt gate is **LOAD-BEARING as a whole** (M3 and M4 both FAIL). The three new receipt
  tests are NOT vacuous — this closes the primary risk the task flagged.
- Neither individual guard is isolated by a test (M1 and M2 each PASS). This exactly reproduces
  the author's open finding: `principalForAttempt`'s gate and `collect`'s recheck cover each other.
  NON-BLOCKING: the behaviour (no/ wrong receipt ⇒ never accepted) is proven; only per-guard
  isolation is missing, and there is no false-pass consequence because removing both fails.

---

## STEP 3 — attack the gate (probe test built, run, deleted)

A throwaway probe (`daemon/test/zzz-probe-review2.test.ts`, since deleted) drove the real
`createAcceptanceVerifier`/`principalForAttempt` over a real ledger. Note: `openLedger` auto-applies
migration 050, so "absent table" was simulated by dropping it. All three probes passed (exit 0).

**a. Hand-written / forged `native_runtime_receipt` row → principal?  NO.**
Direct `INSERT` attempts are stopped at the DB boundary by migration 050's BEFORE INSERT triggers:
`native_runtime_receipt_digest` (`cue_sha256(payload)<>payload_digest`), `native_runtime_receipt_canonical`
(`cue_canonical_json(payload)<>payload`), and `native_runtime_receipt_lineage` (attempt/run/task/candidate
must join a real `orchestration_attempt` + `orchestration_step` + `session_handle`), plus the
`session_handle` and `attempt_id` FKs. Even if a row were present, the gate does not trust it: it
calls `receipts.read('cue-native-runtime-receipt:'+digest)`, and the store's `decode`/`validate`
re-checks `sha(payload)===payload_digest`, `canonical(value)===payload`, every column against the
decoded payload, and recomputes `outcome` from role+verificationMode+goalVerification (rejecting a
mislabelled "succeeded"). Probe 3a: the forged inserts throw. Verified.

**b. Receipt for a DIFFERENT attempt/run/task → unlock?  NO.**
`readOnlyVerifierReceipt(stage)` selects by `attempt_id = stage.attemptId` and then requires
`receipt.attemptId === stage.attemptId && receipt.runId === stage.workflowRunId &&
receipt.taskId === stage.taskId`. Probe 3b inserted a valid succeeded read-only receipt for
`attempt-make` (with a lineage-satisfying handle); `principalForAttempt(stage['check'])` returned
`null`. Verified.

**c. Table absent → fail open?  NO.**
With `native_runtime_receipt` dropped, the `db.prepare(...).get(...)` inside `readOnlyVerifierReceipt`
throws and is caught by `catch { return null; }`, so `principalForAttempt` returns `null` and
`collect` throws `verifier_receipt_missing`. Probe 3c: `principalForAttempt` returned `null`,
evaluation never `pass`, finalize `blocked`. Fail-closed, not an exception that skips the check.

**d. `role`/`verificationMode` checked against the STORE-VALIDATED receipt?  YES.**
Both are read from the object returned by `receipts.read()` (`receipt.role !== 'model'`,
`receipt.verificationMode !== 'read-only-result'`), which is the fully re-validated payload, not the
raw SQL columns. The store additionally enforces `outcome === outcome(typed)`, so a row whose stored
`role`/`mode` disagree with its payload is rejected on read. The owned "wrong verification mode"
test (a succeeded `implementation`/`approved-existing-file-change` receipt for the same attempt)
confirms non-`model`/non-`read-only-result` yields no principal.

---

## STEP 4 — fixture honesty (BLOCKING)

Increment 2 added to the owned fixture: `INSERT INTO task VALUES('check', ...)` and
`INSERT INTO session_handle('verifier-session-attempt-check', 4321, 'now', root, 'check',
'attempt-check')` — a handle with `task_id='check'` (the PLAN task id) and `run_id='attempt-check'`.

Migration 050 lineage trigger (`050_native_runtime_receipt.sql:27`):

    JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=a.attempt_id AND h.task_id=a.task_id

with `a` = `orchestration_attempt` where `a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND
a.task_id=NEW.task_id`. For `attempt-check`, `a.task_id` is the plan task id `check` (set by
`store.claim` → `store.ts:258` from `input.taskId`), and `a.attempt_id='attempt-check'`. So the
trigger demands a session handle with `task_id='check'` and `run_id='attempt-check'`.

How the REAL system builds session handles: the production receipt path
(`integration-executors.ts:237`) passes `sessionHandle: owned.session.handle`, where
`owned.session` comes from `launch(db, bound.owner, ...)` → `spawnOwned` → `recordSession`
(`session-spawn.ts` / `process-launch.ts:105`). `bound.owner` is the stage owner, and
`stage-envelope.ts:170` sets `owner: { cwd, task_id: stageTaskId, run_id: attemptId }` where
`stageTaskId = 'stage-task-' + sha256(attemptId)`. `binding()` (`integration-executors.ts:71-88`)
re-asserts `owner.run_id === context.runId` (the attempt id) and copies `owner.task_id` verbatim
from the stage owner. Every production caller uses `stage.owner` this way (confirmed in
`readonly-verifier-worker.ts:29`, `generated-acceptance-host.ts:112`, `generated-model-output.ts:98`).

Consequently the production launcher records a session handle with **`task_id = stage-task-<sha>`,
`run_id = attemptId`** — NOT `task_id = check`. Migration 050's lineage clause (`h.task_id =
a.task_id = 'check'`) would therefore REJECT the real production receipt insert with
`native_runtime_receipt_lineage`. The store's own suite corroborates the contrivance: its fixture
(`integration-native-runtime-receipts.test.ts`) likewise hand-inserts
`session_handle('session', …, 'implement', 'attempt')` — task_id = plan task id — a shape the
launcher never emits.

Judgement: the added `task('check')` row + `verifier-session-attempt-check` handle are **test-only
scaffolding that fakes a fact**. They manufacture a session-handle lineage that the real system does
not produce, so the passing tests demonstrate the gate rejects/accepts against a receipt that, as
currently wired, could not be issued by the production path. This is a lineage mismatch between
migration 050 and the launcher's session-handle contract; increment 2 did not surface it. Whether
the fix belongs in migration 050 (join on the stage task id, as the launcher records) or in the
issuer is out of this increment's owned scope, but the fixture must not paper over it.

`vi.mock` check: the mock replaces only `readIssuedNativeRuntimeEvidence` (the issuer-side
evidence reader). The store's own `recordIssued`/`read` validation (`record`/`array`/`canonical`
integrity, digest, canonical round-trip, recomputed `outcome`, column cross-checks) still runs
against real bytes and the real SQLite triggers. The mock does not weaken the receipt path itself;
it only supplies the evidence object the store then fully validates. Confirmed by STEP 3a (forged
rows still rejected) and by the store suite passing.

---

## STEP 5 — blast radius and full suite

Consumers of `createNativeExistingFileAcceptanceHost` (grep across repo): only
`daemon/test/integration-native-existing-file-acceptance-host.test.ts`. No other test or `src`
file imports it, so the increment-2 production change cannot silently break another suite.

Full daemon suite (`vitest run --reporter=verbose --fileParallelism=false --maxWorkers=1`, log at
`C:\Users\User\cue\audit2-npm-test.log`):

    Test Files  270 passed (270)
    Tests       1786 passed | 10 skipped (1796)
    exit 0
    Duration    ~2437s

Skip count = 10 = the 9 pre-existing environment/platform skips + the 1 owned non-Windows skip
(`test/integration-native-existing-file-acceptance-host.test.ts > without the Windows snapshot
helper the host refuses instead of reporting pass`, present in the log). No regression.

---

## STEP 6 — RESULTS.md honesty

- Increment-2 gate counts "6 passed / 53 passed | 1 skipped / exit 0" and "tsc exit 0" — TRUE
  (reproduced).
- Owned pins + byte counts (19102 / 20644) — TRUE (both match on disk).
- Pass-1 post-mortem: "`stage-envelope.ts:183` already inserts a run row whose id is the attempt id,
  so no extra run row is needed" — CORROBORATED. `stage-envelope.ts` `bind()` executes
  `INSERT INTO run VALUES(?,?,?,0,?)` with `attemptId, stageTaskId, stageHash`. "the real
  requirement is that the receipt's session handle carry the plan task id (`check`) … which needs a
  `task` row for `check`" — CORROBORATED by migration 050's lineage clause. However this same
  post-mortem is the root of the STEP 4 finding: the "plan task id" requirement holds for the
  fixture's hand-built handle but contradicts the launcher's real handle (`stage-task-<sha>`).
- "What increment 2 does NOT prove … I could not isolate the gate's load-bearing property with a
  mutation … the two gates cover each other" — HONEST and now RESOLVED here: the whole gate IS
  load-bearing (M3/M4 fail); per-guard isolation is indeed absent (M1/M2 pass).
- Understatement (material): RESULTS.md presents the added `task('check')`/session handle as the
  natural lineage the receipt needs, without noting that the production launcher records a
  different `task_id` (`stage-task-<sha>`) and that migration 050's lineage trigger would reject the
  real receipt. This should be disclosed as an open wiring gap, not folded silently into the
  fixture. Flagged.
- No false-pass overclaim was found; the gate behaviour claims are accurate for the tested (fixture)
  lineage.

---

## Open findings

1. BLOCKING (fixture / wiring lineage): migration 050's `native_runtime_receipt_lineage` requires
   the session handle's `task_id` to equal the plan task id, but the production launcher records the
   synthetic stage task id (`stage-task-<sha>`). The owned fixture (and the store's own fixture)
   hand-insert a plan-task-id handle to pass; the real issuing path (`integration-executors.ts:237`)
   would be rejected by that trigger. The receipt the gate depends on is not demonstrably obtainable
   in production as wired. Resolve by aligning migration 050's lineage join with the launcher's
   session-handle contract (or the issuer with the trigger), then prove issuance end to end.
2. NON-BLOCKING (coverage): individual guard necessity is not isolated — M1 (`principalForAttempt`
   gate only) and M2 (`collect` recheck only) each pass. The gate as a whole is load-bearing
   (M3/M4 fail), so there is no false-pass consequence; add a per-guard assertion if isolation is
   wanted.
3. NON-BLOCKING (carried from increment 1, unchanged): `ownCodeDigest()` via `import.meta.url`
   yields different principals under `dist` vs vitest source; documented as intended fail-closed,
   still untested across a real build.

No unrestored mutation (both owned files verified at pin; all temp artifacts deleted). No suite
regression. The single blocking item is the fixture/lineage honesty gap in STEP 4.

REVIEW_BLOCKED
