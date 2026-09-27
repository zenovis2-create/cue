# Evaluation UI actual-proof preflight

Verdict: **BLOCKED before Electron execution**

Review scope was static only. Product edits: 0. Electron executions: 0.

## Blocker

The installation-generation guard is captured before the dynamic Core, IPC, compiled-store, fixture, and scenario imports, but `guard.assertCurrent()` is not called immediately after those imports or before the proof's issuance/dispatch boundaries. It is called only after all scenarios complete and again during cleanup.

This conflicts with the guard's explicit contract in `app/installation-identity.mjs`: assert immediately after dynamic imports and before every issuance/dispatch boundary. Current unguarded boundaries include the visible run prepare, the fixture's direct pending-run prepare/enrollment, and the five renderer evaluation IPC calls that reach enrollment, enrollment rereads, observations, and coverage. The separate before/after file hashes and late guard assertions cannot detect a source/build change that is reverted during the scenario.

Before an actual run, add an immediate post-import assertion and contemporaneous assertions at each Core issuance/evaluation dispatch boundary. Record the assertion count and phase/boundary names so the aggregate can prove the intended ordering. Preserve the current two-attempt and immutable-evidence rules.

## Static checks that are ready

- The proof uses actual `createCueCore`, `registerIpcHandlers`, shipped preload, renderer HTML/JS/CSS, trusted main-frame sender predicate, compiled stores, and an isolated owned workspace/profile/ledger.
- Profile `userData` and `sessionData` are bound before Electron readiness. Core/IPC/compiled imports occur after genuine installation-generation capture; only the small profile bootstrap is statically imported earlier and this limitation is disclosed.
- Scenario action math is correct: five explicit evaluation IPC calls yield nine Core evaluation calls: enrollment (1), first observation/replay/revision-2 (2 each: enrollment reread plus observe), and coverage (2: enrollment reread plus coverage).
- The renderer is checked for zero evaluation calls on load. Enrollment, observation, replay, revision progression, and coverage each require explicit DOM submit/click actions. Approval, execution, and Stop are denied by the host wrapper and asserted at zero.
- The unobserved cohort member is a real second pending Core run and enrollment. Its policy tuple comes from the first prepared run's stored local policy; both prepares share the same current selection-policy snapshot. The fixture asserts pending enrollment identity and claimed-not-verified binding. No arbitrary renderer run/cutoff or fabricated result DTO is introduced.
- Replay and revision checks use real unchanged IPC responses and database row/change counters. Coverage uses the UI's last trusted observation cutoff and requires the null unobserved holdout row plus current-membership disclosure.
- Renderer requests are limited to file URLs, global main-process `fetch` is denied/counted, and execution-side tables (`approval_event`, attempts, session handles, native identities) must remain empty. With execute denied, no model/provider/native helper path is reached.
- Screenshot capture uses a visible production BrowserWindow and bounded two-frame settling. DOM and host waits have 30-second deadlines; child and parent have 115/125-second termination bounds.
- Cleanup preserves failure evidence, creates `VACUUM INTO` backup, independently checks SQLite integrity/hash in the parent, closes the Core/window, verifies exact owned temp-root identity and non-symlink status, removes only that root, and observes `ENOENT`. Aggregate PASS requires child success, exit 0, closure, backup verification, removal, and zero parent errors.
- Source assumptions include selected source and compiled counterparts, preload/renderer, process lifecycle, proof/fixture/scenarios/plan, Electron executable, and Node executable hashes before/after. The genuine installation generation covers the broader app/daemon/dependency tree, subject to its documented host-exclusive-root and trusted-bootstrap assumptions.

Prepared proof SHA-256 reviewed: `95DB635DEAEA8B6BBB19AE741CE0CE73BAD9BA0C8505B2194E8FA4F09AD5D79D`.

No Electron attempt should launch until the guard-order blocker is corrected and re-reviewed.

## Corrected-proof re-review

Corrected proof SHA-256: `3A29050459D68F68D02273DFA1B2CBF0B4F8CDF7ECE64D5D6D6AD4B747DD6F79`.

Disposition: **BLOCKED — guard ordering resolved; exact DB-count gate incomplete**.

The prior guard-order blocker is resolved. The corrected code executes and records exactly 19 ordered guard checks:

1. immediately after dynamic Core/IPC/scenario (and statically linked fixture) imports;
2. before the primary prepare DOM event and again at its `cue:prepare` IPC dispatch;
3. before the fixture's direct `prepareGoal` and `enrollEvaluation` calls;
4. before each of five `cue:evaluation` IPC dispatches; and
5. before each of the nine resulting Core calls: one enrollment; four enrollment rereads; three observations (including replay); and one coverage call.

The expected-tag `deepEqual` makes a missing, extra, or reordered tagged check fail. Each wrapper calls `guard.assertCurrent()` before recording its tag and before forwarding to the actual boundary. The preimage receipt preserves the original blocked proof hash `95DB635DEAEA8B6BBB19AE741CE0CE73BAD9BA0C8505B2194E8FA4F09AD5D79D`, the finding, and correction hypothesis 1 of 2.

The remaining blocker is the requested exact database count gate. The proof queries all eight relevant tables, but asserts exact zero only for `approval_event`, `orchestration_attempt`, `session_handle`, and `native_execution_identity`. It merely records `task`, `run`, `evaluation_enrollment`, and `evaluation_observation`. A stale or extra positive row can therefore pass. The acceptance assertion must cover the full exact result:

```text
task=2, run=2, approval_event=0, orchestration_attempt=0,
session_handle=0, native_execution_identity=0,
evaluation_enrollment=2, evaluation_observation=2
```

Static commands run, all exit 0:

- `node --check evidence/integrations/S5/20260912-evaluation-ui/electron-proof.mjs`
- `node --check evidence/integrations/S5/20260912-evaluation-ui/evaluation-fixture.mjs`
- `node --check evidence/integrations/S5/20260912-evaluation-ui/evaluation-scenarios.mjs`

Reviewed companion hashes:

- plan `6C7A03CB028E7DF92BADA2B252930091488D2EC7A99837AB265EDC66B62FD0FC`
- fixture `0F2D30B908B3C881C46DB7B46E0540AA6C41F67827E7440B985D4520B89FD430`
- scenarios `337559A38BBBA9A74BAF729C4763EC72C0009A77771C9C600AE07A7728AF55F8`

Product edits: 0. Electron executions: 0. A real attempt-1 run signal must not be issued until the exact DB-count assertion is added and re-reviewed.

## Final corrected-proof re-review

Final disposition: **READY for one actual attempt-1 run signal**.

Latest proof SHA-256: `5C547FA46E57E3CADFA3F99C3C58A5738C9875EF04FBEDC6B00C824C561B1DF0`.

Both prior BLOCKED findings above remain preserved. The latest proof resolves the exact-count finding by asserting the complete database result with `deepEqual`:

```text
task=2, run=2, approval_event=0, orchestration_attempt=0,
session_handle=0, native_execution_identity=0,
evaluation_enrollment=2, evaluation_observation=2
```

The final 21-tag guard sequence was independently traced through the current files. The first check occurs immediately after dynamic imports. Primary prepare has both the scenario-before-DOM-event check and the IPC-dispatch check. The fixture checks immediately before its direct `prepareGoal` and `enrollEvaluation` calls. Each of five evaluation IPC dispatches checks before forwarding, and the bridge checks before each of the nine actual Core evaluation calls. A final acceptance tag is checked before accepting counters/database state; the manifest cleanup tag checks before source comparison. The proof asserts the exact first 20 tags before acceptance artifacts and all 21 tags during cleanup, and records the final sequence in `result.json`.

The preserved preimage receipt still identifies the original proof hash `95DB635DEAEA8B6BBB19AE741CE0CE73BAD9BA0C8505B2194E8FA4F09AD5D79D` and correction hypothesis. The plan now states the 21-tag sequence and full exact database gate. No attempt-1 intent file or attempt-1 output directory existed at this review.

Static commands rerun, all exit 0:

- `node --check evidence/integrations/S5/20260912-evaluation-ui/electron-proof.mjs`
- `node --check evidence/integrations/S5/20260912-evaluation-ui/evaluation-fixture.mjs`
- `node --check evidence/integrations/S5/20260912-evaluation-ui/evaluation-scenarios.mjs`

Current companion hashes:

- plan `6E9EDB92ED4AC44924B855EB88EB828B5B915F3CE743F0FB314CA14A51AD0D86`
- fixture `0F2D30B908B3C881C46DB7B46E0540AA6C41F67827E7440B985D4520B89FD430`
- scenarios `337559A38BBBA9A74BAF729C4763EC72C0009A77771C9C600AE07A7728AF55F8`

## Attempt-2 correction static review

Disposition: **READY for exactly one actual attempt-2 run signal**.

Attempt 1 remains preserved as a failed immutable attempt. Its audit identifies the nonexistent `evaluation/canonical` selected-manifest entry and missing early child receipt. No attempt-2 intent file or output directory existed during this review.

Latest proof SHA-256: `716E7DBE6B9644398C06AD4839268E11EE7E563F110930EC05DE64C31F658F07`.

The correction is scoped to the proof and plan. Fixture and scenarios retain their prior hashes. The selected manifest now names the actual `evaluation/comparison` source and compiled dependency used by enrollment and observations. An independent Node-only preflight enumerated all 29 selected product/source/compiled/proof paths: all 29 exist and hash successfully; its ordered preflight manifest digest was `9A0EAD11A604E009C6DFEDA041B8F38EB68015CD08DFF8D5489BA67B7BE5D608`.

Initial `before=hashes()` now executes inside the child `try` after `save`, timer, phase state, and fetch guard are available. A selected-file/hash failure therefore enters `catch`, writes `failure.json` with phase `selected-manifest-before`, and continues through `finally` to write `result.json`. Because no installation guard exists at that early point, cleanup's guarded manifest step is recorded as an error; the missing backup also keeps `passed:false`. The parent consequently preserves the owned root and emits its aggregate failure artifacts. An early hash failure can no longer escape solely as an unhandled rejection.

On the success path, installation identity is still captured before dynamic Core/IPC/scenario imports and immediately checked afterward. The previously reviewed exact 21-tag guard sequence and the full exact database `deepEqual` remain unchanged. Attempt-1 provenance is included in the plan with its preserved root and missing evidence inventory.

Static commands, all exit 0:

- Node-only 29-path existence and SHA-256 preflight.
- `node --check evidence/integrations/S5/20260912-evaluation-ui/electron-proof.mjs`
- `node --check evidence/integrations/S5/20260912-evaluation-ui/evaluation-fixture.mjs`
- `node --check evidence/integrations/S5/20260912-evaluation-ui/evaluation-scenarios.mjs`

Reviewed hashes:

- plan `2048D61A6CF984E92B865E790AA53F0C1F5E560C7F179F7C32D75A5D94CF14C7`
- fixture `0F2D30B908B3C881C46DB7B46E0540AA6C41F67827E7440B985D4520B89FD430`
- scenarios `337559A38BBBA9A74BAF729C4763EC72C0009A77771C9C600AE07A7728AF55F8`
- comparison source `94A952572E584B61EEE69F72D585C90FAD0C21284F80D5F72BA17326FBD54342`
- comparison compiled `BC3A38A50BB1830D8B94E68767B63929A441A91A3D082F54F6E3A20B333E9343`

Scoped product hashes remain the independently reviewed values (`ipc` `02A29E...25B7`, preload `BAEC01...3FEDC`, renderer `8B7F9A...D243`, HTML `FBECDA...4475`, CSS `606890...344`). Product edits: 0. Electron executions by this reviewer: 0.

Final current authorization statement: product edits 0 and Electron executions 0 by this reviewer. The latest READY disposition permits exactly one actual attempt-2 execution signal under the plan's frozen-source and immutable-evidence rules; it does not reopen or replace attempt 1.
