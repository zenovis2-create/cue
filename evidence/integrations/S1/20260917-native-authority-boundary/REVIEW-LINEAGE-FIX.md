# Independent adversarial review — 039/050 session-handle lineage correction

Reviewer: independent (did not author the change). Adversarial goal: prove or disprove that the
039/050 lineage correction weakened any check, and whether the in-place upgrade path can launder a
tampered trigger. Windows 11 / PowerShell. All SQL results below are reproduced tool output from a
real `openLedger()` ledger built from the packaged migrations. Probe scripts were created outside
the checkout (`C:\Users\User\cue-review-tmp\`, since deleted) and consumed the compiled
`dist/src/ledger.js`; no project file was mutated in place.

## Verdict summary

- All six pins MATCH on disk (see Q5). Build, targeted vitest and tsc all exit 0.
- **Q1 (lineage strength): NOT weaker.** The new stage-envelope join is at least as tight as the
  old plan-task-id join and is strictly more specific. Cross-attempt handle, wrong-run, wrong-task,
  and the old plan-task-id handle shape are ALL rejected with `native_runtime_receipt_lineage` in
  executed SQL.
- **Q2 (launder): 050 cannot be laundered; 039 has an ASYMMETRIC GAP (OPEN FINDING).** A weakened
  050 guard is either silently restored from the packaged file and then re-verified by an exact
  definition comparison, or caught by that comparison / the guard-count check. Migration 039's
  `readonly_verifier_identity_lineage` has NO definition comparison and NO guard-count check: a
  tamper that avoids the `h.task_id=a.task_id` fragment — including outright deletion of the
  trigger — survives reopen undetected.
- **Q3 (fixtures): do NOT fabricate a load-bearing fact.** All three corrected fixtures now bind the
  session handle to the stage task id (`owner.task_id`), matching the binder/launcher shape.
- **Q4 (stopProcessTree 5s→60s): safe.** No caller depended on 5s as a semantic assertion.
- **Q6 (honesty): DECISION-050-LINEAGE.md and RESULTS increment-2 are largely accurate.** One
  material understatement: neither document discloses that migration 039's lineage trigger is
  unguarded against arbitrary tamper (Q2b).

Overall: the correction is sound and not weaker. The single blocking-grade item is the pre-existing
039 tamper-detection gap the correction did not introduce but also did not close while it hardened
050. See the final REVIEW verdict.

---

## Environment / pins (Q5, part 1)

`npm run build` → exit 0. Compiled `dist/src/ledger.js` used by the probes.

SHA-256 of the six pinned files, verified against disk (recomputed after all probes and after
cleanup):

    MATCH  daemon/migrations/039_readonly_verifier_identity.sql   00318a836135a18a18d635c62e3a0ca56044daf109807357253c94e067bde50f
    MATCH  daemon/migrations/050_native_runtime_receipt.sql       f4d079c128911cce599a2ae98bf3c4a442f5ae79b4981bff04780e3af9e9fed1
    MATCH  daemon/src/ledger.ts                                   03f79d3b056ee15518267b4f097b443ec6584164cf904de3c6a44bbfde0ed4c2
    MATCH  daemon/scripts/process-lifecycle.mjs                   237b46f134b0670dd1ad5c59bd21e6a41f244fac93aabc17c9961df6b5d79ac3
    MATCH  daemon/src/verification/native-existing-file-acceptance-host.ts       48df00cf4b6344dad78b360657f4aae5640731b3553fec3f62200d44b584ba1b
    MATCH  daemon/test/integration-native-existing-file-acceptance-host.test.ts  db64b747f7222309d5e39d0dedb5242107c18945a0246cca3d384ed551a7b371

## Cited full-suite numbers (not reproduced, per scope)

Summary lines read directly from the two logs:

- `lineage-npm-test.log` (author): `Test Files  270 passed (270)` · `Tests  1788 passed | 10 skipped (1798)` · exit 0.
- `audit3-npm-test.log` (prior reviewer): `Test Files  2 failed | 268 passed (270)` · `Tests  2 failed | 1786 passed | 10 skipped (1798)`. Per task context the two failures were declared-timeout overruns, since fixed. I did not re-run the full suite (idle-deadline risk).

---

## Q1 — Is the new lineage clause weaker? NO.

### Schema evidence (migration 012)

`orchestration_stage_envelope` (012_stage_envelope.sql):

    attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),
    ...
    stage_task_id TEXT NOT NULL UNIQUE REFERENCES task(id),
    stage_run_id  TEXT NOT NULL UNIQUE REFERENCES run(id),

So `attempt_id` is **PRIMARY KEY** and `stage_task_id` is **NOT NULL UNIQUE** (Q1c confirmed).
`session_handle` (001_init.sql): `handle TEXT PRIMARY KEY, ... task_id ... , run_id ...`.

### The two clauses

Old (both 039 and 050):

    JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=a.attempt_id AND h.task_id=a.task_id

New (both 039 and 050, verbatim on disk):

    JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id
    JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=e.attempt_id AND h.task_id=e.stage_task_id

### Executed SQL probes (real ledger, `native_runtime_receipt` insert guard)

Setup per attempt: real `task`/`envelope`/`run`/`orchestration_plan`/`orchestration_step`/
`orchestration_attempt` rows, an `orchestration_stage_envelope` row with
`stage_task_id = stage-task-<sha256(attemptId)>`, and a `session_handle` bound to that stage task id
(`task_id = stage_task_id`, `run_id = attemptId`) — i.e. the binder/launcher shape. Each negative
case uses its own fresh attempt so the *lineage* trigger, not the uniqueness/immutability trigger,
is the rejection reason.

    CONTROL A own-handle correct-lineage:            ACCEPTED
    Q1a receipt for A2 using B handle:               REJECTED -> native_runtime_receipt_lineage
    Q1b right-task WRONG-run:                        REJECTED -> native_runtime_receipt_lineage
    Q1b right-run WRONG-task:                        REJECTED -> native_runtime_receipt_lineage
    Q1-extra plan-task-id handle (OLD shape):        REJECTED -> native_runtime_receipt_lineage

- **Q1a** — a receipt whose lineage is attempt A2 but presenting attempt B's session handle is
  rejected. B's handle joins B's stage envelope (`e.attempt_id=B`), which cannot join
  `a.attempt_id=A2`. REJECTED. ✔
- **Q1b** — right task_id + wrong run_id, and right run_id + wrong task_id, are both rejected: the
  plan-lineage predicate `a.run_id=NEW.run_id AND a.task_id=NEW.task_id` fails to match a real
  attempt, so no join row exists. ✔
- **Q1-extra** — a handle carrying the PLAN task id (`check`, the *old* clause's required shape) is
  now REJECTED, because the new clause requires `h.task_id = e.stage_task_id` and the stage task id
  is `stage-task-<sha>`, not `check`. This is the exact production shape the old clause demanded and
  the launcher never emits — proving the correction fixed a real unsatisfiable constraint. ✔

### Q1c — is the new clause at least as tight?

Yes, and strictly tighter in one dimension:

- `orchestration_stage_envelope.attempt_id` is PRIMARY KEY ⇒ the `JOIN ... e ON e.attempt_id=a.attempt_id`
  yields **exactly one** row per attempt. `e.attempt_id` there equals `a.attempt_id`, so
  `h.run_id=e.attempt_id` is identical to the old `h.run_id=a.attempt_id` — the run-binding term is
  unchanged.
- The old term `h.task_id=a.task_id` bound the handle to the **plan** task id. The new term
  `h.task_id=e.stage_task_id` binds it to the **stage** task id. Because `stage_task_id` is UNIQUE
  and is deterministically derived and owned by the stage envelope row for this exact attempt, the
  new term demands a handle produced for *this attempt's own stage* — a strictly more specific fact
  than "some handle whose task_id equals the plan task id". The old term was not just looser, it was
  unsatisfiable by any launcher-produced handle (Q1-extra). The new clause is therefore at least as
  tight, and materially tighter, than the old.

### Q1d — plan-lineage terms unchanged?

Confirmed by reading both trigger bodies on disk. 050's guard still carries
`WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id AND a.candidate_id=NEW.candidate_id`;
039 still carries `WHERE a.attempt_id=NEW.attempt_id AND json_extract(t.value,'$.id')=a.task_id AND
json_extract(t.value,'$.role')='verifier' AND l.expected_subject_digest=NEW.subject_digest`. Only
the session-handle join changed; the `NEW.*`-to-attempt plan lineage is untouched.

---

## Q2 — Can the upgrade path launder a tamper?

### `triggerStatement` / `upgradeLegacyTrigger` (ledger.ts, read verbatim)

`triggerStatement(migration,name)` finds `CREATE TRIGGER <name> ` (or `<name>\n`), slices to the
next `\nCREATE `, trims, and throws unless the slice ends with `END;`.
`upgradeLegacyTrigger(db,migration,name,fragment)` reads the live trigger SQL from `sqlite_master`;
if it is present AND contains `fragment`, it `DROP`s and recreates it from `triggerStatement`.
Otherwise it is a **no-op** (returns without touching the trigger). Wiring:
- 039 block: `upgradeLegacyTrigger(db, readonlyMigration, 'readonly_verifier_identity_lineage', 'h.task_id=a.task_id')` — no definition comparison anywhere in the 039 block.
- 050 block: `if(installed.n===2) upgradeLegacyTrigger(db, migration, 'native_runtime_receipt_insert_guard', 'h.task_id=a.task_id')`, then a guard-count check (`guards.n!==7`) AND a full reference-schema definition comparison (`native_runtime_receipt_migration_definition`).

### Q2a — weakened 050 guard that STILL contains the legacy fragment

Installed a neutered guard (`BEGIN SELECT 1; -- legacy marker: h.task_id=a.task_id END`) into a real
ledger, closed, reopened via `openLedger`. Verbatim result:

    openLedger REOPEN RESULT: SUCCEEDED
    trigger after reopen (verbatim):
    CREATE TRIGGER native_runtime_receipt_insert_guard BEFORE INSERT ON native_runtime_receipt BEGIN
      SELECT CASE WHEN cue_sha256(NEW.payload)<>NEW.payload_digest THEN RAISE(ABORT,'native_runtime_receipt_digest') END;
      SELECT CASE WHEN cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT) THEN RAISE(ABORT,'native_runtime_receipt_canonical') END;
      SELECT CASE WHEN NOT EXISTS(
        SELECT 1 FROM orchestration_attempt a JOIN orchestration_step s ON s.run_id=a.run_id AND s.task_id=a.task_id
        JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id
        JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=e.attempt_id AND h.task_id=e.stage_task_id
        WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id AND a.candidate_id=NEW.candidate_id
      ) THEN RAISE(ABORT,'native_runtime_receipt_lineage') END;
    END
    contains lineage clause now? true

**Judgement — silent replacement is ACCEPTABLE here.** The replacement text is `triggerStatement`
sliced from the packaged, pinned `050_native_runtime_receipt.sql` (SHA verified), and after the
upgrade the same 050 block builds a fresh in-memory reference from that file and rejects with
`native_runtime_receipt_migration_definition` on any residual mismatch. So the "launder" a tamper
could achieve is exactly "the trigger is restored to the correct packaged DDL and then re-verified"
— it cannot inject a weaker trigger; the only reachable outcome is the correct trigger or a hard
failure. Confirmed by Q2a-bis below: a weakened guard *without* the fragment (so the upgrade no-ops)
is caught by the definition comparison:

    Q2a-bis (weakened 050 guard, no legacy fragment, upgrade no-op):  THREW -> native_runtime_receipt_migration_definition
    Q2a-ter (050 insert_guard DELETED entirely):                      THREW -> native_runtime_receipt_migration_partial

050 is fail-closed on every mutation I tried.

### Q2b — tampered 039 lineage that does NOT contain the fragment (OPEN FINDING)

Installed a neutered `readonly_verifier_identity_lineage` (`WHEN 0 BEGIN SELECT RAISE(ABORT,'never'); END`,
which never fires ⇒ every identity insert passes the lineage check) and reopened. Because the body
does not contain `h.task_id=a.task_id`, `upgradeLegacyTrigger` no-ops. Verbatim:

    openLedger REOPEN RESULT: SUCCEEDED (no throw)
    trigger after reopen (verbatim):
    CREATE TRIGGER readonly_verifier_identity_lineage BEFORE INSERT ON readonly_verifier_identity
        WHEN 0 BEGIN SELECT RAISE(ABORT,'never'); END
    TAMPER STILL PRESENT (unchanged)? true

Extended probes:

    Q2b-bis (weakened 039 lineage, no fragment):   SUCCEEDED; tamper present? true
    Q2b-ter (039 lineage trigger DELETED entirely): SUCCEEDED; lineage trigger present after reopen? false

**Open finding (stated plainly):** migration 039's `readonly_verifier_identity_lineage` is NOT
protected by any definition comparison or guard-count check in `openLedger`. Its only integrity
mechanism is `upgradeLegacyTrigger`, which fires *only* when the live text still contains the
specific legacy substring `h.task_id=a.task_id`. Any tamper that rewrites or deletes the trigger
without that exact substring survives reopen undetected — the identity lineage gate can be silently
neutered on an existing ledger. This is asymmetric with 050, which has both a `guards.n!==7` count
check and a full reference-schema comparison and fails closed on the same mutations. The 039 gap is
pre-existing (the correction inherited it), but the correction hardened 050 without closing the
equivalent hole on 039. Recommended fix: give the 039 block the same guard-count + reference
definition comparison that 044–050 use. Note the DECISION doc acknowledges "Migration 039 has NO
definition comparison" only implicitly via the task prompt; it is not disclosed in
DECISION-050-LINEAGE.md itself (see Q6).

### Q2c — can `triggerStatement` return the wrong text? NO.

Probed the real 039 and 050 files with the exact extractor logic:

    039 readonly_verifier_identity_lineage:  startsWith prefix? true; endsWith END;? true; len=799
    039 readonly_verifier_identity_hash:     startsWith prefix? true; endsWith END;? true; len=207
    039 readonly_verifier_identity_payload:  startsWith prefix? true; endsWith END;? true; len=825
    039 readonly_verifier_identity_session:  startsWith prefix? true; endsWith END;? true; len=536
    050 native_runtime_receipt_insert_guard:          first line = CREATE TRIGGER native_runtime_receipt_insert_guard BEFORE INSERT ON native_runtime_receipt BEGIN
    050 native_runtime_receipt_no_update:             first line = CREATE TRIGGER native_runtime_receipt_no_update BEFORE UPDATE ...
    050 native_runtime_receipt_no_replace:            first line = CREATE TRIGGER native_runtime_receipt_no_replace BEFORE INSERT ...
    050 native_runtime_receipt_migration_no_replace:  first line = CREATE TRIGGER native_runtime_receipt_migration_no_replace BEFORE INSERT ON native_runtime_receipt_migration
    050 insert_guard contains a stray second CREATE TRIGGER? false
    050 insert_guard contains lineage clause? true

The match key is `CREATE TRIGGER <name> ` with a trailing space (or newline), so a prefix-sharing
sibling like `native_runtime_receipt_insert_guard` vs `native_runtime_receipt_migration_no_replace`
is disambiguated by the space after the exact name; the slice terminates at the first `\nCREATE `,
so `insert_guard` does not swallow the following `no_update`. No reliance on statement ordering that
could mis-slice. The `endsWith('END;')` guard rejects a truncated slice.

### Q2d — missing / truncated migration file → fail closed? YES.

    empty/missing-trigger file:   THROWS -> migration_trigger_missing:native_runtime_receipt_insert_guard
    truncated (no END;):          THROWS -> migration_trigger_unterminated:native_runtime_receipt_insert_guard

Both raise; the reopen fails closed rather than installing an empty/garbage trigger.

---

## Q3 — Do the corrected fixtures fabricate facts? NO (load-bearing shape matches the binder).

Reference (binder, `stage-envelope.ts` `bind()`): `stageTaskId = 'stage-task-' + sha256(attemptId)`;
inserts `run(attemptId, stageTaskId, stageHash, 0, createdAt)` and
`orchestration_stage_envelope(attemptId, workflowRunId, planTaskId, stageTaskId, attemptId(stage_run_id), ...)`;
`owner = { cwd: worktree, task_id: stageTaskId, run_id: attemptId }`. Production launcher records the
handle via `session-spawn.ts:8` / `process-launch.ts:105`:
`INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id)` using `owner.task_id` /
`owner.run_id` — i.e. `task_id = stageTaskId`, `run_id = attemptId`.

- **integration-native-runtime-receipts** — inserts `orchestration_stage_envelope('attempt','run','implement',stageTask,'attempt',...)`
  and `session_handle('session',123,'time','C:\stage', stageTask, 'attempt')` where
  `stageTask='stage-task-'+'c'.repeat(64)`. Handle `task_id = stageTask = stage_task_id`,
  `run_id = 'attempt' = attempt_id`. **Matches the binder shape.** The stage task id is a literal
  placeholder rather than the true `sha256('attempt')`, but the receipt/identity lineage only
  requires `h.task_id = e.stage_task_id` — nothing recomputes the hash — so the value is internally
  consistent and not a load-bearing fabrication. Verdict: honest.
- **integration-readonly-verifier-ledger** — fabricates a `stage` object
  `{attemptId:'attempt', owner:{cwd, task_id:'stage-task-ffff…', run_id:'attempt'}, ...}` instead of
  calling the binder, and its mocked `spawnOwned` writes the handle with
  `owner.cwd, owner.task_id, owner.run_id` — **the same columns and the same source as production
  `recordSession`.** The seed's `orchestration_stage_envelope` row carries the same
  `stage-task-ffff…` as `stage_task_id`. So `h.task_id = owner.task_id = stage_task_id` and
  `h.run_id = attempt_id`. `readonly-verifier-worker.ts:29` independently asserts
  `stage.owner.run_id === attemptId`, matching. Verdict: the fabricated `stage.owner` matches the
  binder's real output shape; not inventing a fact the triggers or worker reject.
- **integration-readonly-wfp-diagnostic-authority** — identical construction to verifier-ledger
  (same mocked `spawnOwned` writing the handle from `owner`, same seed stage envelope row). Verdict:
  honest, matches the binder shape.

The `stage-task-ffff…` literal is a cosmetic divergence from the true `sha256(attemptId)` but is
harmless: the only place a stage task id is validated against the attempt id is inside the binder
itself, which these two fixtures deliberately bypass, and no trigger recomputes it. None of the
three fixtures reinstates the previously-blocked plan-task-id handle shape.

---

## Q4 — stopProcessTree 5s → 60s

Definition (`process-lifecycle.mjs:13`): `export async function stopProcessTree(child, timeoutMs = 60_000)`.
The timeout is used only to build the reject message and the timer (`lines 25-26`). Callers (grep):

- `scripts/p10c-manifest-proof.mjs:126` — `await stopProcessTree(child)` — uses the default. The
  raise from 5s→60s only widens its budget; no assertion on the value.
- `test/p10c-manifest-lifecycle.test.ts:37` — `await stopProcessTree(child, 5_000)` — passes its
  own explicit 5s and is unaffected by the default change.
- `test/p12-live-harness.test.ts:32` — asserts the *source* `toContain('await stopProcessTree(child)')`
  (a call-shape assertion with no numeric argument); still satisfied.

**No caller depended on 5s as a semantic assertion.** The change is a harness-budget widening only;
callers needing a tight bound still pass their own. Safe.

---

## Q5 — targeted gates (bounded)

    npm run build                                                                      -> exit 0
    npx --no-install vitest run <9 files> --reporter=verbose --fileParallelism=false --maxWorkers=1
        Test Files  9 passed (9)
        Tests       42 passed | 1 skipped (43)
        exit 0   (Duration 57.90s)
    npx --no-install tsc -p tsconfig.json --noEmit                                     -> exit 0

The single skip is the `skipIf(win32)` non-Windows path in the acceptance-host suite. Six pins
verified MATCH (above), re-verified after cleanup.

---

## Q6 — Honesty of DECISION-050-LINEAGE.md and RESULTS increment-2

- "The lineage clause was the outlier and was corrected in both migrations … the acceptance host's
  receipt now records from the launcher-produced session handle with no hand-made row" — CORROBORATED
  by Q1-extra (old shape now rejected) and Q3 (fixtures bind to the stage task id via owner).
- "full daemon suite is 270/270 files, 1788 passed, 10 skipped, exit 0" — matches `lineage-npm-test.log` (cited, not reproduced).
- "triggerStatement extracts one trigger's exact DDL … upgradeLegacyTrigger drops and recreates it
  only when the live text still contains the unusable h.task_id=a.task_id … Wired into both the 039
  and 050 blocks. 050's reference schema gained orchestration_stage_envelope(attempt_id, stage_task_id)
  so the exact definition comparison still runs" — ACCURATE (Q2a, Q2c, and the 050 reference schema
  in ledger.ts includes `orchestration_stage_envelope(attempt_id TEXT PRIMARY KEY,stage_task_id TEXT)`).
- "a same-name weakened guard still throws native_runtime_receipt_migration_definition rather than
  being silently upgraded" — CORROBORATED by Q2a-bis.
- "join through the stage envelope, which is more specific than dropping the term" — ACCURATE (Q1c).
- **Understatement (material):** DECISION-050-LINEAGE.md documents the 050 definition comparison at
  length but never states that **migration 039 has no equivalent definition comparison or
  guard-count check**, so 039's lineage trigger can be tampered or deleted on an existing ledger
  without detection (Q2b/Q2b-bis/Q2b-ter). The document's framing ("Wired into both the 039 and 050
  blocks") could be read as implying symmetric protection; the protection is asymmetric. This should
  be disclosed as an open finding.
- No false-pass overclaim was found. The gate-behaviour and lineage-tightness claims are accurate
  for what I measured.

---

## Open findings

1. **039 tamper-detection gap (blocking-grade, pre-existing, not closed by this change).**
   `readonly_verifier_identity_lineage` in migration 039 has no `openLedger` guard-count check and
   no reference-schema definition comparison. `upgradeLegacyTrigger` only fires on the literal
   `h.task_id=a.task_id` fragment, so a weakened (`WHEN 0`) or deleted trigger survives reopen
   undetected (Q2b, Q2b-bis, Q2b-ter — verbatim: `SUCCEEDED; tamper present? true` and
   `lineage trigger present after reopen? false`). 050 fails closed on the same mutations. Fix:
   add the 044–050-style guard-count + reference comparison to the 039 block. This is the reason for
   the REVIEW verdict below.
2. **Fixture stage task id is a literal placeholder (non-blocking, cosmetic).** The two mocked
   fixtures and the receipts fixture use `stage-task-ffff…` / `stage-task-cccc…` rather than the
   true `sha256(attemptId)`. Harmless because no trigger recomputes the hash, but a stricter fixture
   would derive it to exactly mirror the binder.
3. **DECISION doc understatement (non-blocking).** DECISION-050-LINEAGE.md does not disclose the
   039 asymmetry described in finding 1.

## Restoration / no-mutation proof

No pinned project file was mutated in place. All Q2 tamper probes operated on throwaway ledger `.db`
files under the OS temp dir via a separate `better-sqlite3` handle; the packaged `.sql` sources and
`ledger.ts` were only read. The six pins were re-verified MATCH after all probes and after deleting
the probe directory `C:\Users\User\cue-review-tmp` (see Q5). `git status` shows no drift attributable
to this review (the pre-existing working-tree modifications all still hash to their approved pins).
The only new file created by this review is this document. Build output under `daemon/dist/` is a
byproduct of the required `npm run build` gate, not a source edit.

REVIEW_BLOCKED
