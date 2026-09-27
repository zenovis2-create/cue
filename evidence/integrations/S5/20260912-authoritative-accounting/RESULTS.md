# S5 authoritative accounting implementation result

Date: 2026-09-12 KST  
Status: ready for independent review; this does not approve S5 Unit 1

Implemented the new read-only authoritative accounting store and focused integration test. The store accepts only a run ID and optional stored cutoff, enumerates all bounded database reservations and receipts, derives base/retry/verification from stored original-plan and retry lineage, preserves unverified revision lineage as explicit `unclassified`, and reproduces budget-manager committed/actual behavior with `bigint` decimal output. Local invocation rows remain counts and never become currency totals.

The cutoff digest binds table maxima and bounded inventory hashes. Historical projection excludes current disclosure. The two-connection test appends a newer receipt, observes unchanged historical bytes/digest, and sees only disclosure/fresh capture change. Old-row payload tampering rejects. `SELECT total_changes()` is unchanged across capture.

## Gates

- Focused integration: 3/3 PASS.
- Strict isolated TypeScript check of owned source/test: PASS.
- Owned `git diff --check`: PASS.
- Budget regression: 8 deterministic cases PASS; its separate parallel-writer case encountered `database is locked` in the shared concurrent worktree.
- Full project TypeScript/build gate: BLOCKED outside ownership by `daemon/src/change-records.ts(49,44): TS2783 schemaVersion specified more than once`.
- Recovery/local regression batch: BLOCKED outside ownership by two `invalid_plan:verification-dependency` failures in the S4 recovery fixture and one `task_not_ready` local-budget fixture failure.

No migration, migration 034, migration 036, Core, measured-fact, budget, local-budget, selection, promotion, or execution source was changed. Revision lineage class authority remains withheld pending the independent S4 prerequisite confirmation.
