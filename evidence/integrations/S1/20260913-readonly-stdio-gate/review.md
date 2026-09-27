# Independent stdio gate preflight

Status: **PASS — ready for one root-authorized execution of the exact frozen command.** This review did not execute the native gate.

Done meant a materially new, single-use gate pinned to the reviewed inherited-NUL launcher; one fresh owned root and attempt; exclusive intent and expected receipts before launch; exact authority closure; fail-closed worker and terminal parsing; and retained post-cleanup observations. The review ran the focused offline gate once and allowed no native child, profile, model, provider, or external-network action.

## Frozen inputs

- Runner: `6E790A9E8DB93E6292C7EE667CD2B3BBB45E72376371E3C6C2497B834C4B4E78`
- Test: `200B1A9CE8315968BC090E10FAF73EE5457937F351EBBDACDD1D6829E1115D1B`
- Manifest: `3EED03B2C81DDF63F16EB68D9E64911778086038C945452F398E1782A3CEFE26`
- Repaired launcher: `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`
- Owned root: `D:\Temp\User\Cue.ReadonlyVerifier.StdioGate1`
- Attempt: `actual-attempt1`; `maxBoundaryLaunches: 1`; model/provider/external-network counts: zero.

The manifest pins the runner, test, probe client, repaired launcher, Node executable, helper adapter, process-launch, change-snapshot host, process-termination, and the change-snapshot manifest/helper. The run path verifies all eleven hashes before dynamically importing the authority helpers or creating the intent marker.

## Contract inspection

- The owned root and the intent, expected, and result paths were all absent at review time. Historical gate markers are separate and are neither read as authorization nor reset.
- `intent.json` uses exclusive `wx`. After the positive host loopback control and before the native PowerShell call, `expected.json` uses exclusive `wx` and records the nonce plus exact command-line SHA-256.
- The embedded client bytes are pinned and carried in argv. The payload retains the production eight-key environment. Host PowerShell observations use the fixed three-key host environment through the pinned adapter.
- Success requires a single exact nonce-bound exit-zero frame, a positive PID followed by process-death verification, one exact cleanup frame bound to nonce/root identity, successful launcher/ACL/profile host observations, restored root identity and exact SDDL, unchanged fixture bytes, no residual profile, zero worker loopback connections, and all expected worker read/write results. Missing or malformed worker output becomes `null` and cannot pass.
- Failure retains the owned root and bounded diagnostics. Normal terminal PASS/FAIL receipts include launcher, ACL, profile, and expected evidence; the exception path writes a durable failure receipt. Post-launch parsing does not remove a failed root.
- The mutation evidence is correctly limited to the client's tested filesystem operations, including `fs.chmod`; it makes no arbitrary security-descriptor denial claim.

## Executed offline evidence

- `node --test scripts/reuse/readonly-verifier-stdio-gate.test.mjs`: **15/15 PASS**, exit 0.
- `node --check` for runner and test: PASS.
- No-run manifest output matched the intended version, attempt, owned root, launcher hash, and call caps.
- Independent SHA-256 checks matched all frozen top-level hashes above; the focused test verified every runtime authority pin.

If root authorizes execution, the exact command is:

```text
node scripts/reuse/readonly-verifier-stdio-gate.mjs --run
```

It is authorized for at most one invocation. A nonzero result remains a closed gate and must not be retried under this receipt. Passing would establish only the bounded Unit A filesystem/network/process-cleanup observations represented by this gate; it would not establish a coding acceptance host or explain the earlier `0xC0000142` failures.
