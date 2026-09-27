# S4 Unit 2 correction review

Verdict: **PASS for the narrowed, disconnected groundwork only**. The original broad Unit 2 and production-wiring blockers remain open.

This follow-up reviewed the frozen correction bytes without product edits. It verifies bounded change capture/observation, append-only held reconciliation, schema guards, and a read-only integration-verification inspection surface that can produce only `unknown`. It does not approve production execution, restoration, crash recovery wiring, or final acceptance.

## Corrected findings

- `observeChangeSet` now selects the immutable entry payload before parsing it. The normal capture/observe case passes and the injected same-hash case still distinguishes different exact bytes.
- Direct fixtures register exactly their intended immutable target set. The three change-record tests now execute their target assertions instead of failing at preapproval.
- Held reconciliation selects the newest observation per ordinal. An independent actual-path regression records a known snapshot, then an `unknown` snapshot after the target parent moves, commits a valid failed terminal handoff, opens a held case, and confirms reconciliation returns `{state:'held', revision:0}`.
- Change-set targets/limits/time, entry restoration reason, and observation parent/realpath/identity/length/hash/time are bound to the hashed payload. The independent direct-SQL scalar-drift insertion is rejected with `change observation payload mismatch`.
- `inspectIntegrationVerification` is read-only, accepts no verdict/checker/currentness callback, always returns `unknown`, and reports the unwired registered observer, revision-wide lineage, and cumulative-scope blockers.
- Migration 037 unconditionally rejects every `integration_verification_result` whose verdict is `pass` with `integration pass authority not wired`. Therefore the earlier false-pass path is unavailable in this narrowed unit.

## Filesystem boundary limitation

The current path validation is check-time validation. `snapshot` checks ancestors with `lstat`/`realpath` and later opens the target by path. It does not hold directory handles or provide an atomic beneath-root open, so it does not close an ancestor-swap/junction race between validation and `openSync`. No production source or app module imports `captureChangeSet`, `observeChangeSet`, `restoreStoppedChangeSet`, `reconcileHeldRecovery`, or `inspectIntegrationVerification`; `rg` found only their definitions. Restoration without an injected atomic host returns unsupported and is not an OS restore implementation. This limitation is acceptable only because this result is disconnected groundwork; production wiring remains blocked until a host primitive closes the race and is independently exercised.

## Independent evidence

- Complete bounded suite: **86/86 PASS**, 9 files, exit 0.
- Review regressions: **3/3 PASS**, including actual reopen integrity/FKs, immutable observation scalar binding, and latest-unknown held reconciliation.
- Fresh `npm run build`: exit 0; includes TypeScript compilation and migration asset copy.
- `git diff --check` on the reviewed and evidence files: exit 0.
- Reopened temporary SQLite ledger: `integrity_check=ok`; `foreign_key_check=[]`.
- Migration 037 SHA-256: `40DB0AF5DB2AAD8BCE52A4DFED1219A2A1EC68BA4A11D8E447237044D10C927A`.

Reviewed source hashes:

- `change-records.ts`: `DC9741C87A11DDF60D5CC500B705BBF7BF7795D4F360E1228EF64D65D6E9F6CA`
- `held-recovery.ts`: `A62457BEF8D6B9AE5A9D30EBF78EFB79D2FA12BF8B001F2BFDA795FC9954B0E3`
- `integration-verification.ts`: `BE10867F72ACFC443C8C671116577DD7F4E1AF0EA115CA3F6BFA6D16E572BF7D`

## Still open before production wiring

- Atomic beneath-worktree path resolution and race-proof final observation.
- An actual atomic restore host, partial-failure semantics, and OS hostile coverage.
- Startup/crash/native cleanup and external-observer orchestration wiring.
- Registered current-manifest observer facts, every producer/verifier attempt lineage, original approval/requirements/budget scope, cumulative limits, and atomic immutable pass storage.
- Replacement of the unconditional SQL pass denial only after the complete authoritative gate exists.
- Current-build stop, parent-death, seal, and other broad Unit 2 lifecycle evidence required by the original design.

