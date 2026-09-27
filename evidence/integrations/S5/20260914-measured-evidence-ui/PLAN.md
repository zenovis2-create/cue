# Saved measured-fact evidence UI plan

Done means:

- `cue:evaluation` accepts only the exact `{ operation: 'measured-fact-read', factId }` command before prepare and calls the existing protected Core evidence read.
- IPC returns only a descriptor-safe, bounded measured-evidence DTO; hostile, unavailable, unauthorized, mismatched, or throwing values become the fixed unavailable reply without leaked details.
- The existing evaluation panel offers a manual fact-ID lookup and renders producer class, bounded provenance, and explicit quality/timing/accounting availability without evidence references, raw bytes, scores, or totals.
- Old, failed, mismatched, stale, and new-run results clear, and no lookup happens automatically.
- `npm run build` and the focused new IPC/DOM test, existing Core evidence regression, and existing evaluation UI regression pass.
- Final hashes are recorded in `final-pins.json`; original hashes are recorded in `preimages.json` and the original bytes remain under `preimages/`.

Maker pass cap: **2**. Each pass runs, in order:

1. `npm run build` from `daemon/`.
2. `npx vitest run test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-ui.test.ts` from `daemon/`.

Every failure is retained in `maker.md`. A retry requires a new written hypothesis. No third maker pass or source edit follows an exhausted cap.

This is component-level IPC/DOM coverage plus the existing protected Core regression. It does not establish a real Core-to-IPC happy path, live Electron visuals, runtime/provider measurement accuracy, trial readiness, or promotion authority. The local model remains off and is not contacted.
