# Independent review — held-recovery admission

## Verdict

**PASS for the bounded recovery decision, replay, replan, and replacement-claim admission paths.** The preserved before-behavior result proves that an open held row previously received `replan`. The frozen implementation now blocks that path before any decision or replacement attempt is inserted.

## Frozen sources

- `daemon/src/held-recovery.ts`: `1636C03619D8FDA330102D2394F720976E0FF93E33AD8A55A52B2420038EE58C`
- `daemon/src/orchestration/recovery-policy.ts`: `06EB66D823B26648CE471F2B5E23A2B95942CF859BD4B36772FFB5855E8EA5CB`
- `daemon/src/orchestration/store.ts`: `1DFBF90935FFCAE35ABEDA888AB6E9D1DEC16E03A4309F757C484A876CFCC2B3`
- focused admission test: `0F63F6FA68F41590515477266A0F49ACDB95E06258AAD741805052FE6A4B8C4F`

## Independent evidence

The focused command passed **2 files, 12/12 tests**:

```text
npx vitest run daemon/test/integration-held-recovery-admission.test.ts daemon/test/integration-recovery-policy.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Scoped `git diff --check` passed. The maker additionally recorded the held/retry backend pair at 12/12 from the required daemon working directory and TypeScript `--noEmit` at exit 0; those two gates were not redundantly rerun by this reviewer. The root-owned shared build remained pending at review time.

## Findings

`readHeldRecoveryDisposition` first invokes the existing payload/column integrity reader and then recomputes the deterministic final seal from exact case ID, revision, state, and reason. Missing rows retain legacy behavior. Open rows throw `recovery_held_open`; unknown, corrupt, or seal-mismatched rows throw `held_recovery_corrupt`; only a valid `eligible-for-disposition` seal admits non-stop recovery. A valid `reconciled-stop` seal sets `policySealed`, producing a stop decision.

Decision issuance snapshots the final host clock after all failure/candidate callbacks, then reads held disposition inside the same immediate transaction before deriving or inserting the decision. The reentrant callback test creates a late held row and verifies no decision insertion. Existing decision replay rechecks disposition before returning, and `appendRevision` rechecks it inside its own immediate transaction before reading or inserting the revision. Thus an eligible decision cannot be replayed or applied after the prior attempt becomes held or reconciled-stop.

The orchestration claim path performs its final disposition read after `authorizeClaim`, retry classification/clock callbacks, retry revalidation, revision checks, and run-state reread. No host callback follows it. It occurs before writer-lease, revision-step, attempt, activation, retry-link, or run mutation. The real store fixture verifies a held row appearing after a valid decision/revision blocks replacement claim and leaves the replacement attempt absent; transactional placement also prevents the downstream mutations.

The focused matrix covers open and callback-created held rows, no-held legacy, valid eligible disposition, valid reconciled-stop, deterministic-seal mismatch, stale decision replay, appendRevision, and direct replacement claim. It uses real migrated temporary SQLite ledgers and production stores with fixture host authority; it performs no native process, model/provider, network, cleanup, or historical gate operation.

## Scope limit

This evidence covers recovery-policy issuance and the orchestration store's decision-backed replacement claim. It does not claim full driver dispatch coverage, renderer behavior, live recovery reconciliation, or native execution. It also does not convert a held row into eligibility; eligibility must already carry the independently produced exact final seal.
