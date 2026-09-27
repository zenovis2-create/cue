# Independent driver change-observation exclusion review

Status: **PASS for the bounded early-exclusion change.** No native helper, model, provider, or external tool was invoked.

## Source audit

`app/orchestration-driver.mjs` treats exactly `unknown`, `outside-manifest`, `moved`, and `type-changed` as unsafe. The production receipt path calls the predicate immediately after the real `observeChangeSet` result and blocks with the existing `change_observation_unknown` reason before retry/recovery handling. `unchanged`, `modified`, `created`, and `deleted` remain allowed by this gate.

The real `moved` fixture is branch-sensitive. It uses unverified cleanup so the unresolved write lease remains. Without the new observation predicate, that condition would still prevent an ultimate retry but would fall through to the later `orchestration_evidence_unverified` reason. The asserted earlier `change_observation_unknown` reason therefore proves precedence at the intended new branch; zero recovery decisions alone would not prove it.

## Actual-driver and real-store evidence

- The negative fixture runs the production driver with real SQLite orchestration and change stores. It deletes and recreates the captured target, and the real observer persists `moved`.
- The driver blocks with `change_observation_unknown`, launches only the original `make` attempt, adds no recovery decision or plan revision, and retains one unresolved workspace write lease plus the persisted change observation.
- The positive control changes the same file in place. The real observer persists `modified`, and the driver passes the new observation gate to the existing downstream `orchestration_evidence_unverified` block. This proves `modified` is not mislabeled as an unsafe observation; it does not claim the deliberately cleanup-unverified attempt was eligible to retry.
- Direct runtime coverage is intentionally limited to `moved` and `modified`. Exact inclusion of `unknown`, `outside-manifest`, and `type-changed`, and exclusion of the other allowed statuses, is source-inspected at the single set/predicate. Related change-record tests exercise the native-mocked status classifications.

## Independent gate

From `C:\Users\User\cue\daemon`:

`npm exec vitest run -- test/integration-change-records.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: exit 0; 2 files passed; 41 tests passed; 0 failed.

Frozen SHA-256:

- `app/orchestration-driver.mjs`: `BED119B1AE141EC596009118E26ED4050ADFC74A7C7FE368744F56C768A0A0CB`
- `daemon/test/integration-driver.test.ts`: `628C7E60A12CD74EE9AAF64B306ABA6E88CCCF1561019520A6ACD5B61A7AE631`
- `PLAN.md`: `6A25B95E4F2EEA9B1CD5AB44B5CBC26BB6C73F338C49A779B92416844E3FA980`
- `RESULT.md`: `48EF6AE9996C4696BD82447DB3C17A230E66988597AAD0B21ACD5806FE0F14E2`
- `maker.md`: `CB5796875E1AF65C18F7D3B3CB1332C74175FA722EE882CB119047804D13E3C3`

Build remains a root-coordinated gate outside this independent review.
