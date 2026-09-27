# Read-only launcher terminal wait result

Status: PASS within the two-pass cap.

## Focused gate

Command from `daemon`: `npm exec vitest run -- test/integration-readonly-terminal-wait.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Final result: exit 0; 1 file and 6 tests passed. The executable embedded-C# harness injects termination, wait, and last-error delegates. It proves `WAIT_OBJECT_0` success, termination refusal without a wait, `WAIT_TIMEOUT`, `WAIT_FAILED`, and unexpected-result failure, with no duplicate termination. It also verifies timeout, cancellation, and parent-death source branches share the helper.

## Build and parity

- `npm run build`: exit 0 after correcting one test-only TypeScript narrowing error found on the first build.
- `src/readonly-verifier-launch.ps1` equals `dist/src/readonly-verifier-launch.ps1` byte-for-byte.
- No live worker or native/provider/WFP API was invoked.

The launcher returns timeout/cancellation codes 124/125 only after its process handle returns `WAIT_OBJECT_0`. Other outcomes throw and therefore do not report a verified terminal status. This does not prove whole-job death or identity qualification.

## SHA-256

- Source launcher: `2788df21832e18822ce49348f0f1d2f454adefd61a78d579003c0835ce03fbc1`
- Copied launcher: `2788df21832e18822ce49348f0f1d2f454adefd61a78d579003c0835ce03fbc1`
- Focused test: `9b0926cb0aeb3ca018be61c22f8e91e4a1b2223602e51be8910eb9ecd4b41a97`
