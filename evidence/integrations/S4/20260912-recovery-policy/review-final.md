# S4 Unit 1 independent final review

Date: 2026-09-12

Verdict: **FINAL BLOCKED**

The initial implementation and both authorized correction passes have been consumed. A third correction is forbidden by `DONE-CONTRACT.md`; the remaining failures are preserved rather than renamed or moved into Unit 2.

## Independent final gate

From `daemon` I ran:

```powershell
npm run build
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-evidence-policy.test.ts test/integration-retry-backend.test.ts test/integration-requirements.test.ts test/integration-acceptance.test.ts test/integration-generated-acceptance-host.test.ts test/integration-driver.test.ts test/integration-handoff-activity.test.ts test/integration-handoff-integrity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

Build and TypeScript passed. The expanded focused run passed 99/102 tests and failed three:

1. `integration-generated-acceptance-host.test.ts`: the explicit revision-one producer/checker path fails `generated_checker_response_missing`. `launchVerifier` now carries the exact stage revision, but `generated-output.ts` still rejects the revision-one output because the approval-time target retains the original plan digest. This proves the real generated acceptance path cannot complete revision one.
2. `integration-retry-backend.test.ts`: the compiled legacy helper progresses past the 036-table check but then queries absent `orchestration_handoff`, failing `no such table: orchestration_handoff`. Legacy 016-era behavior is not preserved.
3. `integration-retry-backend.test.ts`: the separate-connection consume-once test fails `database is locked` instead of producing exactly one successful claim and one `retry_previous_consumed`. The concurrent final-slot/replay property remains unproven.

The scoped `git diff --check` produced no errors. Build deployed migration `036` is byte-identical to source:

```text
82ffca12c48c65d17d5a48deab7a7377a2877a868f147817cc021af6d8809826  daemon/migrations/036_s4_recovery_revision.sql
82ffca12c48c65d17d5a48deab7a7377a2877a868f147817cc021af6d8809826  daemon/dist/migrations/036_s4_recovery_revision.sql
```

The focused integration fixtures repeatedly opened current ledgers and the 033 handoff-integrity regression suite passed 4/4. My first dedicated temporary-ledger command was rejected before execution because its cleanup command did not pass the command safety gate; that rejection remains part of the review history.

Root subsequently completed a separate independent audit from `daemon` using a unique `mkdtemp` directory and exact, non-recursive cleanup of `audit.sqlite`, `audit.sqlite-wal`, and `audit.sqlite-shm`, followed by removal of the verified-empty audit directory. The command imported `./dist/src/ledger.js`, created the file ledger, closed and reopened it, and exited 0 (`chunk 3bce25`). Its measured output was:

```text
{integrity:[{integrity_check:'ok'}],foreignKeys:1,violations:[]}
exact owned files removed; empty audit directory removed
```

This credits the required reopen, `PRAGMA integrity_check`, enabled foreign keys, and empty `PRAGMA foreign_key_check` audit. It does not change the blocked verdict caused by the three reproducible test failures.

## Final source hashes

```text
3d64515bd8a5ab56729034ab56293da17845752451b3dbec2a7e3e556beaa63e  daemon/src/orchestration/recovery-policy.ts
1551ccedfc136064794d549457bcac35280d23a6fa601cacaf23a593081da3b4  daemon/src/orchestration/store.ts
c9bd68ee47ec76c577635bfa2ffc0cbc99eef836625abd0403b0a272d9271633  daemon/src/verification/generated-acceptance-host.ts
18a7662563cca92fe8fbf50e5c1a7fb103f47edee657771270fd9dff0dc49182  daemon/src/verification/generated-output.ts
b2e0f17d38569ffebdc382ebcfdb6381a309e200e4628ef1e5ceb6b5b575fd7b  daemon/test/integration-generated-acceptance-host.test.ts
c75f565015ceec535a57859bd3b580a9dde65944a80f13aa94b0c097818c5406  daemon/test/integration-retry-backend.test.ts
82ffca12c48c65d17d5a48deab7a7377a2877a868f147817cc021af6d8809826  daemon/migrations/036_s4_recovery_revision.sql
```

## What is proven

The final bytes materially improve the unit: driver switch, quota-delay, and ordinary revision-one claim/stage/finish/acceptance tests pass; scalar/payload guards and exact S3 integrity checks are present; old revision steps are superseded; cumulative monetary/local summaries are consulted; source revision and producer/checker independence are frozen and rechecked; 033 handoff integrity remains green. These passing facts do not close Unit 1 because the generated revision-one runtime path and two required retry compatibility/concurrency paths remain red.

The reentrant final-budget-slot ordering was changed in correction 2 so host time is sampled before the terminal/attempt/budget snapshot. No dedicated mutation counterexample was added before the cap, so this property remains unproven rather than counted as a fourth reproduced failure.

Checklist lines 158, 161, and 163 must remain open. S5 measured-facts containment remains blocked/quarantined, and no Core, model, native provider, Electron, network, or paid call was used by this review.
