# Independent review: accounting outcome wiring

Date: 2026-09-12 KST  
Verdict: **BLOCKED on the owned regression gate**

## Review done contract

Done means the frozen source and changed outcome test are reviewed against `DONE-CONTRACT.md`; authoritative monetary inventory, receipt finality/regression, debt, revised lineage, retry classification, local counts, Core observation, and report consumers are checked with proportional tests. The focused outcome/report/accounting command, current acceptance and consumer regressions, build, hashes, and owned diff check are recorded. Only this review file is owned. No provider, model, native, network, Electron, or helper call is made.

## Code assessment

No concrete accounting-wiring defect was found in the covered source paths. `readRunOutcome` now calls `createAuthoritativeAccountingStore(db).captureCurrent(runId)` inside its read transaction for both monetary and local accounting. Monetary output verifies kind/currency/unit and complete reservation membership before deriving class totals from authoritative items. Class totals remain null unless all relevant receipts are final actual and every item has a classified lineage; handoff remains null. Missing/estimated receipts remain non-final, revised attempts preserve valid aggregate units while withholding all class totals, retry inventory includes the failed and replacement attempts, and local accounting exposes committed-dispatch counts without monetary fields. The report regression proves `readRunOutcomeReport` carries the same outcome DTO.

The implementation retains its strict reservation and receipt payload checks, finality constraints, and receipt-regression validation before exposing sanitized receipt DTOs. Debt is surfaced explicitly through committed, remaining, and debt decimal strings. Actual Core observation and renderer DTO validators already accept the monetary/local shapes; their current tests pass.

## Blocking gate

The required owned outcome regression is not green. The exact focused command produced **21/23 passed**:

- `verified acceptance stays success with unresolved billing and numeric quality unknown` fails because `finalize(evaluation).status` is now `blocked`, while line 129 still asserts `accepted`.
- `corrupt acceptance, contradictory parent state and corrupt policy fail closed` later expects `readRunOutcome` to be unavailable after changing the task to failed, but the fixture never created an accepted receipt because the same finalization was blocked. The observed `recorded` failure outcome is therefore consistent with the current database state, while the assertion assumes obsolete acceptance state.

This is supported by an independent run of the current acceptance plus observation/Core/UI suites: **30/30 passed**. Current acceptance fixtures include the hardened evidence-policy fields and demonstrate valid accepted receipts, while the changed outcome fixture is stale. The two failures do not show an accounting calculation regression, but `DONE-CONTRACT.md` requires the focused outcome regression on every pass. They cannot be waived. Update the owned fixture to satisfy current evidence-policy admission (or explicitly assert blocked behavior in cases that do not need acceptance), then rerun the full focused command.

## Verification

- Focused outcome + outcome-report + authoritative-accounting: **21/23 passed, 2 failed**, exit 1.
- Current acceptance + observation/Core + evaluation UI: **30/30 passed**, exit 0.
- Daemon build: **passed**, exit 0.
- Owned/evidence `git diff --check`: **passed**.
- `daemon/src/evaluation/run-outcome.ts` SHA-256: `BC7CE539B31AC8751ED34A660E5BFEB3ECD647060F2D1333F4CC3FABECD2FA64`.
- `daemon/test/integration-evaluation-outcome.test.ts` SHA-256: `119D4C0F8C52B793F0C8C6D59DDC4EB8577F4D78CFF8B9E8D5C44379DCDF36DD`.

This verdict is limited to wiring the already reviewed accounting snapshot into the existing outcome DTO and consumers. Core accounting remains subject to the existing containment/integration decision. This review does not establish a real trial, promote a measured fact, complete S5 measurement, or authorize any external execution.
