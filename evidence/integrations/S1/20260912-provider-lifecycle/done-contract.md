# Provider lifecycle append-only store done contract

## Done

- Cancel request, client acknowledgement, provider terminal, local controller/tree observation, cleanup, and billing finality are distinct append-only facts. Missing facts remain `unknown`.
- Provider thread, turn, and subtask references are stored only as bounded opaque digests bound to the exact run, task, attempt, and candidate. A subtask digest cannot be claimed by another attempt, even with another label or kind.
- The store has authority `0` for process kill, budget release, and acceptance. Billing can become final only from an explicit provider receipt fact.
- Exact replay is the only accepted replay. Duplicate IDs with different bytes, ordinal conflicts or gaps, terminal conflicts, late writes after sealing, cross-attempt ownership theft, hostile JavaScript objects, oversized input, payload hash drift, and lineage mismatch are rejected without writes.
- Fresh and pre-032 file-backed ledgers migrate, close, reopen, preserve foreign keys, and keep source/dist migration bytes identical.

## Attempt cap

At most 2 corrective implementation hypotheses.

## Every pass

1. `npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/p5.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
2. Relevant orchestration schema regression tests.
3. `npx --no-install tsc -p tsconfig.json --noEmit`
4. `npm run build`
5. Fresh and pre-032 file-backed SQLite close/reopen, `PRAGMA integrity_check`, and `PRAGMA foreign_key_check` evidence.
6. Source/dist migration SHA-256 parity and owned-file diff/whitespace review.

## Failure rule

Keep a change only when the measured gate improves. On failure, use a new hypothesis; after two failed hypotheses, stop and hand the raw failure evidence to the human. No provider, model, CLI, native, Electron, or network execution is permitted.
