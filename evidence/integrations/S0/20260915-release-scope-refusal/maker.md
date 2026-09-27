# A06 release scope refusal maker evidence

## Result

The production orchestration driver is exercised in five independent cases. An outside approved model is refused during plan validation with `invalid_plan:scope-expansion` before attempt, lease, reservation, session, or adapter activity. A stage requesting `file_change` outside its approved read-only parent reaches no adapter or session; the test allows legitimate admission bookkeeping before stage refusal instead of claiming all counters remain zero. Reopening the same run, candidate, and measurement subject with only its opaque account reference changed is refused with `account_identity_conflict`. Reopening with a budget limit increased from 100 to 101 is refused with `budget_policy_mismatch`. Both reopen refusals retain adapter activity zero.

The positive control prepares, approves, activates, and starts through the same production driver. Its injected adapter is called exactly once and receives `approved-account` from the immutable opaque account binding. It creates no fabricated session row. The test explicitly requires `driver.settled()` and `driver.close()` to reject with `orchestration_cleanup_unverified`. This proves adapter admission only and does not claim successful execution, cleanup, a real account principal, or entitlement truth.

Temporary fixture deletion resolves every target and requires it to begin with the generated `cue-release-refusal-` prefix under the system temporary directory before recursive removal.

## Correction history

The earlier combined test was blocked because its positive oracle incorrectly demanded successful settlement from a deliberately incomplete runtime fixture, and its changed-account case replaced the catalog with an empty one. Root authorized a two-pass oracle correction. Pass 1 split the cases, retained the same candidate and subject for account drift, made unresolved cleanup the positive expectation, removed the fabricated PID/session, and constrained cleanup. Its only failures were exact error-label mismatches: observed `invalid_plan:scope-expansion` and `budget_policy_mismatch`. Pass 2 asserted those production errors and passed.

## Gates

- Focused: `npx --no-install vitest run test/integration-release-acceptance.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — 1 file / 5 tests PASS.
- Neighboring regression: `npx --no-install vitest run test/integration-release-acceptance.test.ts test/capability-admission.test.ts test/integration-account-binding.test.ts test/integration-stage-envelope.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — 4 files / 32 tests PASS.
- Scoped `git diff --check` — exit 0.
- Final test SHA-256: `09c10c67cfe41ce6e9c9fb5f984697c1d4b9d141e989a099990f50df4706952a`.

No product source or existing test was edited. No build, provider, local endpoint, native helper, Electron, network, or real credential was used.
