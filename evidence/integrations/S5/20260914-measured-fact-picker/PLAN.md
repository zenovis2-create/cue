# S5 measured-fact picker maker plan

Done means:

- `npm run build` exits 0 from `daemon`.
- The exact focused/regression Vitest command exits 0 from `daemon`.
- Actual SQLite/Core→IPC tests prove bounded pagination, reopen/no-write, foreign/tamper skipping, 65-invalid empty continuation, input bounds, host-disabled/closed/outer-transaction denial, and protected receiver behavior.
- DOM tests prove manual refresh/next/select→revalidated read, typed-ID preservation on list failure, and stale/new-run/approval/error clearing and locking.
- All eight owned final paths are SHA-256 pinned.

Attempt cap: two substantive maker passes.

Every pass runs:

1. `npm run build` from `daemon`.
2. `npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.

Failure handling: diagnose and retry once with a new hypothesis. If the second pass fails, stop editing and hand off the preserved evidence.
