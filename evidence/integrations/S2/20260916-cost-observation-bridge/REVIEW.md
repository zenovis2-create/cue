# Independent review — production cost-observation bridge

## Verdict

**CLEAR after two corrections.** The final reader binds the requested run/request, denormalized receipt scalars, budget currency/unit, attempt candidate, and immutable account identity. It validates the exact parsed receipt shape and primitive types before comparison, so payload coercion cannot change the projected billing classification.

No provider, model, network, authentication, or local endpoint call was made. I did not rerun the maker's passing 19-test/typecheck gate because the defect follows directly from the source and migration contract.

## Resolved finding

### High — canonical payload could be projected under unrelated row lineage

The initial `costObservation` selected only `r.payload`, `a.attempt_id`, and `a.candidate_id`. It parsed the payload and checked only that re-canonicalizing the parsed object reproduced the stored payload text. It did **not** select or compare the receipt table's `run_id`, `receipt_id`, `request_id`, `revision`, `kind`, `units`, or `provider_final` columns.

Migration 008 constrains basic column types and uniqueness, but it has no insert guard binding those columns to `payload`. It also has no receipt-table immutable update/delete/replace triggers. A canonical JSON payload can therefore disagree with the row that supplies the request-to-attempt join. The bridge will combine payload cost/source facts from one receipt with the candidate and account identity of another attempt and create a valid-looking source digest over that mixed lineage.

This violates the claimed “exact attempt/account/source lineage.” Canonical formatting proves only formatting; it does not prove relational identity.

Required correction was completed:

1. Select all denormalized receipt fields used by `BudgetReceipt` along with the joined attempt/candidate.
2. Require parsed `runId` and `requestId` to equal both the requested arguments and selected columns.
3. Require `receiptId`, `revision`, `kind`, `units`, and `providerFinal` to equal their selected columns, and revalidate currency/unit/source/observed time through the canonical payload already created by `observe`.
4. Refuse before account projection or snapshot construction on any mismatch.
5. Add a direct-SQL counterexample with a well-formed canonical payload swapped onto a different request/attempt, plus at least one kind/units/finality mismatch. Expected result: deterministic integrity refusal, not a mixed observation.

Refs: `daemon/src/budget.ts:132`, `daemon/migrations/008_integration_budget.sql:27`, `daemon/test/integration-cost-capacity-observation.test.ts:151`.

## Additional scope notes

- `costDimension:'api'` is hardcoded. The monetary budget schema records currency/unit but no explicit provider billing class. The implementation must either cite an existing contract that monetary integration-budget receipts are exclusively API costs, add an explicit trusted dimension binding, or narrow the result/claim so subscription-derived monetary observations cannot be mislabeled as verified API cost. It must not infer the class from account/tool naming.
- The repository currently calls `costObservation` only from the new focused test. This is a production-code projection primitive, not yet an actual selection/UI consumer. The result can support S2-02 implementation progress but does not by itself close the original producer/display condition.
- Existing receipt `source` strings remain accepted by `observe`; the stricter `sourceRef` grammar applies only when this new projection is requested. That avoids a write regression, but an older valid receipt with a source outside `SAFE_REF` will make the new read fail closed. This behavior should stay explicit and should not be described as universal compatibility with all historical source strings.
- The snapshot correctly marks stale and unknown states with denial reasons and fixes all authority flags to false. `providerFinal` maps to descriptive billing state only and confers no authority.

## Reviewed evidence

- Exact preimage diff for `daemon/src/budget.ts`: one new method and its imports.
- Exact preimage diff for `daemon/test/integration-cost-capacity-observation.test.ts`: one positive/latest/unknown/stale test.
- `daemon/src/selection/cost-capacity-observation.ts` validation and authority semantics.
- `daemon/src/orchestration/account-binding.ts` immutable candidate/account binding.
- Migration 008 receipt schema and absence of payload-column integrity/immutability guards.
- Maker results: focused cost observation 10/10, budget regression 9/9, TypeScript exit 0.

The corrected hostile cases now exercise canonical payloads that conflict with row lineage and classification.

## Correction review

The final source selects `run_id`, `receipt_id`, `request_id`, `revision`, `kind`, `units`, `provider_final`, budget `currency`/`unit`, attempt, candidate, and payload in one joined read. It then requires payload equality with the requested and persisted run/request, receipt identity and revision, classification, units, finality, and budget denomination before reading the account identity or calling the snapshot boundary.

The corrected focused test mutates a canonical payload to a foreign run, foreign request, and denomination, and independently corrupts persisted kind and finality. Each case now fails with `budget_receipt_integrity`. Maker gates after correction report cost observation 10/10, budget regression 9/9, and TypeScript no-emit exit 0.

The `api` dimension is acceptably narrow for this bridge: this store requires a currency and `minor`/`micro` units, which is the API monetary shape of the existing observation contract. Subscription and local-resource dimensions require their distinct non-currency units and are explicitly not inferred. This classification does not prove invoice truth or provider qualification.

The lineage correction is complete. This remains a production persistence read surface without a runtime/selection caller, so it is implementation progress rather than end-to-end S2-02 closure.

## Resolved coercion finding after first correction

`Number(receipt.providerFinal) === row.provider_final` accepts a canonical payload containing the string `"0"` when the row column is integer `0`. The subsequent `receipt.providerFinal ? 'final' : 'open'` treats that non-empty string as truthy and emits `billing:'final'`. More generally, parsing JSON with a TypeScript assertion does not validate the exact `BudgetReceipt` runtime shape.

The final reader validates exact own data keys, existing text/currency/unit rules, safe-integer revision/timestamps/units, kind/null/finality semantics, and a strictly boolean `providerFinal` before comparing the row. Canonical `providerFinal:"0"`, missing-field, and extra-field counterexamples now fail with `budget_receipt_integrity` before snapshot construction. Maker gates after this correction report focused 10/10, budget regression 9/9, and TypeScript no-emit exit 0.
