# Staging publication reconciliation result

The Git factory now exposes an optional, factory-hash-bound reconciliation capability. The coordinator derives every target, committed postimage digest, limit, and exact original byte preimage from the immutable change-set/publication ledger. The factory accepts only an exact set of unstaged tracked modifications, confirms matching execution/publication bytes with the native snapshot helper, and restores each file with native compare-write before ordinary non-force cleanup.

Unknown files, staged/conflicted changes, identity changes, post-read divergence, native contention, and partial reconciliation all fail closed. The existing immutable unknown-cleanup row and lease guards retain the root; committed publication rows prevent publication from being executed again. Legacy v1 factories without the optional method retain their clean-only cleanup behavior.

The driver can reach reconciliation only through its private deferred-finish WeakMap after the engine has observed `handle.inspectCleanup()` and a `snapshot.cleanup === 'verified-clean'` result bound to the attempt. The synthetic driver test proves that contract path only; it does not establish actual provider/process termination or close broad S3.

Checks:

- focused factory test: 5/5 passed, exit 0 (21.81 s)
- focused public driver test: 2/2 passed, exit 0 (19.25 s)
- daemon TypeScript build and asset copy: exit 0

Known evidence gap: a deterministic two-target race that forces the first native compare-write to commit and the second to contend was not added within the bounded pass. The production path retains partial state and records cleanup unknown, but that exact race/reopen sequence still needs an independent hostile gate before a broad completion claim.

Final owned source SHA-256:

- `git-staging-factory.ts`: `da2095b6909934617fd137515c129e0d4fb383ddec0c190897b26a03edd043cb`
- `staging-authority.ts`: `26d1f0d968785e0613bdc1d2e828c2f85dacdefa1d481cfa474140d1f336aa57`
- `integration-git-staging-factory.test.ts`: `03cd459646e52ea09de749206035401b70f7b87a74ae83c89b0982d19310bae1`
- `integration-git-staging-driver.test.ts`: `0db9a3062d884d0cff3b9860b1f7b23b470da6215539403845373fd5e989cc33`
- `app/orchestration-driver.mjs`: `ee129d31d86dd4aed36e9cccfa1fa8d9f2baa0f28338a4a86e43354edea5d4ab`
