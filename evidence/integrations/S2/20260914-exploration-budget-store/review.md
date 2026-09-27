# Independent review — exploration budget store

## Completion criteria declared before findings

- One immutable, preapproved candidate/run policy binds a strict exploration subcap without replacing or discounting the ordinary run budget.
- An exploration reservation is valid only alongside the exact existing ordinary reservation; all cost remains counted once by ordinary authoritative accounting.
- Settlement derives only from the latest authoritative ordinary receipt revision. Actual overrun becomes durable exploration debt and denies the next exploration attempt.
- Migration 041 enforces preapproval, first-attempt eligibility, exact run/request/attempt/candidate/currency/unit lineage, immutable hashes, replay equality, and reset/foreign-lineage rejection.
- Store input rejects proxies, accessors, extra/missing fields, unsafe numbers/IDs, changed replay bytes, and transaction rollback residue.
- Tests apply migration 041 explicitly to a current migration-039 ledger and cover reopen, concurrent claims, and rollback.
- Maker has at most two revisions. Each pass runs `npm run build` and the exploration-budget, budget, and selection-policy focused suites. Final independent verification repeats that gate once against frozen pins.

Scope: isolated store, migration, and tests only. Ledger registration and engine wiring remain root-owned follow-ups. No live provider/model, native helper, Electron, network, or whole-product qualification.

## Interim finding

NOT QUALIFIED. The first frozen candidate built and passed an independent 28/28 gate, but the green result exposed an ineffective raw hash oracle and source audit found that authorization does not bind `integration_budget.policy_revision` to the approved selection-policy revision. The post-cap maker test correction is unexecuted; root owns the substantive bounded correction. See `independent-audit.md`. Final verdict waits for corrected frozen pins and an explicitly released re-gate.

## Final verdict

PASS after the separately documented root correction. Both SQL insert admission and reopened store reads now require the ordinary budget policy revision to equal the exact selection policy `policyId:revision`; a dedicated foreign-revision test rejects without a grant. The valid-payload/wrong-hash oracle reaches the intended trigger and has a correct-hash positive control. Final independent build exited 0 and the focused exploration/budget/policy gate passed 29/29 across 3 files. See `independent-final.md` and the `independent-regate-*` raw logs.

The prior maker 27/28 failure and first independent 28/28 NOT QUALIFIED result remain historical evidence and are not relabeled as passing. Root still owns migration registration and engine integration.
