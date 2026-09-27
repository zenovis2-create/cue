# Independent targeted-termination review

Verdict: **PASS for the bounded Windows process-isolation claim.**

The corrected test discovers each fixture tree through the production `observeProcessTree` API and waits until the explicitly created grandchild is present. It proves the target and sibling observed PID sets are disjoint before mutation. After `terminateVerifiedTree(targetPid)`, it requires the audit closure to contain the explicit target controller and grandchild, contain no duplicate PID, exclude both explicit sibling identities, and verifies every PID actually recorded in the target closure is dead. This correctly accommodates additional Windows descendants attributed by the production snapshot without discarding them from the death check.

The sibling controller and grandchild remain alive after target termination, and the grandchild-owned heartbeat advances afterward. Cleanup terminates the sibling through the same public API. The `finally` path tracks both spawned controllers, attempts tree termination for any still-live identified controller, waits for process close, restores the environment variable, and removes only a resolved, non-symlink direct child of the OS temp directory with the owned prefix.

The test does not capture arbitrary system PIDs. Explicit fixture identities come from child stdout, while additional PIDs enter the assertion only through the production process-tree observation/audit closure. Product observation requires creation timestamps on parent-child edges and refuses a closure containing the test process or its ancestor chain before calling `taskkill /T /F`.

## Independent gate

Command run from `daemon`:

```text
npx vitest run test/integration-targeted-termination.test.ts test/p13-termination-scope.test.ts test/p12-parent-death.test.ts test/p12-enforcement-seal.test.ts test/integration-driver-real-restart.test.ts
```

Result: exit 0; 5 files passed, 10 tests passed. Vitest reported 15.29 seconds overall and 23.92 seconds aggregate test time. Raw output is in `checker-gate.log`.

## Evidence pins

- `daemon/test/integration-targeted-termination.test.ts`: `1d341625fcc7eabc6f6a8b748326460f9082934340bcb0ad710eb9bed9b13a4c`
- Reviewed `daemon/src/process-termination.ts`: `d4abcf16496838e8d2d279cc9d9c2e1decb0063aa7c433be98e2499020987f6c`
- `checker-gate.log`: `dfad37e4868930e29560932191437974e841eb03b4624de07d2cb4a1f4c9eeb3`

## Limits

This demonstrates actual local Windows process-tree termination and sibling isolation for the fixture. It does not demonstrate provider cancellation or billing cessation, qualify parent-death behavior beyond the included existing regression tests, or prove behavior on non-Windows platforms. The test observes a pre-kill closure; it does not claim atomic protection against every process-creation or PID-reuse race between observation and `taskkill`.
