# S4-03 change-record boundary plan

## Completion contract

- Preserve the complete pre-edit test file.
- Through the public restore API, prove that a supplied atomic host is never called when restore authority is absent.
- Through the public restore API with fixture-injected stopped-decision authority and the existing exact workspace lease, prove the current implementation returns `{ restored: false, reason: 'atomic-race-closure-unsupported' }`, invokes neither host callback, and leaves the file unchanged.
- Prove that substituting stored preimage bytes while retaining the original digest label is rejected during public capture replay. This is digest-label/byte mismatch resistance, not a fabricated cryptographic collision.
- Before recursive fixture cleanup, require each resolved target to be a direct child of the resolved OS temp directory and to carry the owned `cue-s4-change-` prefix.
- Change only `daemon/test/integration-change-records.test.ts`; do not change product source or run a build.

The stopped-decision case may relax SQLite foreign-key and immutable-insert constraints solely to inject the minimum authority row. It does not claim the row was produced by the recovery policy or that the stopped decision is otherwise qualified.

## Attempt cap

Two implementation/test passes. A failed pass must use a different evidence-based correction; otherwise stop and report the blocker.

## Gate for every pass

From `daemon`:

```text
npx vitest run test/integration-change-records.test.ts test/integration-change-records-native.test.ts test/integration-journal-packaging.test.ts
```

No providers, Qwen, network, Electron, or shared build.

## Preimage

- `preimages/integration-change-records.test.ts`
- SHA-256: `B76CB89CF8BC6246782449CEC52F115F0CECE5C22F35BC8EC354F08E777D35B6`

