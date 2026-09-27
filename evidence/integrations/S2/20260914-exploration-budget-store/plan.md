# Exploration budget store verification plan

- Done: the three owned files implement immutable preapproval, transaction-bound linked reservation, authoritative receipt-derived summary, SQL tamper guards, and the focused plus budget/policy regression gate exits 0.
- Attempt cap: 2 implementation/gate passes.
- Every pass: `npm run build`; `npx vitest run test/integration-exploration-budget.test.ts test/integration-budget.test.ts test/integration-policy-store.test.ts`.
- Failure: keep the full failed output, form a new hypothesis, and retry once; after a second failure hand the evidence to the human/root owner.
- Maker/checker separation: the maker records raw gates; `/root/remaining_batch_review` performs the independent review before final source freeze.

