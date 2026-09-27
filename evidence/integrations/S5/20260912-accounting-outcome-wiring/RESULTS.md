# Accounting outcome wiring results

Date: 2026-09-12 KST  
Status: ready for independent review

`readRunOutcome` now projects monetary accounting from the read-only authoritative all-inventory snapshot while retaining its existing public DTO and strict reservation/receipt validation. Complete, authoritative final actual inventory with validated lineage emits base, retry, and verification decimal-string totals. Handoff remains `null` because no separate authoritative handoff-cost schema exists. Missing or estimated receipts keep finality and all class totals unavailable. Revision-unverified lineage keeps class totals null without invalidating otherwise authoritative actual, committed, remaining, or debt totals. Local invocation output remains count-only.

The existing report path was exercised through `readRunOutcomeReport`; evaluation observation/Core and UI regressions were also exercised. No measured fact was promoted and no provider, model, network, Electron, native executor, or paid activity ran.

## Gates

- Daemon TypeScript build after fixture correction: BLOCKED outside this unit by concurrent, not-yet-reviewed `change-snapshot-host.ts` errors at lines 38-39 (`TS2345`, `TS2551`). The accounting source and corrected test compiled in the preceding build before that concurrent edit.
- Owned accounting outcome cases: 5/5 PASS (late receipt, report/debt, missing/estimated/revision unknown, retry inventory, local count).
- Outcome report plus authoritative accounting: 10/10 PASS.
- Evaluation observation/Core/UI consumers: 11/11 PASS.
- Owned `git diff --check`: PASS.
- Full outcome/report/accounting plus current acceptance/history regression after correcting the fixture: 54/54 PASS. The fixture now supplies valid host-observed `EvidenceObservation` records through the public acceptance API; the positive accepted-outcome and contradictory-acceptance checks pass without weakening acceptance policy.

## Frozen hashes

- `daemon/src/evaluation/run-outcome.ts`: `BC7CE539B31AC8751ED34A660E5BFEB3ECD647060F2D1333F4CC3FABECD2FA64`
- `daemon/test/integration-evaluation-outcome.test.ts`: `4F1ED660D95D80E711F1FD7756DD0EDEE8E93B5E0636B6430BCFA6460D11C51B`
