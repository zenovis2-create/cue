# Staging authority maker record

## Scope and preimage

`PLAN.md` in this directory is the governing revised design record; it is not an original-source byte backup. Complete original source preimage bytes were not retained for the initial slice, and no reconstruction is claimed. Before the bounded reopen correction, `git hash-object -w app/orchestration-driver.mjs` recorded blob `2581e66edc77f40688edbc34b133dcbfcb1f2e54`. That Git object resolves to 78,357 normalized bytes with SHA-256 `e23c1f2b72da34fa7913a9ae5be2391f19209db73f10d841a1f6db5be83355e0`; those exact object bytes are independently archived as Base64 at `preimages/orchestration-driver-before-reopen-fix.gitblob.base64`. The pre-edit filesystem SHA-256 was `a1e4083799c2043bb823d1545bf4f94b1197ae50e6dab11696b72bc3e9d02c65`, but its original CRLF byte stream was not retained, so the normalized Git object is not represented as a byte-for-byte backup of that filesystem file. The shared worktree was already dirty and contained concurrent changes, so repository state is not claimed as a clean preimage.

The initial design used three attempt tables. Independent review proved that those post-claim records could not show that sibling-root execution was present in the approved preparation. Root authorized the final four-table model: append-only `run_staging_authority` is written for every newly prepared run, enabled or disabled, before approval. Disabled approval cannot later be upgraded. Enabled authority binds run/envelope/plan/policy, exact factory protocol/hash, publication path/native identity, clean HEAD/snapshot, and the immutable `change_root_contract.payload_sha256` target contract.

The first implementation also placed factory creation inside the engine claim transaction. Review proved create/bind failure would roll back the required durable setup/cleanup evidence. The final staged-only engine phase commits claim, lease, request journal, selection, and setup before calling the factory. Legacy preparation retains its former callback order and transaction behavior. Activation then runs outside any caller transaction; successful binding is atomic; launch authorization and intent use a later IMMEDIATE transaction.

## Completion gates

- Attempt cap: three initial implementation passes and two explicitly authorized transaction/capability correction passes. Each failure changed hypothesis.
- Build 7 after the reopen correction: PASS, exit 0. Raw coordinated build log: `../../planning/20260915-progress-reconcile-69/build-pass7.log`.
- Reopen correction gate: PASS, exit 0. Raw log: `../../planning/20260915-progress-reconcile-69/reopen-correction-gates.log`.
- Final staging gate after Build 7: PASS, exit 0. Raw log: `../../planning/20260915-progress-reconcile-69/stage-final7-gates.log`.
- Final compiled Vitest gate: PASS, exit 0, 6 files and 38 tests.
  - `integration-driver-publication.test.ts`: 13/13
  - `integration-staging-authority-migration-definition.test.ts`: 6/6
  - `integration-local-driver.test.ts`: 5/5
  - `integration-local-json-setup-core.test.ts`: 2/2
  - `integration-local-host-settings.test.ts`: 7/7
  - `integration-generated-json-local-host.test.ts`: 5/5
- TypeScript `--noEmit`: PASS.
- Driver syntax and `git diff --check` on the owned slice: PASS.

The positive test uses distinct real temporary directories and native identities. A second ledger connection inside `factory.create` observes one committed setup, attempt, and lease. The session owner cwd is the execution root; change capture and publication use the approved publication root. Committed publication precedes independently inspected cleanup and lease release. Factory throw persists `create_unknown`, retains the lease, launches zero times, and replay creates zero additional roots. Negative tests prove a disabled approved run cannot be upgraded and factory identity drift creates zero roots or claims.

## Final SHA-256 pins

```text
8aa466f848b45858636f654275cac39a3965e917ed4ebb762eca5913a5d0259e daemon/migrations/047_attempt_staging_authority.sql
98d91b0cb05e6d23cb2a8a56e2601d6bb3efda50ca5a8bcb4b2d38ec86c33650 daemon/src/orchestration/staging-authority.ts
0a8605376e0e976ebb07ef921881d6da66295016045647c05693baa3cfe6d288 daemon/src/orchestration/stage-envelope.ts
3eb8d25e69384afd293e4a91aec06982c51105eacf7e7e67dd1d2bc96a693efc daemon/src/orchestration/engine.ts
582ed1bdff398bf12b21daadc0abe9a07020dd7532635ba50cd0cc0b197d0a33 daemon/src/ledger.ts
dbab79d0ad1e0cfeb373fc6b40a89d5436374897e26ed0bcbdbab0230c2ce8a6 app/orchestration-driver.mjs
94cc23f44391e43f3c494d5b90ab8f9f44a41e8d1234fb92eb3e8e9b8035f1f6 app/orchestration-driver.d.mts
d0d025a69310b60386f25b9f3a2ed00ce769eeeb38c7dbb02a3ff81e3e5ce576 daemon/scripts/copy-assets.mjs
dffcb5f7883d67acba166fbaeef658687943562d3b60a4ab410ac0da9684fa71 daemon/test/integration-staging-authority-migration-definition.test.ts
44d70dd15436855b8d0e8bd8c888c9d8eac8ce2a89e82717f1b97bca3b203ec5 daemon/test/integration-driver-publication.test.ts
324ae083e4bdf73c7872c96d7fbbb4f0bbb33b7de1bd18c37a76cf10a7f075f8 evidence/integrations/S3/20260915-staging-authority-plan/PLAN.md
```

## Open qualification

This slice deliberately has no production Git-worktree factory. S3-01/S3-03 production factory qualification and a live Windows direct-write qualification remain open. No provider, billing, model-quality, local-8085, or unknown-Codex qualification was performed or claimed.
