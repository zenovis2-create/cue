# Independent review: generated recovery observations

## Verdict

PASS for the bounded backend diagnostic-observation unit. No blocking source issue remains.

The adapter latches the first fixed diagnostic code with `??=`. Cancellation and deadline expiry remain distinct, subsequent native I/O cannot replace an earlier cause, arbitrary transport exceptions become `transport-failed` without inspecting their message, malformed frames become `protocol-invalid`, and successful results omit the diagnostic field. Native identity commit failure and missing/mismatched final native boundary evidence map to `native-boundary-unverified`; these two paths were source-inspected rather than exercised through a native launch.

The vocabulary contains only fixed host conditions. It contains no provider authentication, quota, transient-recovery, exception, response-body, path, or secret-derived category. The generated JSON host copies only `diagnosticCode` from a failed result. The strict activity validator accepts the optional field only for failed terminal activity, rejects unknown codes and diagnostics on success, and still accepts the earlier two-field terminal shape. Proxy and accessor-bearing inputs are rejected without invoking their traps/getters: proxy detection occurs before prototype/descriptor inspection, and the validator reads data descriptors only.

The activity payload remains in the existing immutable `orchestration_activity` store; no table, recovery authority, handoff fallback, UI projection, or inference was added. The real-SQLite tests verify exact replay, close/reopen persistence, rejected mutation/replay mismatch, and foreign attempt/identity/handoff lineage. The generated-host fixture uses the actual host/driver and real SQLite with mocked child executors; the added adapter fixture invokes the actual adapter with a mocked spawned child and real SQLite.

## Independent gates

Checker contract: done required the two existing safe focused suites, the mocked-adapter suite, current source hashes, and explicit limitations. Attempt cap was two; each failed pass required a new source-based hypothesis. Both gates passed on the first checker attempt.

- `cd daemon && npm exec vitest run -- test/integration-generated-json-host.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, 2 files, 26/26 tests passed.
- `cd daemon && npm exec vitest run -- test/integration-isolated-model-diagnostics.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, 1 file, 6/6 tests passed.
- Scoped `git diff --check` — exit 0.

The checker did not run `integration-isolated-local-model.test.ts`, a native process, a model, a network call, a live workflow, or a build. The maker reports a final build exit 0; that receipt was not independently repeated because root prohibited concurrent/redundant builds.

## Reviewed hashes

- `daemon/src/orchestration/failure-diagnostic.ts`: `571148AD3427DD4D45128CE4498A2A7ED317914FBDF1C0B395F59A901D1E617E`
- `daemon/src/orchestration/handoff-activity.ts`: `B6DF1DF93FBC3F160A88418CDA7D123B76541F2597B063C6FDB01BE062ED08BE`
- `daemon/src/adapters/isolated-local-model.ts`: `046854357DCC60CAD501AA1BD8BA2295D1020DBF06561B9E8B53EF2D6BCE06AF`
- `app/generated-json-host.mjs`: `F72110F8FFA69B3F83D94716C6385566BF773DACD2069C157A4705A6DA65FFAA`
- `daemon/test/integration-handoff-activity.test.ts`: `AF59E505CF212DA646E640E66043F63EECB9B5591E12D21128204309251FEAB2`
- `daemon/test/integration-generated-json-host.test.ts`: `CA4E3D3C6152E51404B27D3C23BA84EAD5E85D5D6B1DADC2DEA367098FF47726`
- `daemon/test/integration-isolated-model-diagnostics.test.ts`: `47289056BA5ECDE60244292C72FB33C134E77BECAE584789C8C3EC40633ADC27`

These product and test files are untracked in the shared worktree. The maker has no trustworthy immediate preimages, so this review cannot independently reconstruct an exact before/after source diff and does not substitute older historical snapshots. The hashes above bind the state actually inspected and tested.

## Limits

This result proves sanitized durable backend observations and mocked-child adapter semantics. It does not prove native runtime behavior, provider behavior, UI display, automatic recovery, retry classification, recovery authority, handoff fallback, or whole-S4 completion.
