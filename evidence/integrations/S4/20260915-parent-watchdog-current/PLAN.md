# Current-source parent-watchdog OS gate

## Purpose

Re-measure existing product parent-watchdog behavior after the final coordinated daemon build. This is not a new parent-death implementation.

- `p12-parent-sentinel.test.ts` runs the actual AppContainer launcher with a separate live sentinel as `parentPid`, kills the sentinel while the launcher remains alive, and requires worker death and AppContainer profile absence.
- `p10c-containment.test.ts` exercises actual OS children through the product host/controller and capability-zero worker paths. Its daemon-parent case captures process identities before and after parent death and records `P12_PARENT_DEATH_IDENTITY`.
- `p12-parent-death.test.ts` retains the static fail-closed launcher anchors.
- The verification and enforcement-seal suites ensure parent death does not substitute for evidence acceptance or permit post-seal tool calls.

Success requires worker/process death and profile absence in the test body. afterEach/finally fallback cleanup is not credited as a pass: both actual tests capture the pre-fallback liveness state and assert it was already false.

## Isolation

The single gate invocation must create a fresh canonical directory that is a direct child of the resolved real OS temp directory and has prefix `cue-parent-watchdog-current-`. The Vitest subprocess receives both `TEMP` and `TMP` set to that directory, confining every test `tmpdir()` root below it.

After Vitest exits, the runner must:

1. preserve stdout/stderr, including the complete `P12_PARENT_DEATH_IDENTITY` line;
2. enumerate only the explicit controlled temp base;
3. refuse cleanup if its resolved parent differs from the resolved OS temp directory, its basename lacks the exact prefix, or it is a reparse point;
4. recursively remove only that base after all observed owned PIDs are absent and profile assertions have completed;
5. retain the base and report failure if process death or path identity is unknown.

## Gate

One actual OS attempt after root confirms final daemon build and source/dist freeze:

```text
npx vitest run test/p12-parent-sentinel.test.ts test/p10c-containment.test.ts test/p12-parent-death.test.ts test/integration-verification.test.ts test/p12-enforcement-seal.test.ts
```

The runner must execute from `daemon` with the controlled `TEMP`/`TMP` described above. Final source and compiled hashes must be captured immediately before the run and compared afterward. `preflight.json` is explicitly preliminary and cannot authorize the run.

## Boundaries

- Actual attempt cap: 1.
- No product/test edits or daemon build in this unit.
- No real Codex/provider/model/network/native change helper.
- The controller is a local fake protocol fixture; processes and AppContainer enforcement are real Windows boundaries.
- Passing does not prove provider terminal acknowledgment, billing stop, unknown Codex identity, local-model support, or the whole release.

