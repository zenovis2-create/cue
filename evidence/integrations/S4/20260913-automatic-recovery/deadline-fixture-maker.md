# Deferred recovery deadline fixture maker evidence

Date: 2026-09-13

Scope: test-only deterministic replacement for the deferred-replan deadline regression in `daemon/test/integration-driver.test.ts`. No production source, other tests, native runtime, provider, model, network, live call, or build was used.

The fixture installs scoped Vitest fake timers and spies on the same `node:perf_hooks` `performance` object imported by the driver. It establishes the automatic deferred `replan` decision while the original deadline is still comfortably future, resumes the exact exposed decision with a valid revision-one plan, and waits for the resumed run to enter the fixture's hanging acceptance capture. It then advances both the injected host clock and monotonic clock/timers past the original deadline. Assertions prove the acceptance signal was aborted, acceptance was not finalized, the snapshot reason is `orchestration_deadline`, and launches remain exactly `make, make, check`. The capture, driver, spy, and fake timers are restored in `finally`.

Attempt 1 command, run from `daemon`:

`npm exec vitest run -- test/integration-driver.test.ts test/integration-recovery-policy.test.ts test/integration-held-recovery-admission.test.ts test/integration-held-retry-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: exit 0; 4 test files passed; 61 tests passed; duration 15.28 s. No correction pass was needed; one of two allowed attempts was consumed.

SHA-256 after the passing gate:

- `34a75701b8857c719cdc0c58ff068b56c7eae5bcbe28fc5a42d12ad930610534` — `daemon/test/integration-driver.test.ts`
- `4a718d060f19a965d44706e1471e4a2e1c90198676c8217be4c10bfdafeda645` — `deadline-fixture-PLAN.md`
- `d0f1e7835434fb6764cc6583a36eac5ef19742170d33e40079f91edf701aafed` — observed `app/orchestration-driver.mjs` (unchanged by this maker)
- `053f1138e07705839ff283b8433e5a3e647922e98b12122da54612489fc9a2a0` — observed `app/orchestration-driver.d.mts` (unchanged by this maker)

Limitation: this is a real SQLite/driver integration with injected runtimes and controlled clocks. It proves deadline preservation and cancellation at that boundary; it is not evidence of provider execution or billing.
