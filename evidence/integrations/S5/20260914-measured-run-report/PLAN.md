# Measured evidence in explicit run report

Done means `npm run build` and the focused command below exit 0, the exported report preserves the pre-augmentation run-outcome digest as `measuredEvidenceBaseReportDigest`, adds only a bounded safe current-run evidence summary with explicit separate-read and completeness semantics, and boundary failures perform no measured callbacks or report writes.

Attempt cap: 2 maker passes. No source or test edits after pass 2.

Every pass runs from `daemon`:

```text
npm run build
npx vitest run test/integration-run-outcome-report.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-run-report-measured-evidence.test.ts test/integration-report-app.test.ts test/integration-report-delivery.test.ts
```

On failure, retry once only with a new hypothesis supported by the raw log. If pass 2 fails, stop editing and hand the defect and logs to `/root`.

Scope: `app/core.mjs`, `daemon/src/reports/ir.ts`, new `daemon/src/reports/measured-evidence.ts`, and new `daemon/test/integration-run-report-measured-evidence.test.ts`. Existing report/evidence tests are preserved unless a narrowly necessary assertion is required.
