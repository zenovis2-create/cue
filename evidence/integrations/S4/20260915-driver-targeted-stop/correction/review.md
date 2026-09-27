# Independent corrected A03 preflight review

Source pin reviewed: `25d5be2f614de88ca234ffffce7b30b1c071728d14aaa52cc9ac63548beee02f`.

Verdict: **BLOCKED before the first actual OS run by one remaining failure-cleanup oracle gap.**

The prior identity blockers are corrected. The runtime now captures the controller and grandchild from `observeProcessTree`, stores the controller's OS `createdAt` in the session handle, and requires exact PID plus creation-time matches immediately before termination. After target Stop, each original identity must be absent or have a different creation time. The sibling must retain both exact PID/creation identities while its heartbeat advances. The same absent-or-changed check follows sibling Stop. Both roots now use resolved direct-temp-parent, exact basename-prefix, non-symlink, and post-removal absence guards.

The remaining gap is in the registered fixture cleanup:

```text
same = execution.observed.every(expected => current contains exact PID+createdAt)
if (same) terminate controller
```

If one captured descendant has already disappeared or changed while the captured controller remains the same original process, `same` is false. Cleanup then skips termination of the still-live exact controller and performs no assertion that either captured identity is absent or changed. It proceeds to close the database and remove the work root. An assertion failure or partial child exit can therefore leave a test-owned process alive while the test cleanup appears successful. This conflicts with the PLAN's requirement to verify every exact identity absent and with the claimed failure-path cleanup.

Required correction: cleanup must handle each execution's partial state explicitly. At minimum, inspect the captured controller identity separately: if the controller still matches, safely terminate its currently attributed tree and await close; if it does not match, do not kill by PID. Then re-observe every captured PID and assert each original PID/creation pair is absent before removing either root. If an exact captured grandchild remains while its controller identity changed/vanished, terminate only through a safe exact-identity mechanism or fail cleanup with retained diagnostics; do not silently remove the root.

All public-driver routing and normal-path assertions are otherwise ready: two separately prepared/approved runs reach two actual adapter launches, Stop is per run, the sibling liveness/heartbeat oracle is exact, and provider/billing/qualification claims remain explicitly out of scope. No OS test, build, provider, model, or product mutation was performed during this review.
