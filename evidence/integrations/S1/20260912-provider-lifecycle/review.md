# S1 provider lifecycle Unit 2 independent review

Date: 2026-09-12 KST

## Final verdict after correction 2

**PASS — bounded Unit 2 offline contract**

Correction 2 closes the billing-authority blocker on the reviewed hashes recorded below. The original failing counterexample and its evidence remain preserved in this document as the superseded initial verdict.

## Preserved initial verdict

**BLOCKED — superseded by correction 2**

The lifecycle projection is fail-closed and the store has no process-kill, budget-release, or acceptance authority. However, a structurally valid raw-SQL `provider-terminal` row with a false `payload_sha256` can authorize a public `billing-finalized` append. The public append succeeds and adds a billing row solely because the forged terminal row exists with a matching typed receipt digest. This violates the Unit 2 requirement that billing finality follow a matching **authoritative** provider receipt and the S3 rule that row existence is not authority.

## Preserved initial blocking finding

🔴 **Billing finality trusts an unverified provider-terminal row**

- `daemon/migrations/032_provider_execution_lifecycle.sql:78-79` authorizes `billing-finalized` when any same-attempt `provider-terminal` row has the same `provider_receipt_digest`; the trigger cannot establish that the terminal payload hash is valid.
- `daemon/src/orchestration/provider-lifecycle.ts:216-225` inserts a new event and returns it without verifying the matching terminal row, or the existing lineage, before a billing append.
- `daemon/test/integration-provider-lifecycle.test.ts:95-102` proves that the forged terminal cannot be projected, but it does not attempt a matching public billing append.

Direct counterexample against the built code:

1. Create a valid running orchestration attempt.
2. Insert by raw SQL an ordinal-1 `provider-terminal` whose JSON, typed columns, lineage, status, and receipt digest all agree, but whose `payload_sha256` is `ffffffff...ffffffff` rather than the canonical payload hash.
3. Call `store.append()` for ordinal-2 `billing-finalized` with the same provider receipt digest.
4. Observed result: `billingAccepted=true`, no error, and one `billing-finalized` row exists.
5. A subsequent `store.project()` throws `provider_lifecycle_payload_integrity`.

The projection failure prevents this lineage from producing a projected `billing:'final'`, but the public write API has already accepted and returned the billing fact. The matching receipt therefore was established by row existence rather than verified provider evidence.

Required correction: before inserting or returning `billing-finalized`, verify the matching same-lineage terminal row with the same payload-integrity logic used by projection, and reject atomically with zero added rows when it is invalid. A regression test should perform the counterexample above and assert both the rejection and a zero billing-row delta. Validating the full prior lineage before accepting a continuation would also prevent public writes from extending a corrupted lineage.

## S3 raw-SQL lesson probe

The remaining fail-closed properties passed:

- The raw forged terminal row can exist, but `project()` throws `provider_lifecycle_payload_integrity`.
- With a valid local-tree event before the forged terminal and a valid cleanup event after it, projection still throws for the entire lineage and returns no partial object.
- Before and after raw insertion, the orchestration attempt remained `{state:'running', cleanup_verified:0}`.
- `cleanup_observation`, `integration_budget_receipt`, `acceptance_final`, and `workspace_write_lease` row counts all remained zero.
- Public authority remained exactly `{processKill:0,budgetRelease:0,acceptance:0}`.

Thus the forged row cannot create an authoritative projection or mutate attempt/cleanup/budget/acceptance. The blocker is its use as the prerequisite for a later public billing append.

## Contract checklist

| Requirement | Result | Evidence |
|---|---|---|
| Cancel request, client acknowledgement, provider terminal, local controller/tree, cleanup, and billing are distinct facts | PASS | Focused lifecycle tests and source trace |
| Missing facts and provider death remain `unknown` | PASS | Cancel+ack, provider-terminal-only, and cleanup-only projections |
| Thread/turn/subtask input is bounded at 1,024 UTF-8 bytes and stored as an opaque SHA-256 digest | PASS | Source trace plus hostile/oversize and persisted-payload checks |
| Reference digest is bound to exact run/task/attempt/candidate/event; cross-attempt, changed-label, and changed-kind theft fail | PASS | Maker test plus independent matrix; all rejected with `provider_reference_replay_mismatch`, binding count stayed 1 |
| Append-only UPDATE/DELETE/REPLACE/IGNORE, exact replay, ordinal, seal, and provider-terminal conflict | PASS | Focused tests; independent `INSERT OR IGNORE` probes aborted |
| Billing finality only after a matching authoritative provider receipt | **BLOCKED** | Forged raw terminal enabled successful public billing append and one added billing row |
| Raw forged hash fails the whole projection without partial good state | PASS | Mixed good/forged/good three-event lineage returned only `provider_lifecycle_payload_integrity` |
| Lifecycle authority is zero for process kill, budget release, and acceptance | PASS | Public constant and state-delta probe |
| Plain DTO succeeds; getter/proxy/custom prototype/extra/invalid hash/oversize input fails without writes | PASS | Focused test plus independent hostile binding matrix |
| Absent or mismatched run/task/attempt/candidate writes nothing | PASS | Independent four-case matrix; event count stayed 2 before/after |
| Two connections, rollback, close/reopen | PASS | Focused lifecycle test |
| Fresh and pre-032 migration replay, reopen, integrity, and foreign keys | PASS | Independent file-backed probe: both `integrity_check=ok`, both `foreign_key_check=[]`; legacy remained explicit across two opens and a post-032 attempt remained writable |
| Source/dist migration byte identity | PASS | Both 13,322 bytes; SHA-256 `1B18A5E078452BC173D4E87E07F1B6DC4D463305DCEA8A1C48B60A48272F63B0`; byte comparison true |

## Executed gates

```text
cwd daemon
npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/p5.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
PASS: 3 files, 33 tests

npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false
PASS

npm run build
PASS

npx --no-install vitest run test/integration-orchestration.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
PASS: 1 file, 11 tests

npx --no-install vitest run test/integration-orchestration.test.ts -t "independent connections atomically claim exactly once" --reporter=dot --fileParallelism=false --maxWorkers=1
FAIL once: database is locked

same exact test, reporter=verbose
PASS: 1 passed, 10 skipped
```

The concurrent-claim result is the already documented S3 SQLite/Windows timing flake. The full orchestration file passed in this review, and the exact test passed on the evidence-based retry. It does not independently block this scoped Unit 2 review; the billing-authority counterexample does.

Blocked snapshot hashes at the time of the counterexample:

| File | SHA-256 |
|---|---|
| `daemon/migrations/032_provider_execution_lifecycle.sql` | `1B18A5E078452BC173D4E87E07F1B6DC4D463305DCEA8A1C48B60A48272F63B0` |
| `daemon/src/orchestration/provider-lifecycle.ts` | `326DC83ADAB8CAF781D0DF7EB2C4CEFDAD98B9DCB6ED5C5E26229453932FBF02` |
| `daemon/test/integration-provider-lifecycle.test.ts` | `F3599BAEA607E77AA797185862B56094B945E73C0F3529DF9DA7D77D4113C11E` |
| `daemon/src/ledger.ts` | `A263670999B9B62DF48A2FCE13FD9D695DED13E18534193FC67F2FB8AFF84E19` |
| `daemon/scripts/copy-assets.mjs` | `0F6906A7411C1D8B6CA1C6638B789B82E33D7BB72513F93DAA85292F84768870` |
| `daemon/test/p5.test.ts` | `B67F5A9759DF4F95E278E7EF5369671D4650DDAC1EF6A02C6F7E6E606E99F3DF` |

After the review gates completed, concurrent workspace changes altered the migration, lifecycle source, and ledger hashes. Those later bytes are outside this verdict and require the requested correction re-review; this artifact remains pinned to the failing snapshot above.

## Remote-cancel durable component status and limits

The Unit 2 durable component is implemented but **not accepted** until the billing prerequisite is integrity-verified. Its separation of cancel request, client acknowledgement, provider terminal, local cleanup, provider death, and billing remains valid, and unknown retention passed.

No provider, model, CLI, native launcher, Electron, or network execution occurred. Actual remote provider death, remote billing cessation, provider-issued receipt authenticity, and Unit 3 runtime/driver wiring were not tested or claimed. Line 69 of the remaining-design checklist must remain open after this review.

## Correction 2 independent re-review

### Reviewed revision

| File | SHA-256 |
|---|---|
| `daemon/migrations/032_provider_execution_lifecycle.sql` | `D33B6ECB9498E4264DE4FE35408634C871E224550786392D93BDF7667FAEFB67` |
| `daemon/dist/migrations/032_provider_execution_lifecycle.sql` | `D33B6ECB9498E4264DE4FE35408634C871E224550786392D93BDF7667FAEFB67` |
| `daemon/src/orchestration/provider-lifecycle.ts` | `56334581AE3D72FEFB7C4EE4B642223A54C418012939AC5A16BA338818826A9B` |
| `daemon/test/integration-provider-lifecycle.test.ts` | `A335718C92498A24967C18EE0044D2F9BBF1F8CC76E4809AFBE2A8A8A3FA0755` |
| `daemon/src/ledger.ts` | `89C837C71414F3311A355537C5151EAE96F591B1E4981A6B6D6F18874AB31462` |

The ledger registers deterministic `cue_sha256` before migrations run. Both event and reference INSERT triggers compare `cue_sha256(NEW.payload)` with the supplied digest. Public `append()` and `bindReference()` call `verifiedEvents()` inside the same immediate transaction before replay checks or inserts. That validation recomputes canonical hashes, compares typed fields and exact lineage, and enforces ordinal, cancel/ack, terminal, receipt, billing, and seal rules over the complete predecessor chain.

### Independent counterexamples

| Probe | Result | Dependent writes and authority state |
|---|---|---|
| Canonical-shaped raw terminal with fake hash through the intact trigger | PASS: rejected with `provider lifecycle exact event required` | lifecycle event count 0; attempt/cleanup/budget/acceptance/lease unchanged |
| Drop exact-event trigger, insert fake terminal, then public matching billing append | PASS: rejected with `provider_lifecycle_payload_integrity` | only forged terminal remains; no billing row; all authority state unchanged |
| Drop trigger, insert fake cancel, then public client acknowledgement | PASS: rejected with `provider_lifecycle_payload_integrity` | only forged cancel remains; no acknowledgement; all authority state unchanged |
| Drop trigger, insert fake parent, then public binding and lifecycle seal | PASS: both rejected with `provider_lifecycle_payload_integrity` | event count 1, binding count 0, no seal; all authority state unchanged |
| Persist valid cancel, remove immutable UPDATE trigger, tamper payload, close/reopen, then append acknowledgement | PASS: rejected with `provider_lifecycle_payload_integrity` | only original event row remains; no acknowledgement; `integrity_check=ok`, `foreign_key_check=[]`, all authority state unchanged |
| Open the migrated database through a raw SQLite connection without registering `cue_sha256`, then insert a correctly hashed canonical event | PASS: failed closed with `no such function: cue_sha256` | lifecycle event count 0 |

The authority snapshots covered orchestration attempt `state` and `cleanup_verified`, `cleanup_observation`, monetary and local budget rows, `acceptance_final`, and workspace lease rows. No probe changed them.

### Correction 2 gates

```text
cwd daemon
npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/p5.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
PASS: 3 files, 36 tests

npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false
PASS

npm run build --silent
PASS

fresh/pre-032 close/reopen, migration replay, integrity and foreign-key cases
PASS within integration-provider-lifecycle: integrity_check=ok, foreign_key_check=[]

source/dist migration byte comparison
PASS: 13,418 bytes each, byte_equal=true
SHA-256 D33B6ECB9498E4264DE4FE35408634C871E224550786392D93BDF7667FAEFB67

owned diff/whitespace check
PASS / exit 0; Git emitted working-copy line-ending conversion notices on tracked files
```

The prior review already ran the broader orchestration file and isolated concurrent-claim characterization. Per the bounded re-review request, those broad unchanged suites were not repeated. Correction 2's ledger registration path was exercised by the 36 lifecycle/P5/handoff tests, the independent file-backed probes, TypeScript, and the build.

### Final component status and limits

The Unit 2 append-only provider lifecycle component now passes the offline durable-contract review. The original raw terminal-to-billing counterexample no longer authorizes a dependent write, and row existence alone is not used by the public store as provider receipt authority.

This PASS does not close the overall remote-cancel checklist line. Actual provider termination, billing cessation, provider-issued receipt authenticity, and Unit 3 runtime/driver wiring remain unverified. No provider, model, CLI, native launcher, Electron, or network execution was performed.
