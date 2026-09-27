# Decision: migration 039/050 session-handle lineage vs the launcher — APPLIED

Approved and applied 2026-09-18. Raised by
[increment 2's independent review](REVIEW-INCREMENT-2.md), which blocked a read-only-verifier
receipt gate because the receipt it gates on could not be produced in production. This record
states which side was the outlier, the evidence, and what shipped.

## Outcome

The lineage clause was the outlier and was corrected in both migrations. Verified afterwards:
the acceptance host's receipt now records from the **launcher-produced** session handle with no
hand-made row, and the full daemon suite is 270/270 files, 1788 passed, 10 skipped, exit 0.

Applied pins:

| path | sha256 |
|---|---|
| `daemon/migrations/039_readonly_verifier_identity.sql` | `00318a836135a18a18d635c62e3a0ca56044daf109807357253c94e067bde50f` |
| `daemon/migrations/050_native_runtime_receipt.sql` | `f4d079c128911cce599a2ae98bf3c4a442f5ae79b4981bff04780e3af9e9fed1` |
| `daemon/src/ledger.ts` | `03f79d3b056ee15518267b4f097b443ec6584164cf904de3c6a44bbfde0ed4c2` |
| `daemon/scripts/process-lifecycle.mjs` | `237b46f134b0670dd1ad5c59bd21e6a41f244fac93aabc17c9961df6b5d79ac3` |

## The disagreement

Migrations 039 and 050 carry the *identical* lineage clause:

```sql
JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=a.attempt_id AND h.task_id=a.task_id
```

`a` is `orchestration_attempt`, so `a.task_id` is the **plan** task id (`check`, `make`, …).

## Every other layer uses the stage task id

| layer | file | what it does |
|---|---|---|
| the only place stage bindings are created | `orchestration/stage-envelope.ts:166,169` | `stageTaskId = 'stage-task-' + sha256(attemptId)`; `owner = { cwd, task_id: stageTaskId, run_id: attemptId }` |
| the only place handles are written | `process-launch.ts:105`, `session-spawn.ts:8` | inserts `session_handle.task_id` straight from the owner, i.e. the stage task id |
| the read-only verifier worker | `readonly-verifier-worker.ts:29` | enforces `stage.owner.run_id === attemptId` and nothing about the plan task id; launches with `stage.owner` |
| 039's own TypeScript validator | `readonly-verifier-identity-store.ts:13` | requires `s.run_id !== v.attemptId` to fail, but only `id(s.task_id)` — it **accepts** the stage task id |

So the stage binder produces the stage task id, the launcher records it, the worker validates it,
and 039's own TypeScript layer accepts it. Only the SQL clause in 039 and 050 demands the plan
task id.

## Why the clause is the outlier, not the launcher

1. The plan lineage is *already* pinned by the same trigger:
   `a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id`. The
   session-handle join exists to prove the handle belongs to that attempt's own session, and
   `h.run_id = a.attempt_id` already establishes exactly that.
2. `h.task_id = a.task_id` therefore adds no authority — it only demands a handle shape the
   system never emits.
3. 039 and 050 share the clause verbatim, so it is one idea copied once, not two independent
   designs that happen to agree.
4. Within 039 the SQL and the TypeScript validator contradict each other. One of them is wrong,
   and the TypeScript one matches the launcher.

## Consequence today

Both receipt/identity inserts are only reachable with a hand-written handle. The owned increment-2
fixture did that, which is why it was blocked. The store's own existing suite
`daemon/test/integration-native-runtime-receipts.test.ts` does the same. **No test exercises the
launcher-produced shape**, so this has been latent rather than observed.
## What shipped

Both migrations now join through the stage envelope, which is *more* specific than dropping the
term — it proves the handle belongs to the attempt's own stage using the id the binder creates:

```sql
JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id
JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=e.attempt_id AND h.task_id=e.stage_task_id
```

Supporting changes, all verified:

- `daemon/src/ledger.ts`: `triggerStatement()` extracts one trigger's exact DDL from its own
  migration file, and `upgradeLegacyTrigger()` drops and recreates it **only** when the live text
  still contains the unusable `h.task_id=a.task_id`. Wired into both the 039 and 050 blocks. 050's
  reference schema gained `orchestration_stage_envelope(attempt_id, stage_task_id)` so the exact
  definition comparison still runs.
- Upgrade path: an existing ledger carrying the old trigger is upgraded in place on open instead of
  being refused. New tests cover it — a legacy 050 guard upgrades and then reopens, a legacy 039
  lineage trigger upgrades, and a *same-name weakened* guard still throws
  `native_runtime_receipt_migration_definition` rather than being silently upgraded.
- Fixtures that encoded the unobtainable shape were corrected to the launcher/binder shape:
  `integration-native-runtime-receipts`, `integration-readonly-wfp-diagnostic-authority` and
  `integration-readonly-verifier-ledger` now create a stage envelope row and bind the handle to the
  stage task id. That removes the last places where a hand-made handle stood in for a fact.
- Exposed by the full run, unrelated to lineage: `daemon/scripts/process-lifecycle.mjs`'s
  `stopProcessTree` default was 5s while a real Codex tree took 13.5s and 38.7s to close under
  load, surfacing as an opaque "did not close" error. Raised to 60s as a harness budget; callers
  needing a tight bound still pass their own.

## Independent review, and the finding it forced

[REVIEW-LINEAGE-FIX.md](REVIEW-LINEAGE-FIX.md) returned **REVIEW_BLOCKED**. It confirmed the
correction itself with executed SQL probes:

- The new clause is not weaker. `orchestration_stage_envelope.attempt_id` is a PRIMARY KEY and
  `stage_task_id` is NOT NULL UNIQUE, the run-binding term is identical to before, and the plan
  lineage terms are untouched. Probes rejected a receipt for attempt A using attempt B's handle,
  right-task/wrong-run, right-run/wrong-task, and the old plan-task-id shape — all with
  `native_runtime_receipt_lineage`. Only the correct handle was accepted.
- 050 cannot be laundered. A weakened guard that still contains the legacy fragment is restored
  from the packaged DDL and then re-verified by the exact reference comparison; one without the
  fragment is caught by `native_runtime_receipt_migration_definition`; a deleted guard is caught
  by the trigger-count check. `triggerStatement` has no prefix-collision or ordering bug, and a
  missing or truncated migration file fails closed.
- The three corrected fixtures do not fabricate a load-bearing fact: all bind the handle from
  `owner.task_id`, which is the same column and source production uses.
- `stopProcessTree` 5s→60s is safe; no caller treated 5s as a semantic assertion.

**The blocking finding was mine to own.** This change also edited migration 039, but 039 had no
guard-count check and no reference definition comparison, and `upgradeLegacyTrigger` only fires
when the legacy fragment is present. The reviewer proved that a rewritten (`WHEN 0`) or outright
deleted `readonly_verifier_identity_lineage` therefore **survived reopen undetected** — verbatim:
`SUCCEEDED; tamper present? true` and `lineage trigger present after reopen? false`. The change had
hardened 050 while leaving its sibling silently defeatable, and had not disclosed it.

Fixed: the 039 block in `daemon/src/ledger.ts` now performs the same three checks 050 does — a
3-table install count, a 13-trigger guard count, and an exact reference definition comparison
against a fresh in-memory build of the migration. The reviewer's probes are now regression tests in
`daemon/test/readonly-verifier-migration.test.ts`: a rewritten lineage trigger throws
`readonly_verifier_migration_definition`, a deleted one throws
`readonly_verifier_migration_partial`, and a legacy one upgrades in place and then reopens.

Post-fix pins and verification:

| path | sha256 |
|---|---|
| `daemon/src/ledger.ts` | `6bcfd886c760f508be307ff78f23406620d406859d5b72d1d306c924a85376d0` |
| `daemon/test/readonly-verifier-migration.test.ts` | `ab851cbb1d0c0fbb6a91ca4dc4ad3ddd95e7ff09b22d1bd3d5bb95c597d3292f` |
| `daemon/test/integration-native-existing-file-runtime.test.ts` | `8264208eebf00f83c00e2baafdd883ba45950c558804508b4ff6a1455d05ada2` |

Full daemon suite after the 039 hardening: **270/270 files, 1791 passed, 10 skipped, exit 0**
(`final2-npm-test.log`). The migration SQL pins above are unchanged by the hardening.

## Alternative that was rejected

Having the launcher additionally record a plan-task-scoped handle avoids touching migrations, but
means two handles per attempt with ownership semantics that are undefined today.
