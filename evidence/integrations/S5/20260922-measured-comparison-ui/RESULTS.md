# Batch96 — measured comparison list / IPC / desktop

2026-09-22. Direct implementation and self-review; not independent review.

## Implemented

- Dedicated `Core.listEvaluationMeasuredComparisons({limit,cursor})`: 1–20 records, maximum64 envelope scans/page, descending SQLite insertion cursor. Fully validates measured version, immutable sources and current workspace before returning summaries; skips legacy/foreign/corrupt rows. Empty filtered pages preserve continuation. No evidence callbacks or migrations.
- `app/measured-comparison-ipc.mjs`: strict create/read/list/inspect commands, bounded descriptor-only copies (2MiB string/key budget,100000 nodes,depth32), no getter/Proxy/thenable execution. No caller measurement/receipt/time/authority fields. Projection removes raw members/trials/run/fact/attempt/receipt/evidence identities and paths. Recognized conversion reasons retained; producer-defined messages reduced to an uncertainty count.
- `app/ipc.mjs` and declarations route four dedicated operations. Existing sender gate and old outcome-only routes remain unchanged. Core continues scoping all selected members before evidence callbacks.
- Separate desktop section: explicit enrollment ID membership, policy digests and comparison criteria; manual creation, bounded list/next/select, historical read and distinct current evidence inspection. Shows full expected denominators, all outcomes/missing stages, conversion provenance, withheld numeric inputs and immutable historical means where complete. No auto collection, execution, retry, promotion or improvement proof.
- All renderer strings use textContent. Shared pending lock, failure clearing and generation checks discard replies after run selection/approval/Stop. UI does not treat list/read as current revalidation.

## Verification

Final command (daemon/): `npm run build`, then `npx vitest run <36 paths from test-files.txt> --fileParallelism=false --maxWorkers=1 --reporter=verbose`.

- `build-final.log`: exit0.
- `regression-final.log`: **36 files /316 passed /0 failed /0 skipped /0 unhandled errors**, exit0. Start20:45:54 +09:00;125.16 seconds.
- **11 added tests** in the measured-comparison suite (now30; prior19). Actual temporary SQLite/Core/IPC and JSDOM→structuredClone→IPC→Core→SQLite, pagination, no-host historical reopen, scope, source redaction, malformed/hostile command/output, incomplete denominators, busy and stale UI responses.
- Test-file reconciliation in `summary.json`: requested/executed lists checked, no missing/unexpected files.
- Source, compiled backend, tests, docs, exact preimages, failure and final logs pinned in `pins.sha256`; verification recorded in `pins-verified.log`.
- Historical focused run:2 files40pass; overlaps final and is not additive.

## Preserved failure and correction

`regression1-failed.log`:35 passed files/1 failed file;315 passed/1 failed test;1 unhandled rejection. The new empty-page UI test awaited a disabled Next button as if that meant completion. The button is also disabled *during* pending requests. It submitted while the intentional shared busy fence was active, then closed JSDOM before the pending request finished, producing the unhandled querySelector error.

Hypothesis1 only: wait for the final generic unavailable status from the deliberately nonexistent continuation cursor, then assert disabled and exercise the form. `pagination-race-source.ts` preserves the failing exact source. No product behavior, boundary, timeout or skip was relaxed. `pagination-fix.log` passes the selected test; the other29 are filtered, not newly permanent skips. Final full selected run has no skips/errors.

## Limits / remaining work

- Fixtures contain synthetic consent/launch/terminal/accounting/evidence authorities and failed runs, not real provider success or economic performance. No real provider/model/account/service calls were made. Qwen OFF, subscription4/4 exhausted remain unchanged.
- Default production app still has no measuredFactHost composition. New generation fails unavailable without a host; historical read/list work for valid existing workspace snapshots and inspection may be unavailable. Production executed-input/quality/timing/context/account/price/cost producers are the next implementation scope.
- The renderer's source counts describe conversion receipts; unavailable conversion does not infer observed provenance from a stored fact.
- Historical descriptive averages are not current price qualification, statistical significance, representative holdout evidence or policy-promotion authority. `promotionEligible:false` / `improvementProven:false` remain permanent.
- This run is targeted, not a fresh whole-suite run. Batch89 whole regression predates90–96. Native Electron/manual acceptance, real assistive-technology audit and independent review remain open.
- Original checklist stays33/44 closed,11 open. No commit/push/publication, credential/home changes or unrelated cleanup.
