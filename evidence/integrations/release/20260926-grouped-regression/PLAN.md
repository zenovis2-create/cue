# Frozen grouped regression

- Build once, then freeze source and compiled daemon artifacts by SHA-256. Enumerate all `daemon/test/**/*.test.ts` files using the current Vitest include pattern.
- Allocate the entire list into 12 serial groups, balancing estimated durations from the prior incomplete run. Estimates affect scheduling only, not assertions or timeouts.
- Each group uses unchanged default per-test budgets, one worker, file isolation, no retries, no test-name filters, and `--allowOnly=false` to prevent accidental focused tests. Live provider, Orca and real-restart opt-ins are cleared.
- Ten-minute outer budget per group. No group is silently overwritten/retried. Exclusive runner lock prevents concurrent group launches. A timeout or source drift must be reviewed before any further group.
- Capture invocation, full verbose log, JSON report, process exit and frozen-byte checks before/after. Reconcile actual report file paths against each group and all groups against the original inventory; missing, duplicate or unexpected files prevent a complete verdict.
- A failed group remains failed. Source fixes require a separately documented validation generation; historical passes are not silently relabeled.
- Grouped coverage is not a successful unfiltered root invocation, live-provider qualification, user acceptance or measured performance.
