# Targeted termination OS gate

## Initial state

Both owned paths were absent before creation:

- `daemon/test/integration-targeted-termination.test.ts`
- `evidence/integrations/S4/20260915-targeted-termination/`

There is no source preimage because the test is new. Product source is immutable for this unit.

## Done contract

On Windows, one test-owned target controller and one independent sibling controller each spawn one grandchild and publish exact PIDs. Before termination, `observeProcessTree` must report the controller and its own grandchild with nonempty creation timestamps. The target and sibling PID sets must be disjoint.

Calling public `terminateVerifiedTree(targetPid)` must:

- produce a bounded audit closure containing the target controller/grandchild and excluding sibling identities;
- leave the target controller and grandchild dead;
- leave the sibling controller/grandchild alive;
- allow the sibling heartbeat file to advance after target death.

Finally, the test terminates the sibling through the same public API, verifies both sibling identities dead, restores the audit environment variable, and recursively removes only a resolved direct child of the resolved OS temp directory with the exact owned prefix and no reparse-point root.

This is local OS process-isolation evidence. It does not prove provider cancellation, billing termination, AppContainer parent-watchdog behavior, or whole-pipeline completion.

## Caps and gates

Attempt cap: 3 evidence-based corrections.

Every pass from `daemon`:

```text
npx vitest run test/integration-targeted-termination.test.ts test/p13-termination-scope.test.ts test/p12-parent-death.test.ts test/p12-enforcement-seal.test.ts test/integration-driver-real-restart.test.ts
```

No daemon build, provider, model, network, Electron, or native change helper.

