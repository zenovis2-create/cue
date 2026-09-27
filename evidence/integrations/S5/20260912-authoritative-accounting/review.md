# Independent review: S5 authoritative accounting

Date: 2026-09-12 KST  
Verdict: **BLOCKED / changes required**

## Review done contract

Done means a read-only comparison of the owned source and focused test against the approved plan, with concrete counterexamples for database membership, cutoff replay, budget parity, tamper handling, bounds, decimal totals/local counts, and the migration-036 quarantine. The focused test, nonincremental typecheck, `git diff --check`, and relevant budget/local/recovery regressions are run. Maximum review-writing attempts: 3. Every pass rechecks the cited source lines, focused test result, typecheck, diff check, and owned paths. A worse or unsupported finding is removed; a failed check gets a new hypothesis or is reported with its reproduction. Only this review file is owned.

## Blocking findings

1. **High — receipt runtime validation is incomplete at the tamper boundary.** At `authoritative-accounting.ts:96-105`, `receipt_id` is never passed through the 128-byte/nonempty ID validator, and runtime values for `kind` and `provider_final` are not checked against their declared/SQLite domains. With guards disabled, a canonical row/payload pair containing an empty or oversized receipt ID is returned, while an out-of-domain flag or kind can be treated as merely non-final/non-actual instead of corrupt. `kind='actual', units=null` does throw while aggregating, but only as an uncontrolled native `TypeError`, because the required actual/estimated/unknown unit invariants are not validated explicitly. The plan requires bounded IDs and fail-closed scalar/payload validation.

2. **Critical — the cutoff checksum does not bind the lineage that determines historical output.** The cutoff inventory at lines 84-86 hashes only reservation, receipt, and local-reservation rows. Classification reads `orchestration_plan`, `orchestration_attempt`, `orchestration_retry_link`, and `orchestration_attempt_revision` at lines 39-63, but their identity/payload/digest bytes are absent from the cutoff checksum. With tamper guards disabled, mutating a bounded retry link's `previous_attempt_id` to another valid same-run attempt changes `retryOf` and the historical snapshot digest while the supplied cutoff still passes `cutoff_integrity`. Likewise, replacing the original plan with another internally valid plan changes the returned role/class without invalidating the cutoff. The plan requires missing or changed old rows to fail integrity and requires canonical lineage hashes in the bounded replay.

3. **High — retry lineage is not validated to its stored authority contract.** Lines 51-57 read only retry-link rowid and `previous_attempt_id`. They do not validate `receipt_id`, the receipt-to-previous-attempt relationship, `contract_digest`, or the canonical retry payload; the prior attempt query checks only `run_id`. A guard-disabled link whose unused authority fields are corrupt is accepted and classified as `retry`. Duplicate/cross-run/cycle checks alone are insufficient under the plan's tamper model.

4. **High — budget authority and debt parity are not bound or represented.** The cutoff inventory omits `integration_budget`; the build reads only `currency` and `unit` (line 92), never validates the policy's remaining scalar fields, and never incorporates `limit_units` into accounting. Consequently a guard-disabled mutation of `limit_units` leaves both cutoff and snapshot digests unchanged even though remaining/debt truth changes. The approved plan explicitly requires parity with `createBudgetManager.snapshot`, including remaining/debt rules. The public snapshot has no remaining/debt fields or explicit debt reason, so an overspent final receipt can still be returned as `completeAtCutoff:true`.

5. **High — local accounting does not enforce the authoritative count limit and is never complete.** Lines 108-113 validate the local policy digest and count rows, but never reject `local.length > limit_count`, a state the local budget reader treats as corruption. They also unconditionally add `local-count-not-monetary`, forcing `completeAtCutoff:false` even for a valid, fully enumerated local snapshot. Local count is deliberately non-monetary, but that does not make bounded membership incomplete. The focused tests contain no local fixture, so neither behavior is detected.

6. **Medium — inventory limits are checked only after unbounded materialization.** Lines 75-83 call `.all()` for all matching reservations, receipts, and local rows, then compare array lengths to 4096. Oversized payloads are also fetched before their byte limits are checked. A corrupt/hostile ledger can force arbitrary allocation before the promised bound fails. Queries need a bounded sentinel (`LIMIT 4097`) or a count gate before payload materialization.

## Coverage and gate assessment

The focused test has only three cases. It does not prove monetary/local exclusion, local counts, missing budget policy, orphan reservation/attempt variants, malformed receipt semantics, retry payload/receipt/contract integrity, cyclic or post-cutoff lineage, missing revision steps, handoff unavailability, forged maxima beyond the one digest mutation, duplicate latest receipts, unsafe integers, 4096/1 MiB/2 MiB bounds, coherent concurrent cutoff capture, SQLite authorizer denial, or unchanged migration-034/Core table counts. Passing 3/3 cannot satisfy the plan's done gate.

Migration-036 lineage is correctly kept unavailable: any `orchestration_attempt_revision` produces `lineage-unavailable:s4-revision-unverified` and `unclassified` at lines 58-60. This review does not approve migration 036 or permit fallback to the original plan role.

## Executed evidence

- `npx vitest run test/integration-evaluation-authoritative-accounting.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **PASS, 3/3**.
- `npx tsc --noEmit --incremental false -p tsconfig.json`: **PASS**.
- `git diff --check -- daemon/src/evaluation/authoritative-accounting.ts daemon/test/integration-evaluation-authoritative-accounting.test.ts`: **PASS**.
- Budget/local/recovery regression batch: **18 passed, 4 failed**. All 9 budget cases passed. One local case failed with `task_not_ready`; three recovery cases failed with `stage_attempt_revision_mismatch`. These failures are outside this review's owned source, but the required regression gate is not green.
- Reviewed source SHA-256: `A401617BF652F2291C59678E0FF13E976D2C1317859A29321AA718A75921D141`; focused test SHA-256: `59A3109C9604BFFA739B1D431425C7792ECFBD5ADE8957E34B3C64BBFE768A46`.

Core and migration 034 remain quarantined. This result proves neither integration nor measurement completion and authorizes no provider, model, native, network, Electron, or paid activity.
