# Independent review: owned broker launcher correction

Reviewer: `/root/broker_review`, 2026-09-11. Product files read-only. No Qwen call.

Initial status: **correction required**, despite the focused tests passing. Completion requires the original architecture gates plus broker roundtrip/cancel coverage and a contained actual spawn-failure regression; one remaining maker correction hypothesis was requested.

## Initial source scope

- `daemon/src/process-launch.ts`: `596764E6666CA4A4A03C1988706579005A2C27DA4045276236BA67762157DC78`
- `daemon/src/adapters/isolated-local-model.ts`: `6A1BC1D5ABADFC016536A82ADB24DA094080CF8B5E9469F50A28C0BDA305008B`
- `daemon/test/integration-isolated-local-model.test.ts`: `89F1CD519D139A0268E3B1D199EF29A576905FDD659531F5B137D6DBAAB5FF5B`

Native launcher changes for qualification are owned/reviewed separately. This correction review makes no assertion that earlier native file hashes remain current.

## Initial checks and finding

- Independent `npm run build`: exit 0.
- Independent `npx --no-install vitest run test/p4.test.ts test/p45.test.ts test/integration-isolated-local-model.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, **22 passed / 3 skipped**, 25.44 s, start 17:49:14 local time.
- Diff inspection confirms no architecture allowlist or gate relaxation. The adapter requires a real Ledger, uses `spawnOwnedPiped`, and returns a frozen session; the existing owned process implementation supplies executable sealing, cwd and session-handle registration. Child/guardian cleanup remains separate from the launcher session identity.
- **Blocking launch-failure finding:** when an owner cwd no longer exists, `spawnOwned` throws `spawn returned no pid`, but Node subsequently emits the ChildProcess `error` event without a listener. A caller catching the synchronous failure still receives an uncaught ENOENT exception, potentially terminating the daemon. This path was inherited from the old helper but is now exercised by the broker integration.
- Independent reproduction in a separate Node process imported the compiled `spawnOwnedPiped`, used `openLedger()` and an absent synthetic cwd, invoked the helper in try/catch, and attached a process-level `uncaughtException` observer solely to report the defect. Output: `{"syncFailure":"spawn returned no pid","unhandledError":"ENOENT"}`. No child/provider was started and no external files were changed.
- Maker was asked to own/consume the no-PID failure event and add a subprocess regression. Merely catching the adapter's rejected Promise is insufficient.

This report retains the initial failure even after correction; final evidence follows below when available.

## Final correction review

**PASS for the owned-launch correction.** The reproduced launch-failure defect is resolved by a single remaining maker correction: the no-PID path attaches a one-shot ChildProcess `error` listener before throwing. The failed child is not returned to a caller, no session is inserted, and the asynchronous ENOENT event is now owned rather than escaping as a daemon-level uncaught exception. Existing PID-bearing session registration and failure cleanup semantics are unchanged.

Final source hashes:

- `daemon/src/process-launch.ts`: `EA5819B562F55ED4776A48EDDD13CE79F9E3A43EC52841BE0203C2E14F561990`
- `daemon/src/adapters/isolated-local-model.ts`: `6A1BC1D5ABADFC016536A82ADB24DA094080CF8B5E9469F50A28C0BDA305008B`
- `daemon/test/integration-isolated-local-model.test.ts`: `A458907D2714EA950719318DB59A09BA7A11792F6E79C8D917038A9C46285068`

Independent final checks:

- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0. The maker rebuilt the compiled assets after the correction; the reviewer then executed their real compiled code below.
- Same focused P4/P45/broker command listed above: exit 0, **23 passed / 3 skipped**, 25.17 s, start 17:51:42 local time.
- The new test `owns asynchronous no-PID startup failure when approved cwd disappears` uses a separate actual Node process importing the compiled helper and a real ledger. It requires child status 0, no stderr, `caught: true`, `uncaught: false`, and zero session handles. It would fail for the earlier independently reproduced behavior.
- Existing compiled broker roundtrip still asserts the recorded launcher PID/task/run and frozen returned session, and still covers fixed endpoint/model, prefix-spoof text, overflow/EOF, cancellation and invalid response identity. Architecture source scans and their positive control continue unchanged.

The earlier live Qwen canary and `reviewer-probe.mjs` belong to the earlier API/source hashes. The adapter now requires `db`; those historical scripts were not silently updated or rerun as proof of the new revision. No second Qwen call was made. Native qualification changes remain a separate review. No eligibility, clean runtime receipt, provider-stop or billing guarantee is created by this correction.
