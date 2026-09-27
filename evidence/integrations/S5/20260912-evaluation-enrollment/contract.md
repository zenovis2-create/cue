# Evaluation enrollment maker contract

- Done: `npx vitest run test/integration-evaluation-enrollment.test.ts test/integration-evaluation.test.ts`, `npx tsc --noEmit`, and `npm run build` exit 0 from `daemon`.
- Attempt cap: at most two diagnosed correction hypotheses for this unit.
- Every pass: run the focused enrollment suite and the existing 12-case evaluation regression; after they pass, run typecheck and build.
- Failure handling: retry only with a new, recorded hypothesis; after two failed corrections, preserve evidence and hand the unresolved issue to the parent.
- Scope: offline SQLite only. No full suite, Electron, native/helper/model execution, pricing lookup, or paid call.
- Truth boundary: an enrolled `inputDigest` is a predeclared dataset claim. The current ledger stores no canonical executed-input bytes/digest that can prove equivalence, so this unit must persist `claimed-not-verified` and must not expose a verified-input option.
- Baseline boundary: current monetary and local policy snapshots encode only the four automated modes and no immutable manual-execution authority. First-time `manual-baseline` enrollment is rejected as unsupported.
