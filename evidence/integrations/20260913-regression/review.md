# Independent retained full-suite review

Verdict: **PASS for the executed scope**

I reviewed the retained artifacts only and did not rerun tests or the build. The recorded command was:

```text
npx --no-install vitest run --reporter=verbose --reporter=json --outputFile.json=../evidence/integrations/20260913-regression/results.json --fileParallelism=false --maxWorkers=1 --exclude=test/p10c-manifest.test.ts
```

`exit.txt` contains `0`. The JSON report has `success: true`, 191 test files, 1,266 passed tests, zero failed tests, and five skipped tests out of 1,271 total. Its assertion records contain no status other than `passed` or the five declared `skipped` cases. The verbose log ends with the same counts and duration, `1019.04s`, and records the JSON output path. Searches found no failed-suite, unhandled-rejection, lifecycle-error, missing-test, or npm-error marker.

The only excluded file was `test/p10c-manifest.test.ts`. It exists in the tree and does not appear in the JSON results. Its result is therefore **scope-excluded/unknown**; this review does not convert that historical manifest case into a pass.

## Actual skipped cases

- `test/p4.test.ts`: `P4-1 Orca adapter > round-trips the installed Orca worktree ps without mutation`
- `test/p4.test.ts`: `P4-2 and P4-4 owned Codex sessions > launches the real vendor Codex through the AppContainer supervisor`
- `test/p45.test.ts`: `Phase 4.5 launch-path seal > P4-2 OS cwd query (SKIPPED on Windows: Win32_Process exposes no cwd)`
- `test/p6.test.ts`: `Phase 6 conversation surface > P6 external Buzz live delivery and @cue registration — SKIPPED: would mutate an external system`
- `test/p7.test.ts`: `Phase 7 reporting, annotation, and publishing > P7 external artifacts share and real Orca capture — SKIPPED: would mutate or require an external system`

## Artifact and source bindings

- `results.json`: `F16C7404427FA7ABEBCD7F4B2DD847A4F467A80C5D614AB223C9A1B32C3AD507`
- `verbose.log`: `41CF5E1B511C075D1703885B5FCDC5A63028DBF399916B2B0DA32BC76A13608E`
- `exit.txt`: `13BF7B3039C63BF5A50491FA3CFD8EB4E699D1BA1436315AEF9CBE5711530354`
- current `daemon/src/ledger.ts`: `19BCB46C6C3D0C02B2F6B4CF828C1D277072DEF59FF4E158F2E8535CE394E47E`

No suppressed suite error or discrepancy was found in the retained evidence. The pass applies to the exact executed scope and preserves the excluded manifest file as unknown.
