# Exploration consent independent review plan

## Scope and separation

Independent review only. The reviewer did not implement the product change and will not edit product source or tests. Review is limited to the maker-owned driver/UI/Core/IPC source and focused tests identified by the final freeze. Evidence writes are limited to this directory.

No model calls, live provider calls, secrets, local-model probe/restart/download, Electron actual gate, or unknown Codex SHA work.

## Done

Done means the frozen source and tests prove all of the following:

1. Host grant alone is inert.
2. An explicit UI checkbox emits `allowExploration: true` through strict IPC into the Core approval transaction and then `driver.approveExploration`.
3. The consent row binds the exact run, plan, grant, and task membership and is atomic with ordinary approval.
4. Local candidates and initial-default conflicts reject before effects.
5. Both serial and parallel paths require the approved task flag.
6. Replay/retry preserves the original consent identity and membership.
7. Missing consent causes zero launch and zero reservation.

The measurable gate is the maker’s frozen focused command plus current build, both exit 0, followed by source inspection tying each assertion to the production call chain. `review.md` records PASS or FAIL with source hashes, commands, counts, limitations, and retained failed attempts.

## Attempt cap and every-pass checks

Maximum two factual evidence corrections; no product correction by this reviewer. Every pass checks frozen source hashes, exact command/exit, all seven contract points, local-model/live-call absence, and `git diff --check` for owned evidence.

If a gate fails, preserve the output and report the smallest reproducible defect to the maker/root. Re-review only after a changed source hypothesis and a new freeze. A prior experiment cap does not prohibit a materially changed implementation, but the same failed command or hypothesis is not repeated.
