# Independent review: revised cold-start plan

## Verdict: REVISE — one authority blocker remains

The conservative-only scope is otherwise executable. It correctly separates unmeasured performance from bounded execution cost, preserves ordinary ranking precedence, falls back only when the named candidate's sole exclusion is `unknown-estimate`, records no synthetic score, retains host eligibility and execution authorization, and keeps the normal budget reservation in the existing immediate claim transaction. Exploration is appropriately deferred.

The remaining blocker is the source of trust for `maximumReservationUnits`. The proposed store persists `source`, `sourceDigest`, and canonical bytes, but the plan does not name an authority that verifies those values before binding. Immutability proves that a claim did not change; it does not prove that the original caller was allowed to set a monetary upper bound. An exported bind API accepting canonical caller data could therefore turn an invented maximum into the “trusted” cost authority that enables an otherwise excluded paid candidate.

Before implementation, specify one concrete issuance boundary. For example, construct the store with a trusted host verifier whose `verifyConservativeDefault(binding) === true` is required inside the binding transaction, or bind an exact separately approved record/digest already present in the ledger and verify that lineage. Tests must prove a canonical but unauthorized source/digest writes no binding, and that a stateful/accessor/proxy verifier result cannot be used. Replay should validate the stored authority identity without reissuing it.

With that issuance rule added, the listed ownership and gate are appropriately bounded. No implementation or test was performed in this review. Plan SHA-256 reviewed: `ABB89326BE160F40418A5382AF3A61DC39987410E56FCD03FA6DA30FD28A0A2C`.
