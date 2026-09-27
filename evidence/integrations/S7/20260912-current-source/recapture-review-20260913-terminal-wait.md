# Current static source recapture review — terminal-wait attempt

Verdict: **PASS for independent integrity of the existing active generation; no new recapture was produced by the terminal-wait attempt.** The generator attempt exited 1 because it tried to rename staging directory `.staging-cb93d71b-d95d-4ed7-9980-e15e71db330b` onto the already existing generation `097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5` and received `EPERM`. No generation or prior review was deleted or replaced.

## Existing active generation

- Active generation: `generations/097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`
- Snapshot digest: `097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`
- Pointer manifest SHA-256: `7ab0065282ca58f62c66b5188890eedc0f9cfccfd45224ea4e33183003e530a1`
- Source files: 164
- Declared import edges: 371

## Independent checks

The pointer, generation name, manifest digest, result digest, and before/after source-basis snapshot digests agree. All five manifest artifacts matched their recorded SHA-256 and byte count:

| Artifact | Bytes | Result |
|---|---:|---|
| `cue-current-source.html` | 124,890 | PASS |
| `cue-current-comparison.html` | 158,315 | PASS |
| `source.json` | 120,518 | PASS |
| `source-basis.json` | 708 | PASS |
| `result.json` | 319,498 | PASS |

All 164 files listed by `source.json` were independently read from the current scoped `app/` and `daemon/src/` worktree and rehashed. Missing files: 0. Hash mismatches: 0.

The static extractor scope contains source files with the supported JS/TS extensions under `app/` and `daemon/src/`. The changed `daemon/src/readonly-verifier-launch.ps1` is outside this static source inventory; therefore this check does not claim that the snapshot covers that PowerShell file. The unchanged digest is expected from the declared scope and is not evidence that the excluded file was captured.

The source-basis before/after values prove stability during the original capture. The worktree is not clean: unrelated/current `app` and `daemon/src` changes are present by design. This review makes no clean-Git claim.

## Attempt boundary

The terminal-wait attempt was not rerun. Its failed duplicate-generation rename was recorded as an attempted recapture failure. The staging directory remains preserved for owner follow-up. No generator, build, test, screenshot, Electron, UI, model, or native-worker command was run for this independent check.
