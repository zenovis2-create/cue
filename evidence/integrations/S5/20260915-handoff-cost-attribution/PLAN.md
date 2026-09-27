# Authoritative handoff-cost attribution maker contract

## Done

Add a connected, supplemental cost-decomposition path without changing `cue-authoritative-accounting-snapshot-v1` totals or cutoffs:

- migration 045 (only if still free at edit time) stores immutable host-observed invoice decompositions and a versioned measured-fact projection;
- every decomposition binds one stored monetary reservation to its exact attempt/request, the latest-at-accounting-cutoff final actual budget receipt and payload digest, and that attempt's exact integrity-checked handoff plus orchestration receipt/revision;
- a decomposition contains explicit `base`, `retry`, `verification`, and `handoff` unit components whose nonnegative safe-integer sum equals the already billed receipt total; these are a partition of the total and are never added to it;
- the role/retry lineage constrains which non-handoff class may be nonzero, while an explicit evidence-backed zero handoff component remains distinguishable from missing attribution;
- trusted host attribution is captured through the actual measured-fact host path, descriptor-snapshotted once, and supported by exact resolved evidence bytes; no provider-derived decomposition is synthesized from terminal/handoff text;
- missing, non-final, estimated, foreign, duplicate, stale, overlapping, mismatched, or post-cutoff data yields a failed capture or an explicit unknown coverage disposition with no double counting;
- current capture stores a separate `cue-handoff-accounting-projection-v1` cutoff/inventory record keyed to the measured fact; legacy measured-fact v1 bytes and accounting cutoff replay remain unchanged and do not consult newer attribution rows;
- unconfigured hosts continue to capture explicit unknown handoff-cost coverage. Existing hosts that never produce a final invoice cannot produce known attribution.

Shared `ledger.ts` and asset-copy registration are supplied to root as an exact schema contract and are not edited by this maker. Build exit 0, focused meaningful tests, hashes, raw logs, and independent review are required.

## Attempt cap

Three diagnosed corrections. Every failed pass requires a new evidence-backed hypothesis. A regression is reverted unless the measured gate improves.

## Every pass

Run the new handoff-accounting fixture plus existing authoritative-accounting and measured-facts suites. After root migration registration, run the coordinated TypeScript/build gate and repeat the focused suite against normal `openLedger` migration installation. Inspect scoped diffs and source/compiled migration hashes.

## Failure handoff

After three unsuccessful corrections, stop and report the exact assertion/type error, persisted rows, attempted hypotheses and evidence paths. No provider, model, native helper, network, or live billing call is permitted.

## Claim limit

Offline fixtures use an explicitly synthetic trusted host and synthetic final receipt evidence. They validate authority boundaries and accounting invariants but do not prove a provider supplies decomposed invoices. Broad S2-03/S5-03 remain open until an actual billing producer supplies this attribution and parallel reservation/settlement is empirically verified.
