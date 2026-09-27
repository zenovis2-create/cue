# S4 remaining-gap design

Date: 2026-09-12  
Scope: the unchecked S4 clauses in `docs/INTEGRATION_CHECKLIST.md:158-163,178-179`, with the two already-failed actual gates at lines 146 and 153 kept separate. This is a read-only source/evidence design. No product code, test, Electron process, native helper, external service, or model was run.

## Decision

After the in-progress S3 immutable handoff/activity unit is complete, implement these two units in order:

1. **Failure disposition, plan revision, and evidence policy**: turn a host-observed failure into exactly one immutable `retry | switch | replan | stop` decision; execute a revised plan without resetting the original approval, requirements, attempts, deadline, or budget; and make each requirement kind fail closed against a concrete evidence policy.
2. **Change journal and held-crash reconciliation**: record bounded filesystem and external-effect intent before execution, compare the settled result after execution or crash, permit restoration only when the exact postimage is still current, and feed a sealed integration verification result into completion. Recovery is inspection/reconciliation only; it never resumes a write.

The ordering is necessary. Unit 2 needs Unit 1's immutable disposition and revision lineage to decide whether a reconciled attempt may be retried, switched, replanned, or must remain stopped. Both units require the S3 terminal handoff to be real and consumed by the driver: a receipt string or model claim cannot substitute for verified artifacts and launch identity.

## Current truth

- Retry is narrow but real. `orchestration_retry_contract` binds the original requirements digest, plan/policy digests, per-task/total attempt caps, and deadline before approval. A replacement attempt requires a clean failed receipt and a host classification whose only accepted cause is `transient`. Monetary and local invocation reservations are cumulative per run.
- There is no switch or replan representation. `orchestration_plan` and `requirement_contract_binding` each allow one immutable row per run; `orchestration_step` has no plan revision dimension. A new run would currently acquire a new budget and requirement binding, so using a new run as an informal replan would reset the exact limits that the checklist says must remain cumulative.
- Acceptance distinguishes `code | research | document | external` and minimally requires filesystem, retrieved-source, filesystem/generated-output, or remote-state artifacts. It does not define sufficient evidence per kind. In particular it has no code test/result contract, research claim-to-source mapping, document render/structure requirement, or remote operation/idempotency/pre/post-state contract.
- Crash recovery marks running attempts blocked and retains an unresolved writer lease. The legacy recovery path records `git status` and `blocked_no_auto_resume`. Native identity observation is read-only and useful, but no durable held-recovery case binds process cleanup, filesystem changes, external side effects, and a final disposition.
- There is no `daemon/src/change-records.ts` and no `daemon/test/integration-verification.test.ts`. Existing P11/P12/P13 tests prove important lower-layer lifecycle properties; they do not prove that the S4 orchestration path consumes those facts before retry, restoration, or completion.
- Migration `031_orchestration_handoff_activity.sql` is present and wired, while its source integration is still being worked on. These units must start only after that work is green. At implementation start, re-list `daemon/migrations`; the names below are the exact current allocation. If another completed unit has claimed either number, preserve the suffix and move both S4 migrations together to the next two consecutive free numbers before editing `ledger.ts` or `copy-assets.mjs`.

## Unit 1 — failure disposition, revision lineage, and evidence policy (`032`)

### Exact ownership

The implementer owns only:

- `daemon/migrations/032_s4_recovery_revision.sql` (new)
- `daemon/src/ledger.ts`
- `daemon/scripts/copy-assets.mjs`
- `daemon/src/orchestration/recovery-policy.ts` (new)
- `daemon/src/orchestration/plan.ts`
- `daemon/src/orchestration/store.ts`
- `daemon/src/orchestration/engine.ts`
- `daemon/src/verification/evidence-policy.ts` (new)
- `daemon/src/verification/requirements.ts`
- `daemon/src/verification/acceptance.ts`
- `app/orchestration-driver.mjs`
- `app/orchestration-driver.d.mts`
- `daemon/test/integration-recovery-policy.test.ts` (new)
- `daemon/test/integration-evidence-policy.test.ts` (new)
- `daemon/test/integration-retry-backend.test.ts`
- `daemon/test/integration-requirements.test.ts`
- `daemon/test/integration-acceptance.test.ts`
- `daemon/test/integration-driver.test.ts`

Do not add filesystem restoration, external reconciliation callbacks, renderer changes, native process execution, or an actual model gate to this unit. Because `store.ts`, `engine.ts`, `ledger.ts`, and `copy-assets.mjs` overlap the current S3 handoff work, take their completed bytes as the base and do not start this unit concurrently with it.

### Durable schema

`032_s4_recovery_revision.sql` adds append-only tables with update/delete/replace guards:

- `orchestration_recovery_scope`: one root scope per workflow run. It freezes original envelope, approval/policy digest, original requirements digest, original plan digest, budget kind and identity, total attempt cap, and absolute deadline. Existing runs are marked `legacy-recovery-scope-unavailable`; migration must not infer authority for them.
- `orchestration_failure_observation`: immutable host evidence for one terminal handoff. Cause is exactly `transient | authentication | quota | capability-mismatch | quality-failure | policy-violation | unknown`; payload includes source reference/hash, observation time, cleanup state, and the verified S3 handoff/receipt identity.
- `orchestration_recovery_decision`: one immutable decision per failed attempt. Action is exactly `retry | switch | replan | stop`; it binds observation hash, prior attempt, selected candidate when applicable, source and destination plan revision, cumulative counters before the decision, and a canonical decision digest.
- `orchestration_plan_revision`: ordered revisions under the same recovery scope. Revision zero snapshots the already-approved plan; later revisions bind parent revision/digest, reason decision, canonical plan payload/digest, original requirement/policy/envelope digests, and creation time. Exact replay is idempotent; forks at an ordinal or two children from one decision are rejected.
- `orchestration_revision_step`: step identity and dependencies for a revision. Task IDs are immutable across the recovery scope: an existing logical task may be carried forward with the same requirements and a new attempt; a new task ID may narrow/decompose work but cannot delete a required requirement from revision coverage.

The migration must enforce foreign keys to the existing run, attempt, receipt/handoff, policy, requirement, and budget records. It must not copy `orchestration_attempt` or weaken the S3 terminal-handoff trigger. Source and deployed migration bytes must match after build.

### Decision contract

The trusted host supplies a bounded, frozen failure observation; caller text never selects the branch. The deterministic policy is:

| Cause | Allowed action | Required facts |
| --- | --- | --- |
| `transient` | `retry`, or `switch` if the same candidate is no longer eligible | failed-clean handoff, retryable host code, caps/deadline/budget still available |
| `authentication` | `switch` only to another already-approved authenticated candidate; otherwise `stop` | no credential material, no silent login or account change |
| `quota` | `switch`, or delayed `retry` only when an authoritative reset time is inside the original deadline and no reservation is released speculatively | current quota observation and unresolved billing retained |
| `capability-mismatch` | `switch` when another approved candidate satisfies the same task; otherwise `replan` | candidate capability evidence and unchanged requirement coverage |
| `quality-failure` | `replan` or `stop` | independent failed requirement evidence; unchanged-plan same-candidate retry is forbidden |
| `policy-violation` | `stop` | terminal seal evidence; no later attempt or revision may be claimed |
| `unknown` | `stop` | preserve unknown cleanup/billing/effect state; never guess retryability |

Every non-stop branch first requires the prior attempt to be terminal, S3 handoff verified, native/process cleanup verified, writer lease releasable, and external-effect state either not applicable or confirmed. A candidate switch creates a new attempt and selection record; it cannot rewrite the prior attempt. A replan appends one revision, then claims only steps in that revision. No branch can widen candidates, scopes, actions, egress, account set, cost/time/attempt limits, or requirement text/checker contract.

### Cumulative invariants across revisions

- Attempt count is `COUNT(orchestration_attempt)` over the recovery scope, including failed, stopped, verifier, switched, and superseded-revision attempts. It never resets at a revision boundary.
- Monetary committed/debt/unknown reservations and local invocation reservations continue to use the original run budget. A revision has no budget initializer and cannot introduce the other budget kind. Unsettled provider cost remains reserved.
- The effective deadline is the minimum of the original envelope expiry, retry contract deadline, and host task deadline captured at approval. Replanning may shorten it only.
- `requirements_digest` is exactly the original binding on every revision. Revision validation requires complete coverage of all original required IDs. It may split one requirement across more tasks, but cannot alter its text, kind, required flag, checks, targets, checker revisions, or parameters digest. New requirements cannot become completion requirements without a new user approval/run.
- The original policy/envelope remain the authority. Each revised stage envelope is a subset and gets its own S3 handoff; a revision digest alone grants no launch authority.
- Readiness and claim must both select the same explicit revision. “Latest row” lookup without a decision/revision digest is forbidden. Old pending steps become superseded history and cannot launch; already running steps must settle before a revision is appended.

### Evidence policy contract

`evidence-policy.ts` validates a frozen policy descriptor registered before approval and revalidates evidence at finalization:

- **Code**: at least one nonempty current filesystem artifact for every approved target plus an independent checker observation for the declared test/build/static contract. The observation binds command/checker revision, exit status, input/source revision, output digest, and target manifest. Process exit, diff presence, or model “done” is insufficient. Required negative/hostile checks in the approved contract must be present rather than inferred from a broad green suite.
- **Research**: immutable retrieved-source artifacts with retrieval time, source identity/content hash, and an explicit claim-to-source map covering each required claim. A URL, search-result title, model citation string, or inaccessible/changed source yields `unknown`; contradiction yields `fail`.
- **Document**: nonempty filesystem or explicitly approved generated-output artifacts plus the declared structural/render checker and requirement-to-section mapping. Generated text cannot satisfy a filesystem/source/remote-state target. When visual layout is in scope, a text-only checker cannot pass it.
- **External**: a pre-authorized operation identity/idempotency key and authoritative post-operation remote-state observation bound to account/resource, expected transition, observer revision, time, and digest. Request acceptance, local response, or process exit is not remote completion. Ambiguous remote state is `unknown` and held.

All policies reject empty target arrays, duplicate logical targets, checker self-review, observations from a producer attempt, stale/future observations, changed manifest bytes, inaccessible evidence, and model-report origins. Acceptance keeps `fail` and `unknown` distinct and still completes only when every required outcome is `pass`.

### Hostile failures that must be tests

- Each cause maps to every forbidden branch; a malicious caller-supplied action; unsupported cause; conflicting exact-replay observation; late observation after a stop/seal.
- Retry after unknown cleanup, switch before old candidate termination, switch to an unapproved/unauthenticated candidate, quota retry without reset proof, quality failure followed by unchanged retry, and any action after policy violation.
- Replan with a missing/orphan/changed requirement, widened scope/action/egress/candidate, increased cap/deadline/budget, changed checker revision/parameters, duplicate revision/fork, stale parent digest, old-revision claim, or a running old-revision attempt.
- Total/per-task limits across retry + switch + replan; concurrent connections racing for the final attempt or budget slot; monetary and local budget cases; unknown provider billing retained.
- Empty file, passing exit with missing artifact, model-reported pass, producer as checker, research claim without a bound source, generated text substituted for a file/source, document without required render evidence, and external request acknowledged without authoritative remote state.
- Migration reopen, tampered payload/digest, direct update/delete/replace, legacy row, foreign-key check, source/dist migration mismatch, and outer-transaction misuse.

### Done commands and attempt cap

Implementation/review cap: two correction passes after the initial implementation. Every pass runs from `daemon`:

```powershell
npm run build
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-evidence-policy.test.ts test/integration-retry-backend.test.ts test/integration-requirements.test.ts test/integration-acceptance.test.ts test/integration-driver.test.ts test/integration-handoff-activity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

Then run from the repository root:

```powershell
git diff --check -- daemon/migrations/032_s4_recovery_revision.sql daemon/src/ledger.ts daemon/scripts/copy-assets.mjs daemon/src/orchestration/recovery-policy.ts daemon/src/orchestration/plan.ts daemon/src/orchestration/store.ts daemon/src/orchestration/engine.ts daemon/src/verification/evidence-policy.ts daemon/src/verification/requirements.ts daemon/src/verification/acceptance.ts app/orchestration-driver.mjs app/orchestration-driver.d.mts daemon/test/integration-recovery-policy.test.ts daemon/test/integration-evidence-policy.test.ts daemon/test/integration-retry-backend.test.ts daemon/test/integration-requirements.test.ts daemon/test/integration-acceptance.test.ts daemon/test/integration-driver.test.ts
```

Also reopen an actual temporary SQLite ledger, run `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, and compare SHA-256 of source/deployed `032`. Keep a correction only when the failing hostile gate becomes green without regressing the previously green focused set. After two failed corrections, preserve the failure and hand back the exact counterexample.

This unit can close checklist line 158 and line 161 only when the real driver executes every disposition/revision path and the hostile cumulative tests pass. It can close line 163 only when the type-specific policies are used by final acceptance, rather than merely exported or tested directly. It cannot close crash recovery, write restoration, integration verification, actual startup, or actual Qwen workflow claims.

## Unit 2 — change journal, held recovery, and sealed integration verification (`033`)

### Exact ownership

The implementer owns only:

- `daemon/migrations/033_s4_change_recovery.sql` (new)
- `daemon/src/ledger.ts`
- `daemon/scripts/copy-assets.mjs`
- `daemon/src/change-records.ts` (new)
- `daemon/src/recovery.ts`
- `daemon/src/orchestration/store.ts`
- `daemon/src/orchestration/engine.ts`
- `daemon/src/integration-runtime.ts`
- `daemon/src/verification/integration-verification.ts` (new)
- `daemon/src/verification/acceptance.ts`
- `daemon/src/native-recovery-observer.ts`
- `app/orchestration-driver.mjs`
- `app/orchestration-driver.d.mts`
- `daemon/test/integration-change-records.test.ts` (new)
- `daemon/test/integration-held-recovery.test.ts` (new)
- `daemon/test/integration-verification.test.ts` (new)
- `daemon/test/integration-recovery.test.ts`
- `daemon/test/integration-driver.test.ts`
- `daemon/test/p11-writer-lifecycle.test.ts`

Start from completed Unit 1 and S3 handoff bytes. Do not alter renderer/UI, qualification policy, Qwen adapters, P12 harness semantics, or historical evidence. Existing P12/P13 files are gates, not owned implementation surfaces, unless an independently reproduced product defect requires a separately authorized unit.

### Durable schema and states

`033_s4_change_recovery.sql` adds immutable intent/observation records and a narrowly mutable held-case state machine:

- `change_set`: one prelaunch set per write-capable attempt, bound to run/task/attempt, stage envelope, S3 launch intent, worktree canonical identity, approved targets, scan limits, and preimage manifest digest.
- `change_entry`: one logical target with relative approved path, pre-launch lstat/object kind, canonical realpath when it exists, file identity when available, byte length, SHA-256, restorable flag/reason, and encrypted/ledger BLOB preimage only for regular files within the approved backup cap. Directory, symlink, reparse point/junction, device, sparse/oversized/unreadable file, and arbitrary shell side effects are explicitly non-restorable.
- `change_observation`: immutable postlaunch/postcrash snapshots. It records created/modified/deleted/moved/type-changed/outside-manifest/unknown and binds the exact bytes/stat facts used for the result. Observations never overwrite preimages.
- `external_effect_intent` and `external_effect_observation`: intent is committed before dispatch with operation/account/resource/idempotency identity and expected transition; observations are append-only `confirmed-applied | confirmed-not-applied | unknown`, supplied by a registered authoritative read-only observer.
- `held_recovery`: one case per interrupted or ambiguous attempt. State is `held | reconciled-stop | eligible-for-disposition`, with monotonic compare-and-swap revision and a final seal. `eligible-for-disposition` still does not launch; it only allows Unit 1 to create a new explicit decision after cleanup/change/effect verification.
- `integration_verification_result`: one immutable result per terminal attempt/revision, binding S3 handoff, change/effect reconciliation, evidence-policy outcomes, cleanup/native observation, stop/seal state, checker revision, and canonical digest. Result is `pass | fail | unknown`; only `pass` may feed acceptance.

Database triggers reject terminal `pass` if any required evidence is not pass, cleanup is not verified, a held case is open, external state is unknown, a policy-violation seal is absent, or the handoff/current manifests do not match. Legacy interrupted rows become held/unknown; migration must not synthesize preimages, cleanup, remote state, or a pass.

### Filesystem capture and restoration contract

Before a write-capable launch, while holding the existing workspace writer lease, the host resolves the approved worktree and every explicit target component with handle/lstat-based checks, rejects traversal and reparse/junction crossings, captures a bounded preimage, commits `change_set`, and only then permits launch. A recursive manifest has strict file/count/byte/time limits; exceeding a limit records `restorable=false` and can still allow approved execution only when policy explicitly accepts that recovery limitation.

After termination and cleanup observation, the host captures the postimage through the same resolver. Hash is never the sole identity: comparison binds object type, canonical parent, file identity when available, byte length, and SHA-256; for backed-up regular files, exact stored bytes are compared when a supplied/injected hasher collides. Duplicate logical targets and case aliases collapse to one identity or fail.

Automatic restore is allowed only for an attempt explicitly stopped by Unit 1 and only while reacquiring the same canonical writer lease. Immediately before each write/delete, verify that the current object exactly equals the recorded postimage. If a user or another process changed it, its parent changed identity, a target moved, disappeared unexpectedly, became a link/reparse point, or a junction appeared in any ancestor, refuse with `restore_conflict` and leave the case held. Restore uses a same-directory host-owned temporary file, flush, metadata recheck, atomic replacement, and post-write byte verification. Created files may be removed only when their exact recorded postimage is still present. Directories, moves, deletions without a stored preimage, oversized/unreadable/sparse files, arbitrary shell changes outside the manifest, and remote effects are never automatically reversed.

“Restored” means the recorded target bytes/state were restored within those limits. It does not mean every side effect of a command was undone. The report and acceptance result must expose every non-restorable or unknown entry.

### Crash and external-effect reconciliation contract

On startup, recover durable queue/state for inspection, mark every interrupted execution `held`, fence/observe its exact native identity, and retain its writer lease while cleanup is unknown. Do not call an executor start/resume method. Do not select a new candidate, reserve a new budget slot, consume a wait response, restore files, or repeat an external request automatically.

Reconciliation proceeds in this order: installation generation check; exact native identity/death and owned residue observation; current change snapshot; external authoritative read using the stored operation identity; budget/billing status; S3 handoff/terminal receipt consistency; integration verification. Unknown at any step remains held. Confirmed remote applied is preserved and evaluated against the approved expected transition; confirmed not applied may become eligible for a later Unit 1 disposition; conflicting observations seal the case unknown. An idempotency key does not itself prove either state and is never permission to resend.

Late process/output/cleanup/remote observations are append-only diagnostics. They may move a held case forward through compare-and-swap only if their lineage and observation time are valid; they cannot unseal a stop, replace a final integration result, rewrite a change entry, or auto-resume work.

### Integration verification contract

`integration-verification.ts` is the only adapter from S4 facts to final acceptance. It reads from the ledger and registered read-only observers; callers cannot submit a desired verdict. It requires:

- exact current plan revision, original approval/requirements/budget scope, and Unit 1 cumulative limits;
- terminal S3 handoff and launch identity for every producer/verifier attempt consumed by the revision;
- all type-specific required evidence policy outcomes `pass`, with fail/unknown retained;
- verified process termination and cleanup, settled writer ownership, no open held recovery, and a current change/effect observation;
- no post-violation execution/activity/handoff after a policy seal;
- current artifact/change manifest recomputation under the lease and atomic storage of the immutable result before acceptance completes.

A true model self-report, exit code zero, nonempty diff, later successful retry, historical P12 evidence, or different verifier model cannot satisfy a missing fact.

### Hostile failures that must be tests

- Preimage write/launch race, file change during scan, file change between restore check and replace, two recovery connections racing, stale CAS, late observation after final seal, and crash at every transaction boundary.
- Injected same SHA-256 for different bytes, same bytes with changed type/identity, case aliases, `..`, ADS/device names, symlink/reparse point, junction in parent or inserted after scan, target move/swap, deleted parent, hard-link ambiguity, oversized/unreadable/sparse file, and manifest/file-count/time exhaustion.
- Created-file cleanup after third-party edit, modified-file restore after postimage drift, deleted-file restore without stored bytes, partial multi-file restore failure, flush/rename failure, lease loss, outside-worktree target, and a later user edit that must survive.
- Parent death with live child, dead PID reused with different creation time, helper timeout, unknown residue, unknown billing, missing S3 handoff, tampered change/effect/result payload, and reopen of each held/final state.
- External request accepted but remote state absent, confirmed applied, confirmed not applied, conflicting/stale observer results, wrong account/resource, reused idempotency key, observer timeout, and attempted automatic resend.
- False success, empty artifact, partial implementation, required fail/unknown, post-seal activity, retry/replan while held, and direct SQL update/delete/replace of immutable rows.
- Mutation sensitivity: remove no-auto-resume, current-postimage recheck, junction rejection, collision byte comparison, external unknown hold, required-evidence gate, or post-violation seal; each mutation must make the focused gate fail.

### Done commands and attempt cap

Implementation/review cap: two correction passes after the initial implementation. Every pass runs from `daemon`:

```powershell
npm run build
npx --no-install vitest run test/integration-change-records.test.ts test/integration-held-recovery.test.ts test/integration-verification.test.ts test/integration-recovery.test.ts test/integration-driver.test.ts test/integration-acceptance.test.ts test/integration-recovery-policy.test.ts test/integration-evidence-policy.test.ts test/integration-handoff-activity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

On Windows, after the focused set is green, run the current-build lifecycle gates from `daemon`:

```powershell
npx --no-install vitest run test/p12-stop-harness.test.ts test/p11-writer-lifecycle.test.ts test/p12-parent-death.test.ts test/p12-enforcement-seal.test.ts test/p12-real-restart.test.ts test/p13-lifecycle-harness.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Run the repository's established actual stop/parent-death/seal evidence harness only under its existing ownership and evidence rules; preserve raw exit codes, PID + creation-time observations, residue classes, source/build hashes, and mutation-red proof. Unit tests or an old P12 log cannot replace current-build OS evidence. No Qwen/model request is part of this gate.

Then run from the repository root:

```powershell
git diff --check -- daemon/migrations/033_s4_change_recovery.sql daemon/src/ledger.ts daemon/scripts/copy-assets.mjs daemon/src/change-records.ts daemon/src/recovery.ts daemon/src/orchestration/store.ts daemon/src/orchestration/engine.ts daemon/src/integration-runtime.ts daemon/src/verification/integration-verification.ts daemon/src/verification/acceptance.ts daemon/src/native-recovery-observer.ts app/orchestration-driver.mjs app/orchestration-driver.d.mts daemon/test/integration-change-records.test.ts daemon/test/integration-held-recovery.test.ts daemon/test/integration-verification.test.ts daemon/test/integration-recovery.test.ts daemon/test/integration-driver.test.ts daemon/test/p11-writer-lifecycle.test.ts
```

Reopen a temporary SQLite fixture, verify integrity/FKs and source/deployed `033` hash equality, and inspect that no owned process/profile/temp path remains. Keep a correction only when the measured hostile or OS gate improves without regressing the focused set. After two failed corrections, retain the failed evidence and hand back the exact unresolved identity/path/state; never turn timeout into inconclusive/pass.

This unit can close checklist line 162 only after real filesystem hostile tests include races, deletion/move, collision injection, and Windows junction behavior. It can close line 178 only after an actual killed host is reopened into `held`, external unknown remains held, and counters prove executor starts/resumes/new reservations/restores are zero until an explicit later disposition. It can close the `integration-verification.test.ts` portion of line 179 with the focused test, but the whole line remains open until current-build stop, parent-death, and seal gates all pass with current OS evidence.

## Checklist closure and non-code blockers

| Checklist line | Earliest closure | What remains outside these units |
| --- | --- | --- |
| 158 cause-specific retry/switch/replan/stop | Unit 1 | Requires real driver-path branch coverage; direct policy-function tests alone do not close it. |
| 161 cumulative limits/original requirements across replan | Unit 1 | Requires both monetary and local budget paths plus concurrent final-slot tests across revisions. |
| 162 change record/restore/collision/race/junction | Unit 2 | Windows junction and real filesystem race evidence are mandatory; pure mocks are insufficient. |
| 163 evidence by task type | Unit 1 | Requires final acceptance to consume all four policies; no semantic accuracy claim beyond registered checker contracts. |
| 178 crash held/external reconciliation/no auto-resume | Unit 2 | Requires an actual crash/reopen observation and an authoritative external fixture/observer. It does not require a live destructive external write. |
| 179 integration verification + stop/parent-death/seal | Unit 2 plus separate current-build OS gate | Focused Vitest can close only the named test portion. Actual lifecycle evidence must be regenerated for the changed execution boundary. |
| 146 actual default Electron startup | Neither | Existing actual result is `passed:false` because the window was not visibly captured. A separate visible project-Electron QA is required; source tests and these S4 units cannot close it. |
| 153 current-source qualification + real workflow checker/final acceptance | Neither | Both preserved Qwen gates exhausted their two-call allowances and ended without checker/final acceptance. Current source also invalidates the historical qualification. No further Qwen call, repaired-history resume, or success relabel is authorized by this design; closure needs a new explicit live-call allowance and a fresh qualified-source run after offline fixes. |

The already-passing native recovery observer/host/UI and historical P11/P12 evidence remain useful prerequisites. They must not be rerun merely to increase pass counts, and they must not be promoted into proof of the new S4 orchestration wiring. Actual OS evidence is required only where the new boundary is exercised; the Qwen blocker remains deliberately untouched.

## Audit basis

Reviewed source and schema: S4 checklist/spec, migrations 008/010/013/016/021/024/031, orchestration plan/store/engine/retry migration, budget managers, requirements/acceptance, generic and native recovery, app driver, and relevant retry/recovery/P11/P12/P13 tests. Reviewed evidence: S4 retry, acceptance, fresh Electron gate, historical JSON canary, default-startup, native recovery observer/host/UI, and recovery run picker reviews. Large generated result files, `node_modules`, `.git`, `dist`, and `build` were excluded from conclusions.
