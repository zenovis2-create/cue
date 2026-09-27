# Independent S7 report foundation review

Reviewer: `/root/transport_review`. Read-only implementation review; no source changes. Result: PASS for this pure IR/HTML foundation, not S7 completion or delivered/browser-verified output.

## Findings

No blocking correctness or HTML injection defect was found in the reviewed scope.

- `readRunReport` reads the bounded existing ledger projection and plan topology in one SQLite transaction. Nodes carry observed stage state; edges explicitly carry planned provenance. The details retain attempt history/counts and truncation indicators, including prior failures, unknown cost and historical rather than current acceptance. Truncated stage topology is refused. It does not infer observed invocation order from dependency edges.
- The SQL fixture tests actual ledger reads and two failed/current attempts. It is intentionally not a fully accepted real orchestration/requirement execution: this proves observational projection, not plan authorization or acceptance qualification. Invalid/missing acceptance remains unverified through the reused projection.
- Source input is bounded, exact-shape JSON. Relative file paths, revision/hash syntax, IDs, duplicates and dangling edges are validated. Declared file hashes/revisions are not authenticated, source files are not read, and all supplied relations remain explicitly unverified. No impact, security or efficiency result is fabricated.
- Canonical node/edge/file ordering and recursively frozen owned IR support deterministic serialization and stable-ID differences. The private ownership set prevents supplying a forged external IR to the renderer. Comparison rejects different report kinds/identities and reports metadata changes separately; it does not interpret a structural delta as impact.
- Every variable HTML text field is escaped. There are no scripts, event handlers, URLs, external assets, executable attributes, file writes or IPC calls. A static CSP blocks scripts/connect/object/base/form activity and permits only the exact static stylesheet hash. The HTML/IR byte counts and independent SHA-256 values match their returned strings.
- `delivery`, upstream validation, browser evidence and visual review correctly remain not-written/not-run. The JSDOM assertion is a parser-level check, not a real browser network capture or visual acceptance.

## Independent checks

Daemon working directory, 2026-09-11 20:09 local:

```text
npx tsc -p tsconfig.json --noEmit
npx vitest run test/integration-reports.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Typecheck exit 0; focused 5 tests PASS, duration 970 ms (tool chunk 4ab670). Tests cover ledger state/history and private payload exclusion, immutable/canonical declaration behavior, schema/path/ID bounds, hostile label parsing plus stylesheet CSP hash and artifact digests, and exact comparison provenance boundaries. Browser and artifact export are outside this unit and were not run.

## Reuse decision and follow-up scope

The implementation is consistent with local `R-08-archify.md`: Cue-owned schema and offline renderer, stable IDs, source/output hash separation, no copied CLI/brand/font assets or claimed upstream validation. This review did not re-audit the external repository/license URLs. The decision document still has an implementation-proposal/parent-approval-pending heading; that heading is historical/stale after this implementation and should be updated when the parent records the checkpoint. It does not change the code verdict.

Real source extraction, report delivery with last-good preservation, app integration, actual browser evidence and independent visual review remain follow-up work. These passing modules alone do not satisfy the complete S7 checklist.

## SHA-256

| Artifact | SHA-256 |
|---|---|
| daemon/src/reports/ir.ts | C3796ACFAB8106C0D2C21E9C771AC798365802913766FC63AA59B7DE509A5C77 |
| daemon/src/reports/html.ts | 70E101C4EA600C6C6AC13DBD7781A22613C10325E4A52CC003C0CB0FCFA64FE0 |
| daemon/test/integration-reports.test.ts | 526DA0F0C80DE7F041E6352A80F3B59B23B6977E7FF37EC4DC346EB8EC89522A |
| docs/reuse-decisions/R-08-archify.md | 4C9FD466099E3419A9A571DE95553BBA3074CE4476F500D254AA775FAED33F53 |
