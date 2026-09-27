# Independent WFP bootstrap integration review

Status: **PASS for the offline coordinator seam and built-launcher artifact.** No WFP API, ACL command, native worker, provider, or model was invoked.

## Seam audit

- The fixture uses production `measureReadonlyVerifierControl`, `snapshotReadonlyVerifierControl`, `verifyReadonlyVerifierControl`, `createReadonlyVerifierWorker`, SQLite `openLedger`, and the real identity/cleanup tables. It mocks only root identification, owned process launch, and process termination/death observation.
- `renderReadonlyWfpLauncher`/`buildDefault` is pure: it reads the three canonical inputs and returns text. The fixture writes that text only to its newly created temporary root; it does not write shared `src` or `dist`. Recursive cleanup is limited to roots created directly under the process temporary directory and checked before removal.
- The worker's base64 stdin payload is decoded by the mocked OS launch edge and compared byte-for-byte with the exact generated launcher and measured control hash.
- Prelaunch launcher drift rejects with `readonly_control_drift` and zero spawns. Drift introduced during the ACL observation permits only the ACL spawn, blocks the worker spawn, and leaves both authority tables empty.
- The generated-launcher readiness-failure fixture returns a failed outcome with null identity and cleanup references; queries against the real SQLite authority tables on the fixture connection show zero identity and cleanup rows. Fixture stderr and exit 23 are failure evidence only and cannot grant WFP readiness or cleanup authority.

## Independent focused gate

From `C:\Users\User\cue\daemon`:

`npm exec vitest run -- test/integration-readonly-wfp-bootstrap.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0; 1 file passed; 3 tests passed; 0 failed.

Test SHA-256: `0325287E4578F3BF0D6652EFD9225AF0A407D57633E6FFA9814C12592160BCC0`.

## Built artifact verification

- Generator SHA-256: `ABDEA994BC183B4BD9371D1806C1DC315B40D387EFA1A3FEB5333CAD39FC611E`.
- `daemon/dist/src/readonly-verifier-wfp-launch.ps1` is 43,990 UTF-8 bytes with SHA-256 `E45D94BA23C988383B43D7B5F603978477630301BCE511E0BFDD0048B5BB9424`.
- A fresh in-memory `buildDefault()` render was byte-identical and hash-identical to the built artifact.
- PowerShell's parser reported zero errors without executing the wrapper.
- Extracting only the built artifact's embedded C# and compiling it offline succeeded. Reflection resolved `CueAppContainer.LaunchWithWfpObservation` and `CueWfpObservationLeaseFactory`.

This establishes packaging, transport, drift rejection, and fail-closed authority behavior at the mocked OS seam. It does not establish actual WFP availability, event collection, native process death, or production qualification.
