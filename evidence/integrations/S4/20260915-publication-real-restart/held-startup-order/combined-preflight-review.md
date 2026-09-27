# Independent combined preflight review

Verdict: **CLEAR for the one remaining environment-gated actual attempt** at fixture SHA-256 `0e9418451398ddf2445ca95fe034f45752f0d8aafb4f227bc2daa600e99a2ff5` and test SHA-256 `fbfcf5c60768ad8daa03922acb9b44410ba9b459f61cc512355987fcbe433920`. This is source/oracle clearance; I did not run an OS/native test or build.

## Failure-path recheck

The revision 2 ownership repair remains present. Each fixture emits an exact PID/creation identity before opening the ledger or performing an effect and waits for a bounded continuation. The parent obtains an independent OS identity, creates the close promise, registers the child and owned root, and sends continuation only afterward. The persistent frame reader bounds waits and rejects invalid JSON, process errors, premature close, and timeout. Exact-identity termination, child-close waits, aggregated cleanup failures, root retention on unverified cleanup, canonical direct-temp ownership, non-symlink checking, recursive removal, and final absence checking remain intact. Offline controls cover missing/premature frames and registration-before-continuation.

## Publication and Git oracle

Production final-publication `publish` commits the immutable intent before calling execute. Execute calls the real `compareWriteExistingNative`, reads the resulting file, emits the exact intent 1/result 0/native committed/bytes/hash frame, and blocks before returning, leaving publication-result persistence impossible before exact child termination.

The Git setup and oracle are now internally consistent. The owned repository is initialized, `final.txt` is written and staged, and the pre-effect status is explicitly checked as `A  final.txt`. After the native worktree change, default production `captureGitStatus` is expected and asserted as `AM final.txt`. Every Git subprocess used by setup/status has its exit checked. This proves the native bytes differ from the staged baseline without depending on Git user configuration or a commit.

## Held recovery before reconciliation

The fresh child explicitly calls production `holdInterruptedJournalRecoveries(db, worktree, 20)` before production `reconcileInterruptedWrites(db, worktree)`. That order matches the intended durable hold-before-reconciliation boundary for this explicit function sequence.

The raw reopen frame and parent assertions require exactly the original attempt/change-set binding, `held` state, revision 0, reason `interrupted-native-journal`, null final seal, one initial transition, and a stored payload whose SHA-256 is recomputed and whose body binds the same case, attempt, change set, state, revision, and reason. Recovery decisions and activations must both remain zero.

The existing no-resend oracle is preserved: pending publication replay, root and attempt blocked, cleanup unverified, lease held, acceptance/receipt/publication-result/replacement-attempt zero, one original attempt, one blocked-no-auto-resume recovery, authority calls zero, execute calls zero, and unchanged actual replacement bytes/hash. First-child identity death and a distinct fresh PID are also required.

## Proof boundary

A passing actual can prove the narrow existing-file crash window and fresh-process hold/reconcile/no-resend behavior using production publication, native compare/write, held-recovery, reconciliation, Git-status capture, and SQLite code. The lineage is still inserted synthetically through direct SQL/store helpers, and the recovery functions are invoked explicitly by the fixture. The test does not traverse the public orchestration driver, `ownDaemonWorktree`, full production daemon startup/ownership ordering, or broader S4-05. It also does not qualify provider/model behavior, sessions, Electron, local endpoints, billing, power-loss durability, or new-file/rename publication.

Non-blocking limit retained from the prior review: failure to obtain the initial OS identity marks the root retained but does not await the fixture's own bounded handshake exit. It performs no unsafe termination or deletion in that state, though the child could briefly outlive the failed test cleanup.
