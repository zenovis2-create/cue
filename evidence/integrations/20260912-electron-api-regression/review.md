# Independent Electron API regression review

Result: **PASS for the bounded Electron API regression gate**. The static API correction is exact. The initial test run timed out before cleanup injection during concurrent source/build mutation; after the root declared the final source/build freeze, the second and final bounded direct proof reached the original forced-cleanup path and produced the required fail-closed receipt. This review does not claim the Electron suite passes.

## Static API check

I evaluated `app/preload.cjs` in a VM with a mocked Electron bridge, captured the exposed `cue` object, sorted its keys exactly as the proof does, and compared those keys with the literal expected array in `scripts/p11-electron-proof.mjs`.

- Actual preload keys: 14
- Proof expected keys: 14
- Exact ordered equality: true
- Every exposed value is a function: true
- Expected and actual keys: `approve`, `candidateInventory`, `evaluation`, `execute`, `localJsonSetup`, `nativeRecovery`, `prepare`, `prepareJson`, `report`, `resources`, `retrospective`, `selectionPreferences`, `setSelectionPreference`, `stop`

The assertion remains an exact `assert.deepEqual`; it does not permit additional or missing renderer methods. The scoped proof-script diff is one added line and one removed line (`1 1`). No file mode or permission change appears in the scoped diff.

## Original focused test

Run once after the root reported the full baseline finished:

```text
cd daemon
npx --no-install vitest run test/p12-electron-proof-result.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Result: exit 1; 1 test file failed, 1 test failed, duration 25.99 s.

The test expected the failure receipt to contain `forced cleanup failure`, but received `Error: FAIL: inspector timeout`. The timeout originates from the 10-second `Runtime.evaluate` reply deadline at `scripts/p11-electron-proof.mjs:62`. Therefore the initial run did not prove that the cleanup-failure injection was reached. It is retained here as a failed first attempt.

## Frozen second bounded attempt

After the root reported a successful final daemon build and explicitly froze startup-test source/build edits, I invoked the same proof runner directly with an owned persistent output directory and the exact test environment:

```text
NODE_ENV=test
CUE_EVIDENCE_PHASE=P12
CUE_ELECTRON_PROOF_OUTPUT_DIR=evidence/integrations/20260912-electron-api-regression/attempt2
CUE_ELECTRON_PROOF_FORCE_CLEANUP_FAILURE=1
node scripts/p11-electron-proof.mjs
```

The 10-second inspector deadline was unchanged. Result:

- Process exit: 1, as required for injected cleanup failure
- Parent output: `Error: forced cleanup failure`
- Failure receipt: `passed:false`, error contains `forced cleanup failure`
- Passing result artifact: absent
- Pending artifact: absent
- Inspector timeout: did not recur
- Electron child startup/debugger log: preserved in `attempt2/p12_electron_live.log`
- Renderer screenshot: preserved in `attempt2/p12_electron_window.png`

This reaches the same production proof path spawned by the original Vitest case; direct invocation preserves the owned evidence that the test's `afterEach` normally deletes.

## Scoped checks and identity

- `git diff --check -- scripts/p11-electron-proof.mjs`: exit 0 (only Git's CRLF working-copy warning)
- `scripts/p11-electron-proof.mjs` SHA-256: `B99FAB2DA3A7CD41CB0B28BAFD01F07140510834BE5A9432D9D7DF3D737A723E`
- `app/preload.cjs` SHA-256: `BAEC01DBC7DFD3FA7665887A02B2B9A0B91D4316D90B0F517D7C9902B843FEDC`
- Attempt 2 child log SHA-256: `14B007507891E04BC71CE47429877C36F8FD83BF0897E9E6DF96E7B437FA8E4E`
- Attempt 2 failure receipt SHA-256: `A9406D08E374142002A52C7B27D1515AC8459070D4CC63B1222E60393514ACD8`
- Attempt 2 screenshot SHA-256: `41274DE6C95A37A3AC9177A24F671B8381A32DBF9C332D907EFECC9E7A03AABC`
- Reviewer-owned source/product edits: zero
- Model/provider calls: zero

The API inventory correction and the frozen original forced-cleanup proof path pass this independent bounded review. The earlier timeout remains recorded and is consistent with the observed concurrent source/build state; this receipt does not generalize beyond the scoped regression gate.
