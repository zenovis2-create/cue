# Independent review

Verdict: **bounded unit clear; broad completion blocked by one hostile restart gate and actual-process evidence**.

Reviewed frozen source hashes match `../RESULTS.md`:

- `staging-authority.ts`: `26d1f0d968785e0613bdc1d2e828c2f85dacdefa1d481cfa474140d1f336aa57`
- `git-staging-factory.ts`: `da2095b6909934617fd137515c129e0d4fb383ddec0c190897b26a03edd043cb`
- `orchestration-driver.mjs`: `ee129d31d86dd4aed36e9cccfa1fa8d9f2baa0f28338a4a86e43354edea5d4ab`
- factory test: `03cd459646e52ea09de749206035401b70f7b87a74ae83c89b0982d19310bae1`
- driver test: `0db9a3062d884d0cff3b9860b1f7b23b470da6215539403845373fd5e989cc33`

The original data-loss concerns are corrected. Reconciliation derives an exact target set from one attempt-bound change set, joins each exact ordinal/path publication intent to a committed result, validates the sealed `change_entry.preimage` bytes against their stored digest, length, and cap, and passes those bytes to the native identity-bound compare/write. It no longer derives restoration bytes from `git show` or trusts a prechecked SHA alone. The factory refuses staged, conflicted, untracked, ignored, renamed, deleted, extra, missing, identity-changed, content-divergent, and native-contention surfaces before no-force cleanup.

The reachable public-driver path also has a meaningful quiescence boundary: the execution value is available through the private `deferredFinishes` WeakMap only after engine reconciliation has observed `handle.inspectCleanup()` ready and `snapshot.cleanup === 'verified-clean'`, with attempt lineage checked. `cleanupActive` rechecks run/task/attempt lineage, running state, `cleanup === 'clean'`, and nonempty cleanup evidence. This supports the Cue-owned candidate/session writer boundary. It does not prove exclusion of arbitrary external editors; native compare/write and non-force Git cleanup preserve detected external divergence.

Independent command from `daemon`:

`npm test -- --run test/integration-git-staging-factory.test.ts test/integration-git-staging-driver.test.ts`

Result: exit 0, 2 files and 7 tests passed in 38.41 seconds. The command's pretest also completed the daemon TypeScript build and asset copy successfully.

Open required evidence: no deterministic two-target case currently forces the first native restoration to commit, the second to contend, and then reopens/retries the public driver while proving zero replacement read, zero republication, and zero cleanup/reconciliation retry. The immutable `active_cleanup_unknown` row and lease triggers make the source design fail closed, and committed publication rows are replay barriers, but the exact partial-mutation/restart composition remains unexecuted. Synthetic tests cannot establish actual provider/process termination, so broad S3 closure also requires a real Cue-owned process quiescence run.
