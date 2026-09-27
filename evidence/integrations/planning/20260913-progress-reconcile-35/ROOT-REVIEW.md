# Root reconciliation audit 35

PASS for the backend replan invariant. The independently reviewed engine/budget coverage, together with the prior claim-limit review, supports checking the exact item for preserving cumulative budget, attempt limits, and original requirements across replanning. Broad S4 and real-provider workflow acceptance remain open.

The four-file gate passed 24 tests using the production engine, SQLite, stores, stage binder, and budget manager with an injected runtime boundary. The initial 40-unit reservation remains committed; another synthetic 60-unit reservation causes revised admission to fail and roll back its attempt, activation, stage, and selection before revised runtime start. The affordable branch commits 80 units cumulatively; exact replay adds neither a reservation nor a runtime call. Approval changes and empty requirement removal are rejected independently. Nonempty requirement-omission coverage remains source-inspected. These are reservation/accounting invariants, not final provider billing or actual model execution.

Prior fixture failures and the subsequent static-audit correction history remain recorded in maker.md and the plans. The final successful gate does not erase them. Product source was not changed.

- Independent review: [review.md](../../S4/20260913-replan-budget/review.md), SHA-256 `E1BAD532636AAEF1FCC07B69FDA309ED6E3BEDE1EB4554E055FA947DAD2AD62E`.
- Final TypeScript check `7dc88b`: exit 0; [receipt](../../S4/20260913-replan-budget/typecheck.json).
- Root hash audit `df114a`: final test/review hashes match; store and recovery-policy source hashes retain their pre-unit values.
- Document audit `987a3a`: four document hashes match RESULTS.md, the exact backend invariant is checked, and all 385 local references resolve.
- Scoped document/test diff check `ec717f`: exit 0.

Overlapping test counts are not summed. No new build, static-source recapture, native/model/live operation, or current full-suite run occurred. Historical snapshots and consumed WFP failure evidence remain unchanged; the overall GOAL remains unfinished.
