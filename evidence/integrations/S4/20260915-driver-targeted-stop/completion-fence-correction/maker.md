# Maker record — A03 targeted Stop completion fence

## Candidate

Only `daemon/test/integration-driver-targeted-stop.test.ts` changed. Product and driver source remain untouched.

The fixture now separates `cancelRequests` from a per-attempt `cancellationCompleted` set. Its close promise is created before invoking termination. The completion fence then awaits `Promise.resolve(terminateVerifiedTree(...))`, the registered child close, and a bounded poll showing every original PID/creation pair absent. Only after all three does it publish completion and resolve the fixture execution.

The actual test emits synchronous JSON frames containing both before identity sets, target completion and exact absence, sibling heartbeat and current identities before sibling Stop, final exact absence for both trees, and cleanup observations. Assertions consume those observed values after emission so a failure leaves inspectable evidence.

A platform-independent preflight holds termination and close on separate deferred promises. It proves request entry does not imply completion and completion remains false after termination until close is released.

## Offline ledger

1. Revision 1 filtered preflight: exit 0, one test passed and the Windows actual test was filtered/skipped.
2. Planned `npm run typecheck`: exit 1 because the package has no such script. This command-selection failure is preserved.
3. Correct repository typecheck on revision 1: exit 1 with TS2322 because the absence callback returned the observer array rather than `Promise<void>`.
4. Revision 2 changed only that callback to await the observer without returning its array.
5. Revision 2 filtered preflight: exit 0, one passed and one actual skipped.
6. Revision 2 `npx tsc -p tsconfig.json --noEmit`: exit 0.
7. Loop contract score: 100/100 with all seven critical contracts present. This document score is not runtime proof.

The two-revision offline cap is exhausted. The independently cleared candidate hash is `EE2E7682D28D616D438127C7130D7C22F268D55B1D5C75DE91AA628A79EEDA6A`.

## Actual status

The separately authorized corrective Windows attempt has not run. Root instructed this worker to wait for the concurrent UI actual gate and then receive an explicit coordination signal. Prior actual attempts 1 and 2 and their failures remain unchanged in the parent evidence directory.

No model/provider, network, Electron/native application, commit, push, product build, or product/driver edit occurred. Cancellation evidence does not establish provider cleanup or billing.
