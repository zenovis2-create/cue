# S2-03 / S5-03 phase accounting plan

## Done

- A host-supplied, source-evidenced phase partition is recorded atomically only after the matching final actual budget receipt and clean execution handoff exist.
- The producer derives run/request/attempt, retry/verification role, receipt, and handoff lineage from the ledger; the host cannot substitute those identifiers.
- Base, retry, verification, and handoff components sum exactly to the provider-final receipt without omission or double counting.
- Success and failure handoffs project their terminal status; cancelled and unresolved attempts remain explicit unknown/cancelled dispositions and retain conservative reservations.
- Existing atomic reservation rules continue preventing concurrent overrun. Missing, estimated, unknown, non-final, or unknown-cleanup billing creates no attribution and releases no reservation.
- No provider value is invented. With no trustworthy attribution input, projection stays unavailable.

## Gates

- Focused source test from `daemon/`: `npx --no-install vitest run test/integration-phase-accounting.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Existing accounting/engine regression from `daemon/`: `npx --no-install vitest run test/integration-budget.test.ts test/integration-evaluation-authoritative-accounting.test.ts test/integration-handoff-accounting.test.ts test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.
- Typecheck from `daemon/`: `npx --no-install tsc -p tsconfig.json --noEmit --pretty false`.
- Root owns shared builds and authoritative documentation.

## Loop contract

- Attempt cap: 2 per hypothesis.
- Every pass runs the focused gate and no-emit typecheck; broaden only after they pass.
- A failed pass requires a new hypothesis or handoff.
- Keep changes only when gates improve or pass.

## Exact preimages

- `daemon/src/evaluation/handoff-accounting.ts`: `f4aefdfd192ef28f110f793ebd66d83a5715f2e51c65c393e484f71935cc8072`
- `daemon/src/orchestration/engine.ts`: `3eb8d25e69384afd293e4a91aec06982c51105eacf7e7e67dd1d2bc96a693efc`
- `daemon/test/integration-engine.test.ts`: `0136b4ad4703c56ddd841c7bedc288338339378e5f8e88d7351bd8a8fe305466`
- The integration-engine copy is byte-exact. The two source text copies were captured through a text-normalizing path and hash to `0a5b4356ce19b025b8a75d19104ce7ce0a54a65dcc8b377283d9bffd2c2baea9` and `52bd2016cf0235adf37cb2445161e7b314bb4dffd20decbfcf77aac44cb21824`; the hashes above are the original-byte preimage records, while those two copies are inspectable content evidence rather than byte-exact reconstructions.

## Limits

- No migration, ledger bootstrap, app driver, Core/UI, provider/model/network/authentication changes.
- No live calls; Qwen remains off and the 4/4 live budget remains exhausted.
- The implementation proves offline accounting invariants, not real invoice correctness or provider qualification.
