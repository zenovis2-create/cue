# Independent revision 2 preflight review

Verdict: **BLOCKED before the actual OS attempt.** Revision 2 fixes the original child-ownership and bounded-frame defects, and it switches to production Git-status capture, but the prepared repository cannot produce the asserted status string.

Reviewed frozen pins:

- fixture SHA-256 `132b672a19ae9a69dde0ccd59bbbc3b3634b386d20ddd0d3c0c0455cfd853c04`
- test SHA-256 `0859145a8c3d79140ae2c95f3a1162528517f6787cad9b54e4d565c73f0ca9e1`

No OS/native test or build was run in this review.

## Corrected findings

The fixture now emits its exact PID/creation identity before opening the ledger or performing effects and waits for a bounded `continue` handshake. The parent independently observes that identity, creates the close promise, registers the child and owned root, and only then sends continuation. Subsequent JSON reads are persistent and bounded and reject invalid JSON, premature close, process error, or timeout. Failure cleanup aggregates errors, revalidates exact identities before termination, and retains a root when cleanup cannot be verified. The two offline control tests exercise frame timeout/premature close and registration-before-continuation ordering.

The reopen child now calls `reconcileInterruptedWrites(db, worktree)` with its default production status reader. The parent creates an owned temporary Git repository and the result frame includes the stored `git_status` artifact. This removes the earlier fabricated-reader limitation.

The durable-intent / native-effect / absent-result ordering remains sound: production `publish` persists the intent before execute; execute invokes the real existing-file native helper, emits intent 1/result 0 plus actual bytes/hash, then blocks before returning. Exact first-child termination and death, fresh reopen, pending replay, root/attempt blocked state, lease retained, acceptance/receipt/result/replacement-attempt zero, authority/execute callback zero, recovery count one, and byte preservation remain asserted.

## Blocking Git-status oracle

The test initializes a new repository, writes `final.txt`, and runs `git add final.txt`, but it never creates a baseline commit. After the native helper changes the worktree copy, `git status --short` represents the file as added in the index and modified in the worktree: `AM final.txt`. The test requires `reopened.gitStatusArtifacts[0].content.trimEnd()` to equal ` M final.txt`, which denotes an unchanged index entry relative to `HEAD` plus a worktree modification. There is no `HEAD` entry in the current setup.

Before the actual attempt, establish a committed baseline for `final.txt` inside the owned repository (with explicit local identity configuration) and verify each Git subprocess exit, or change the oracle to the exact status intentionally created by the uncommitted setup. A committed baseline is preferable because it models mutation of an existing tracked file and makes the expected ` M final.txt` unambiguous.

## Narrow proof boundary

Even after that correction, this is a direct production final-publication-store/native-helper/reconciliation test over synthetically seeded SQL lineage. It does not invoke the public orchestration driver, prove production startup ordering, exercise `holdInterruptedJournalRecoveries`, or close S4-05 broadly. It also does not qualify providers, sessions, power-loss durability, new-file/rename publication, Electron, billing, or global S3/S4 completion.

Non-blocking failure-path limit: if the parent cannot obtain an OS identity after spawn, it marks the root retained but does not await the fixture's own 10-second handshake timeout. No unsafe PID action occurs, but a short-lived child may outlast the failed test process cleanup. The actual path is expected to obtain the identity; a stronger harness could await bounded close in this branch while retaining the root.
