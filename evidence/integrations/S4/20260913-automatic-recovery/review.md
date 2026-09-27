# Independent review: automatic approved recovery

Date: 2026-09-13

Status: **PASS for the bounded driver/backend contract.** The final root-owned build remains a separate gate.

## Done contract

Done means the frozen driver, declaration, and integration fixture satisfy the `LOOP.md` trigger, authority, idempotency, callback fencing, deferred-replan, deadline, and default-manual requirements; the declared four-file real-SQLite/injected-runtime gate passes once independently; scoped diff checking is clean; and exact hashes are recorded. This review used one test attempt. Failure would have remained BLOCKED with the exact failing assertion; no source correction was owned by this reviewer.

## Independent gate

From `daemon/`:

`npm exec vitest run -- test/integration-driver.test.ts test/integration-recovery-policy.test.ts test/integration-held-recovery-admission.test.ts test/integration-held-retry-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: exit 0; 4 files passed; **61/61 tests passed**; duration 17.99 s. `git diff --check` over the driver, declaration, driver test, and automatic-recovery evidence reported no errors.

## Source and behavior review

- Preparation freezes `recoveryMode` into the approval summary. Omission resolves to `manual`; unknown modes and automatic mode without the trusted recovery host, retry contract, or requirement contracts are rejected before persistence.
- Automatic recovery is reached only from a failed receipt in the active `drive` loop. The deterministic decision ID binds run, exact attempt, latest persisted terminal receipt ID, and active revision. `observeFailure` and `recordDecision` remain the shared authority path used by public manual recovery and automatic recovery; no caller-supplied facts or action are accepted.
- After the trusted callbacks, automatic application rechecks the prepared entry, exact request object and attempt, active revision object, cancellation, close, and the effective deadline before pending-step or pending-recovery mutation. The reentrancy guard prevents a callback from using public `recover` to reset the active promise. Retry/switch tests observe one recovery activation and the approved candidate only.
- Quota recovery retains the store-derived reset time and stays dormant until it. The drive-loop deadline check remains in front of every iteration. Existing policy, held-recovery, and held-retry suites exercise corrupt/open/stopped recovery evidence, lineage, approval, caps, deadline, and zero-write denial at their SQLite boundaries.
- Automatic `stop` persists its sealed decision and blocks without replacement. Automatic `replan` exposes only the deterministic saved decision and prior attempt through the typed snapshot, blocks, and requires public `recover` with an explicit validated plan to append revision one. It does not fabricate a plan or a second decision.
- Manual continuation alone clears the completed promise. Automatic retry/switch keeps the original active promise. Deferred explicit replan re-arms the timer while preserving the original absolute monotonic deadline. The controlled-time regression establishes deferred recovery first, resumes into a hanging acceptance collector, advances the host and monotonic clocks beyond the original deadline, and observes abort, no acceptance finalization, no additional launch, and `orchestration_deadline`.
- The source keeps change-journal blocking ahead of automatic recovery. The combined suites also retain the final recovery-policy/store admission checks for held state, unsafe or unknown evidence, foreign lineage, stale authority, and single activation.

The two earlier maker attempts remain historical failures: 58/59 due to a strict-input fixture error, then 60/61 because a 30 ms fixture expired before deferred recovery existed. The replacement controlled-time fixture changed only the test and passed on its first authorized attempt; it does not erase those receipts.

## Frozen hashes

- `D0F1E7835434FB6764CC6583A36EAC5EF19742170D33E40079F91EDF701AAFED` — `app/orchestration-driver.mjs`
- `053F1138E07705839FF283B8433E5A3E647922E98B12122DA54612489FC9A2A0` — `app/orchestration-driver.d.mts`
- `34A75701B8857C719CDC0C58FF068B56C7EAE5BCBE28FC5A42D12AD930610534` — `daemon/test/integration-driver.test.ts`
- `69882E2B73F6960E2CD238E070FC4DDF0C9A0E2BEA400DBF62DFF37659F97B46` — `LOOP.md`
- `4A718D060F19A965D44706E1471E4A2E1C90198676C8217BE4C10BFDafeda645` — `deadline-fixture-PLAN.md`
- `DCE1F9C76658B52669E1FA52B4C2372EA6D102832318C60DA3E0508762299FB0` — `deadline-fixture-maker.md`

## Limits

The runtime boundary is injected and the ledger/store is real SQLite. This review made no native, model, provider, billing, network, UI, or live workflow call and does not prove actual provider execution or automatic qualification. The default generated host still lacks the trusted recovery observations required by `automatic-approved`, so this unit does not enable default production automatic recovery. Cold ledger reopen remains non-resuming. The root-owned final build was not run by this reviewer.
