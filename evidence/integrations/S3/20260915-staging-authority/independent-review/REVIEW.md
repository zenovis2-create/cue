# Independent staging-authority review

Status: **CLEAR**

Scope is read-only review of migration 047, the staging coordinator, stage-envelope integration, and later driver wiring. A trusted injected factory is sufficient for this slice; this review makes no production Git-worktree or Windows qualification claim.

## Early findings sent to maker

1. **Critical — authority does not bind the execution root to the stage row.** The authority insert guard joins `orchestration_stage_envelope`, but it does not require the new execution path to equal the stage envelope JSON, the `envelope` row selected by `stage_envelope_hash`, or the child run envelope. An arbitrary sibling root can therefore be attached to an unrelated stage hash by direct SQL.
2. **High — cleanup evidence is not bound to the exact setup/root identity.** Cleanup payloads carry attempt and factory identity only. They omit `setupId` and the publication or execution path/native identity, so evidence about a different root can satisfy the guard.
3. **High — payload guards are not canonical or closed-schema guards.** Hashing the caller-supplied blob and checking selected fields still accepts extra keys, duplicate-key ambiguity, loose field types, and alternate JSON encodings. This does not meet the explicit SQL tamper/canonical guard requirement.
4. **High — lease release is not bound in SQL to committed publication.** A directly inserted `active_cleanup_verified` row is enough to make migration 047's lease guard permit deletion even when publication is missing, contended, or unknown. Successful publication plus verified active cleanup must jointly authorize release.
5. **High — replay uses whichever factory is currently injected.** Existing setup lookup omits persisted factory protocol/hash, so reopen and active cleanup can inspect or delete a root created by a different factory identity.

## Required final checks

- Explicit approved publication root remains the original root and retains its lease and target preimages.
- Setup is durable before the sole factory create call; a crash or unresolved create never recreates.
- Unknown cleanup retains the lease; active verified cleanup cannot release before exact committed publication.
- Stage filesystem containment is waived only for the exact persisted setup/root while actions, egress, role, autonomy, expiry, candidate, plan, policy, revision, approval, and exact account subject remain equal or narrower.
- Capture, publication contract, and publication operate on the publication root; owner/host operate on the execution root.
- SQL rejects altered, extra, mistyped, ambiguously encoded, or lineage-mismatched payloads.
- Replay makes zero new create, launch, capture, publication, or cleanup calls as appropriate.

Final evidence will include source hashes and exit status for the focused staging suites, retained regressions, and build.

## Final independent gate, 2026-09-15

The implementation now satisfies the earlier SQL, lifecycle, root split, cleanup, replay, single-writer, factory identity, canonical payload, and packaging findings. In particular, the positive Windows test opens a second ledger connection inside `factory.create` and observes the committed setup, attempt, and lease before the filesystem effect. It then proves host cwd is the distinct execution root, the change set and final publication use the original publication root, cleanup is verified, and the lease releases only afterward. Factory failure durably records `create_unknown`, retains the lease, and replays with zero create or launch calls.

The prior stop condition is resolved. Every newly prepared run now receives an append-only `run_staging_authority` row before approval, including an explicit disabled row for ordinary runs. Enabled authority binds the envelope, plan, policy, exact factory protocol/hash, publication path/native identity, clean commit/snapshot, and the exact immutable change-root contract digest. Setup must join that authority exactly. A disabled approved run cannot be upgraded later, factory drift refuses before claim/create, and an already approved or attempted legacy run cannot be retrofitted because the insert guard rejects late authority creation. The disabled record also follows the existing local-policy lineage while local execution staging remains prohibited.

### Commands

- `npx vitest run test/integration-staging-authority-migration-definition.test.ts test/integration-stage-envelope.test.ts test/integration-driver-publication.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — exit 0, 28/28.
- `npm run build` — exit 0.
- Post-build: `npx vitest run test/integration-staging-authority-migration-definition.test.ts test/integration-driver-publication.test.ts test/integration-publication-migration-definition.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — exit 0, 20/20.
- Final independent Build 6 read-only gate: `npx vitest run test/integration-staging-authority-migration-definition.test.ts test/integration-driver-publication.test.ts test/integration-stage-envelope.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — exit 0, 35/35.
- Source and packaged migration 047 SHA-256 match: `8aa466f848b45858636f654275cac39a3965e917ed4ebb762eca5913a5d0259e`.

### Reviewed source hashes

- migration 047: `8aa466f848b45858636f654275cac39a3965e917ed4ebb762eca5913a5d0259e`
- staging coordinator: `98d91b0cb05e6d23cb2a8a56e2601d6bb3efda50ca5a8bcb4b2d38ec86c33650`
- stage envelope: `0a8605376e0e976ebb07ef921881d6da66295016045647c05693baa3cfe6d288`
- engine: `3eb8d25e69384afd293e4a91aec06982c51105eacf7e7e67dd1d2bc96a693efc`
- ledger: `582ed1bdff398bf12b21daadc0abe9a07020dd7532635ba50cd0cc0b197d0a33`
- driver: `a1e4083799c2043bb823d1545bf4f94b1197ae50e6dab11696b72bc3e9d02c65`
- positive/negative driver test: `44d70dd15436855b8d0e8bd8c888c9d8eac8ce2a89e82717f1b97bca3b203ec5`
