# Saved comparison list plan

## Done contract

- Core accepts only `{ limit, cursor }`, with `limit` an integer from 1 through 20 and `cursor` null or a positive safe-integer row position.
- Each request scans at most 64 snapshot IDs in descending SQLite insertion order, validates every visible result through `readEvaluationComparison`, and returns only workspace-owned summaries: snapshot ID, recorded time, dataset ID/revision, mode, status, and `promotionEligible: false`.
- Foreign, corrupt, and oversized snapshots expose no identifier or error and do not prevent bounded continuation. Invalid or stale cursors fail closed.
- IPC preserves the same bounds and projects only the summary/list envelope. Listing is available before prepare and grants no read authority; selection uses the existing comparison-read operation.
- The renderer offers explicit refresh and next-page actions, replaces its bounded page, never displays the cursor, distinguishes empty from unavailable, and fences stale list/detail/new-run responses.
- Enrollment gating and manual ID lookup remain unchanged. No model, network, native helper, automatic run, or policy write occurs.

## Attempt cap

Two implementation/test passes. A second pass is used only for a concrete failure from the first.

## Every pass

Run JavaScript syntax checks, the two focused Vitest suites (plus a focused list suite only if needed), and `npm run build`. Inspect the scoped diff and record exact results and final hashes in `maker.md`.

## Failure rule

Stop after the second failed pass, preserve exact failing output, and report the blocker without claiming completion.
