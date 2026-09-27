# Maker receipt — change-record boundaries

## Scope

- Product source was not changed.
- The only test file changed was `daemon/test/integration-change-records.test.ts`.
- Its complete pre-edit bytes are preserved at `preimages/integration-change-records.test.ts`.
- The implementation used both planned passes. Pass 1 established missing-authority and digest-substitution behavior (18/18) but did not reach the authorized stopped-restore branch. Pass 2 added that branch and passed 19/19.

## Behavioral coverage

1. A public `restoreStoppedChangeSet` call with a supplied host but missing restore authority throws `restore_authority_missing`; both callbacks remain at zero calls.
2. A fixture-injected stopped-decision row plus the existing exact workspace lease reaches the public authorized restore path. It returns `{ restored: false, reason: 'atomic-race-closure-unsupported' }`, invokes neither callback, and leaves the target bytes unchanged.
3. After exact capture, substituting stored preimage bytes while retaining the original digest label makes public capture replay throw `change_set_replay_mismatch`; no second change set is inserted.
4. Recursive cleanup resolves each target and deletes it only when it is a direct child of the resolved OS temp directory with the owned `cue-s4-change-` prefix.

For case 2, the fixture disables SQLite foreign keys and drops only the recovery-decision insert validation triggers needed to inject the minimum stopped-decision row. It therefore proves the change-record API branch, callback behavior, and byte preservation, but does not claim policy-qualified stop creation. Case 3 proves digest-label/byte substitution mismatch resistance; it does not construct or claim a cryptographic SHA-256 collision.

## Gates

From `daemon`:

```text
npx vitest run test/integration-change-records.test.ts test/integration-change-records-native.test.ts test/integration-journal-packaging.test.ts
```

- Pass 1: exit 0; 3 files passed; 18 tests passed.
- Pass 2: exit 0; 3 files passed; 19 tests passed.
- No build was run.

## Hashes (SHA-256)

- Final test: `DE8911EEB410C5B8A8ACF3D88778A242C0523730842635A5439EE604A6439992`
- Corrected PLAN: `B8563C532F9DF9F85CACEB2C8110D6BF903F0BDE226EDA1AA2EB710490BDC016`
- Preimage: `B76CB89CF8BC6246782449CEC52F115F0CECE5C22F35BC8EC354F08E777D35B6`

Independent closure determination remains with the checker.

