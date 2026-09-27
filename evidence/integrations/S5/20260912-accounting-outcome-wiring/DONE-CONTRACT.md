# Accounting outcome wiring done contract

Date: 2026-09-12 KST

Done means the existing `readRunOutcome` DTO, and therefore its Core/evaluation observation and outcome-report consumers, uses the read-only authoritative all-inventory accounting snapshot. Monetary base/retry/verification breakdown is emitted only when every stored reservation has an authoritative final actual receipt and every item has validated lineage; handoff remains `null`. Missing, estimated, debt, local-count, and revision-unverified cases remain conservative, and strict scope/finality/receipt-regression validation continues to fail closed.

Attempt cap: 3 implementation passes. Every pass runs the focused outcome and outcome-report regressions, the authoritative-accounting regression, the daemon TypeScript build, and `git diff --check` for owned files. A failed pass requires a new diagnosis; after three distinct failed hypotheses the work is handed back with evidence.

No provider, model, network, Electron, native executor, measured-fact promotion, or performance measurement is authorized by this unit.
