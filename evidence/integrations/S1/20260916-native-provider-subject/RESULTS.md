# Native provider subject results

## Outcome

Added `measureNativeProviderSubject(installation)` as a synchronous, fixed Codex measurement collector. It revalidates the issued installation before and after measurement, directly compares the measured executable SHA-256 with the installation descriptor, hashes the fixed source and compiled native controller/runtime/adapter/enforcement/receipt closure, fixed boundary and policy files, fixed current probe suite, and the current Windows build from the protected PowerShell path.

The returned frozen measurement contains only `subject`, `subjectDigest`, a content-addressed manifest, and limitations. It does not infer or issue authentication, entitlement, qualification, capability, or launch authority. Auth profile paths/content and account/evidence/receipt outputs are excluded.

## Gates

- Coordinated `build-subject`: exit 0.
- Daemon TypeScript no-emit: exit 0.
- Focused collector: 1 file, 2 tests passed, exit 0. Stable measurement, auth exclusion, executable drift, missing fixed artifact, and unissued descriptor refusal are covered. See `focused.raw.log`.
- Existing measurement-subject regression: 2 files, 11 tests passed, exit 0. See `measurement-regression.raw.log`.
- No provider, model, Qwen, or network call was made.

An exploratory adjacent provider-host regression ran 11 tests: 10 passed and one host-availability assertion failed after a concurrent constructor change. The failure occurs before this collector is invoked and is retained in `regression.raw.log`; it is not represented as a collector pass.

## Limits

This collector is Codex-specific. Claude remains unavailable until its actual runtime artifact closure is defined. The fixed source and probe closure is mandatory, so a packaged deployment that omits it is unavailable rather than partially measured. Probe files are fingerprints of the current suite and do not mean those probes passed. Provider service behavior and Windows system components remain outside the client artifact measurement.

Final hashes are recorded in `PINS.txt`.
