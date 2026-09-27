# Maker record — A04 direct publication crash/reopen boundary

Two new test-only files implement the discovered boundary. No existing source or product file changed.

This is a direct `createFinalPublicationStore` fixture with synthetic lineage seeded in SQLite. It does not exercise the public orchestration driver. The fresh process does run production startup reconciliation, so the bounded claim is direct-publisher crash-window persistence plus real `reconcileInterruptedWrites` behavior.

Revision 1 persisted an immutable intent, performed the real existing-file native write, blocked before result persistence, and reopened the database in a distinct process. Independent preflight blocked it because child ownership began only after the effect frame, frame reads were unbounded, cleanup registration could race process close, and reopened git status was injected.

Revision 2 adds a bounded pre-effect identity handshake. The parent verifies PID plus creation time and registers the child and its pre-created close promise before sending the continuation that permits database access or effects. A persistent bounded frame reader rejects timeout, malformed data, child error, and premature close. If identity cannot be verified, the owned root is explicitly retained rather than deleted while a child may remain. Cleanup aggregates failures and database checks close in `finally` blocks.

The actual fixture now initializes a uniquely owned Git worktree, writes and stages the baseline with `git init` and `git add`, then uses default production git-status capture after the native write. The reopen assertion requires the stored artifact to report the real modified target. Controlled offline tests prove missing-frame and premature-close rejection and that registration precedes continuation, with failed registration preventing effects.

Revision 2 passed fixture syntax, repository TypeScript no-emit, and the environment-skipped Vitest file: two offline control tests passed and one actual test skipped. Raw stdout/stderr and exits are preserved under `logs/pass2-*`.

Candidate hashes:

- fixture: `132B672A19AE9A69DDE0CCD59BBBC3B3634B386D20DDD0D3C0C0455CFD853C04`
- test: `0859145A8C3D79140AE2C95F3A1162528517F6787CAD9B54E4D565C73F0CA9E1`

Offline budget used 2/2; actual used 0/1. Independent revision-2 preflight and root coordination remain required. The reopen child calls `reconcileInterruptedWrites` directly; it does not exercise the production startup ordering that first calls `holdInterruptedJournalRecoveries`, and it does not assert a held recovery row. Therefore this evidence cannot close S4-05. It also does not establish public-driver coverage, provider behavior, session reconnection, power-loss durability, new-file/rename publication, Electron, local8085, or global S3 completion.
