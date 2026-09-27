# Remaining 44 execution-map plan

## Done

Done means `docs/integration/REMAINING_EXECUTION_MAP.md` contains exactly one row for every unchecked parent checkbox in `docs/INTEGRATION_CHECKLIST.md`, and each row records: current code/evidence anchor, concrete missing behavior, measurable completion gate, dependency, and execution class (`offline-now`, `live-required`, `external-input`, or `deferred-unknown-sha`). The map must also distinguish broad release coverage from a bounded backend implementation and end with 3–5 independent tasks with exact file ownership.

Verification command: a read-only PowerShell/Python comparison extracts every `- [ ]` parent item from the checklist and confirms a one-to-one set match against the map IDs/text; link/path checks confirm cited local anchors exist. The original checklist remains unchanged.

## Attempt cap

At most two factual corrections to the execution-map document after its initial write. A failed gate requires a new hypothesis. Historical failed gates remain cited; their prior attempt cap does not prohibit a changed implementation.

## Every-pass checks

1. Extract the current unchecked parent set directly from `docs/INTEGRATION_CHECKLIST.md`.
2. Compare map coverage one-to-one, without percentages or completion claims.
3. Verify local code/evidence paths and the offline/live classification constraints: local model OFF; no probes, restarts, downloads, live calls, or secrets; unknown Codex SHA deferred.
4. Confirm the proposed implementation tasks have non-overlapping exact ownership and measurable gates.

## Failure handling

On a mismatch, preserve the output, identify whether extraction, identity, evidence anchoring, or classification caused it, and make one bounded correction using a changed hypothesis. After two factual corrections, stop and hand the remaining discrepancy to the parent agent with the retained gate output.
