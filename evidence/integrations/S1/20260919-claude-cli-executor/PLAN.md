# Inactive Claude CLI executor unit

Pre-edit: `daemon/src/adapters/claude-cli-executor.ts` and `daemon/test/integration-claude-cli-executor.test.ts` absent. Existing decoder is not edited. Other working-tree edits are owned by others and remain untouched.

Done gate: fixed argv and explicit environment; issued installation and attempt/account/model/worktree binding before spawn; owned `spawnOwned` session; init/terminal/EOF/exit/async callback success conjunction; idempotent cancel; timeout/error branches. Focused `npx vitest run test/integration-claude-cli-executor.test.ts --fileParallelism=false --maxWorkers=1` passes. Two functional correction hypotheses maximum, read evidence between passes. Root owns `npm run build` and independent review; no provider/model/auth/service calls.

No executable registration or readiness. For offline tests only, inject sealed spawn/check functions; production defaults remain provider descriptor freshness and `spawnOwned`. Cancellation acknowledges a stop request, not death, cleanup, or billing finality.
