# Unit 2 external observation authentication plan

Done means decisive held-recovery observations are admitted only after a deployment-owned verifier authenticates immutable evidence bytes against the exact persisted intent and observer identity/revision. The canonical persisted observation must contain that complete binding. Missing, malformed, stale, conflicting, timed-out, or unauthenticated evidence leaves the case held and cannot increment its revision. Existing unknown/CAS/no-auto-resume, handoff, cleanup, and local change-set guards remain unchanged.

Attempt cap: 2 implementation passes.

Every pass, from `daemon/`:

```text
npx --no-install vitest run test/integration-held-recovery.test.ts test/integration-native-recovery-host.test.ts test/integration-recovery-handoff.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc --noEmit
```

If a pass fails, retry only with a changed hypothesis. After two passes, hand the exact failure and evidence to the parent/human.

The deployment verifier, rather than a digest alone, supplies authenticity. Held recovery copies and validates persisted intent and callback values before invoking the next callback, hashes the returned authorized evidence bytes once, and persists a canonical v2 binding. Legacy v1 observations remain non-authoritative.
