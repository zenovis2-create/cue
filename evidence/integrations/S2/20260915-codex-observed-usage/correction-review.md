# Independent correction review

Verdict: **CLEAR for the frozen Codex usage correction.** The original cumulative
snapshot persistence blocker in `independent-review.md` is closed.

The adapter now keeps a cumulative high-water mark per executor invocation and
persists only each advance. Valid cumulative snapshots `5 -> 8` therefore produce
durable quantities `5, 3`; the real SQLite assertion proves their sum is exactly
the attempt total, 8. A fresh retry invocation starts with an independent
high-water mark, so its first cumulative value is not reduced by the prior
attempt. Cancellation fences later usage, and the controller continues to fence
foreign, duplicate, reordered/decreasing, malformed, equal-total changed-breakdown,
and post-terminal notifications.

Typed raw activity retains the upstream cumulative event and scope. Durable
activity uses delta quantities, so generic per-attempt and cross-attempt sums no
longer double-count cumulative snapshots. Existing measured projections treat
usage as evidence/presence; monetary projections and budgets still consume only
separate authorized receipts with explicit `providerFinal`. No token-to-money,
price, billing finality, terminal success, verification, or cleanup inference was
introduced.

The focused correction gate passed: 18 tests in three files. The immutable source
pin is the peeled upstream commit
`41e22fee981a63b3698df7ed36bad393cda24715`; the evidence correctly avoids treating
the tag or `main` as immutable. Historical preimage bytes were not retained, and
the source evidence does not claim otherwise.

The independent project-wide `tsc --noEmit` check is currently blocked by three
TS2322 errors in the concurrently edited, out-of-scope
`integration-public-driver-startup-restart.test.ts`. None references the frozen
controller, executor, or usage test. This is workspace drift rather than a finding
against the reviewed correction, but the repository-wide type-check is not clean
at this review instant.

Exact commands, failures, and frozen hashes are recorded in
`correction-review.log`. No build, live provider, localhost:8085, OS, or native
tests were run.
