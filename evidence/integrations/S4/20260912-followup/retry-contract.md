# S4 retry follow-up contract

Date: 2026-09-12

Done means all of the following are true:

- `npm run build` exits 0 from `daemon`.
- `npx --no-install vitest run test/integration-retry-backend.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` exits 0 and proves legacy 016 compatibility, exactly one concurrent retry reservation, a consumed loser with no writes, and fail-closed unresolved evidence.
- `npx --no-install tsc -p tsconfig.json --noEmit` exits 0.
- `git diff --check -- daemon/src/orchestration/store.ts daemon/test/integration-retry-backend.test.ts evidence/integrations/S4/20260912-followup/retry-contract.md evidence/integrations/S4/20260912-followup/retry-RESULTS.md` exits 0.
- `retry-RESULTS.md` records commands, results, and SHA-256 hashes for the owned source/test files.

Maximum: four distinct diagnosed correction passes.

Every pass runs the focused retry test; when the worker helper imports compiled code, run `npm run build` first. A failed pass must produce a new hypothesis grounded in observed evidence. Stop and hand off after four failed distinct corrections. Keep a change only when the measured gate improves; revert a regression. The root agent independently reviews the final result.

Pass hypotheses must distinguish an invalid legacy/current fixture from product SQL transaction contention. SQLite busy/locked errors are failures and are never interpreted as successful duplicate consumption. Legacy 016 behavior remains supported without granting current 033 artifact trust.

## Acceptance-history fixture follow-up

Done means `npm run build`, no-emit TypeScript, and a focused Vitest run of `integration-acceptance-history.test.ts`, `integration-acceptance.test.ts`, and `integration-retry-backend.test.ts` all exit 0. The fixture must provide mandatory evidence policies and legitimate schema-033 terminal evidence while preserving historical encoding, retry-chain, and corruption expectations. Product source remains frozen.
