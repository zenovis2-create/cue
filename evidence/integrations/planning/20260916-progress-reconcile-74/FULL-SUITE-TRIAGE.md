# Batch 74 full-suite triage

Source: `full-suite.log`, completed 2026-09-16. This is read-only failure classification; it does not qualify or repair provider behavior.

## Terminal result

- Build: passed before Vitest.
- Test files: 249 passed, 6 failed, 255 total.
- Tests: 1661 passed, 47 failed, 9 skipped, 1717 total.
- Duration: 1319.85 seconds.

## Failure classes

### 1. Driver staging fixture mismatch: 42 failures

- `integration-driver.test.ts`: 41 failures. The common synthetic fixture persisted only process handles while declaring `file_change` and a change target. The mandatory staging guard therefore admitted no stages, and recovery, wait, acceptance, and timeout assertions cascaded from absent attempts.
- `integration-driver-real-restart.test.ts`: 1 failure at line 45 (`restart fixture closed before output`) from the same handle-only fixture declaring writable work without attempt-owned staging.
- Classification: test fixture contract mismatch at the mandatory writer-admission guard, not an account-identity or production driver defect.
- Resolution evidence: `evidence/integrations/S3/20260916-writer-admission/driver-fixture-correction/RESULTS.md`. Corrected driver plus real-restart tests pass 77/77; publication plus named orchestration controls pass 26/26. Raw logs are retained in that correction directory. The production writer-admission guard was unchanged.

### 2. Selection-preference catalog fixture: 2 failures

- `integration-selection-preference-core.test.ts`: 2 failures at lines 50 and 66. Both stop at `app/orchestration-driver.mjs:711` with `driver_account_identity_unavailable` during `prepareGoal`.
- Classification: the test catalog stub did not supply the now-required nonlocal `authReference` and `subjectDigest`; this is a fixture availability mismatch, not evidence that production account identity was unavailable.
- Resolution evidence: `legacy-fixture-corrections/focused.raw.log`; the corrected selection-preference and attempt-selection files pass their combined 15/15 focused gate.

### 3. Legacy migration fixture boundary: 1 failure

- `integration-attempt-selection.test.ts:106` fails while upgrading a real pre-025 ledger: `no such table: attempt_staging_setup`.
- The test helper's `migrate()` intentionally stopped at migration 031 and then invoked the current engine, whose staging dependency is introduced by migration 047.
- Classification: incomplete historical fixture migration boundary. The failure does not demonstrate a production migration defect because production startup applies the complete migration sequence before current-engine use.
- Resolution evidence: `legacy-fixture-corrections/focused.raw.log`; the corrected two-file gate passes 15/15.

### 4. Startup-fence positive fixture identity: 1 failure

- `p10c-core.test.ts:215` records `new Date().toISOString()` before spawning PowerShell, while `daemon/src/recovery.ts:21-28` requires exact equality with the OS-observed process creation identity.
- The child remains alive through the five-second poll, and the test forcibly cleans it with `taskkill` before failing `expect(alive).toBe(false)`.
- Classification: positive fixture identity bug. The bounded test-only correction records `observeProcessTree(child.pid).createdAt`; production matching and the reused-PID negative case remain unchanged.
- Resolution evidence: `startup-fixture/RESULTS.md`; the verified-live positive case and reused-PID negative control pass 2/2.

### 5. Deferred Codex pin: 1 failure

- `p10c-manifest.test.ts:25` receives child exit 1 from `daemon/scripts/p10c-manifest-proof.mjs:22`: `pinned Codex binary hash mismatch`.
- Classification: previously known unknown-SHA/deferred installed-Codex environment, not a new product regression.

## Cost-observation disposition

- `integration-budget.test.ts`: 9/9 passed in the full suite.
- `integration-cost-capacity-observation.test.ts`: 10/10 passed, including the strict persisted-receipt production read surface.
- No failure is linked to `daemon/src/budget.ts` or the cost-observation bridge.

## Environment and passing controls

- P13 lifecycle sensitivity H1-H18 passed; their `RED` labels describe expected negative fixtures, not suite failures.
- Windows model-boundary, targeted termination, read-only observation lease, WFP observation, Git staging, and model qualification suites shown in the log passed. This prevents classifying all failures as a general native environment outage.
- No model, provider, network, authorization, or additional live-budget call was made during triage.
