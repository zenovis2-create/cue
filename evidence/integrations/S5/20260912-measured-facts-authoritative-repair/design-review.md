# Independent design review: measured-facts authoritative repair

## Review contract

Done for this design pass means the repair contract directly addresses the three preserved blockers without lifting Core containment: complete monetary membership/latest-receipt authority, database-derived cost classes, and immutable replay after newer observations. Attempt cap: 2 review corrections. Every implementation review pass must run the focused measured-fact, authoritative-accounting, and containment suites, plus TypeScript no-emit and scoped diff on the final pass. Any independent test edit must first preserve this contract and use a new concrete hypothesis.

## Verdict: PASS for implementation start

The frozen `DONE-CONTRACT.md` selects the correct repair boundary. It reuses `createAuthoritativeAccountingStore` rather than extending the blocked caller-selected accounting validator, requires complete reservation/latest-receipt membership and derived base/retry/verification classes, forbids invented handoff classification, applies latest-observation enforcement only to first capture, and returns an existing exact tuple before invoking the host. Core remains contained and every measured fact remains `trialReady:false`.

No migration is required if the authoritative historical snapshot, including its cutoff and digest, is stored inside the existing immutable measured-fact payload. First capture must obtain that snapshot inside the same immediate transaction used for dependency recheck and insert. Read must reconstruct with `projectAt(runId, storedCutoff).historical`, compare the canonical historical bytes/digest with the stored accounting value, and exclude `currentDisclosure` from fact identity. Otherwise a newer receipt would either rewrite history or make valid replay fail.

The implementation must retain these checks:

- A host payload that omits any reservation or the latest receipt cannot produce a smaller complete total. Either reject its accounting claim or replace it with the full authoritative projection; never use the host subset for membership or totals.
- Cost class, attempt, receipt revision, units, currency, and unit come from the authoritative item. A caller's false `base`, `retry`, `verification`, or `handoff` claim cannot influence stored output.
- An incomplete, non-final, or `unclassified` snapshot may remain conservative, but must not become a complete monetary total. Existing price dependency rules must still bind any monetary currency/unit to the registered price snapshot; local/unknown accounting keeps price null.
- Existing-fact replay with the exact enrollment/observation tuple returns the stored original without host capture or a latest-observation query. A changed tuple for the same fact ID, and a different fact ID occupying the same enrollment/observation tuple, fail as replay conflicts.
- Read/replay must detect cutoff/inventory tampering through `projectAt`; current post-cutoff disclosure does not change the persisted fact.

## Required independent counterexamples after source freeze

1. Seed two reservations with final latest receipts; have the host claim only one. Prove the captured fact cannot understate the authoritative total or membership.
2. Have the host relabel a stored original attempt as retry/verification/handoff. Prove the stored class is derived or capture fails.
3. Capture a fact, append a newer receipt, then read/replay. Prove the exact stored historical accounting/digest returns unchanged while the authoritative store separately discloses the newer revision.
4. Capture observation revision 1, append revision 2, then replay the revision-1 fact. Prove byte-identical return and zero additional host-capture calls.
5. Reuse the fact ID with a different tuple and reuse the occupied tuple with a different fact ID. Prove both fail before any second fact row appears.
6. Re-run Core containment and assert public capture/read still throw without invoking host callbacks or writing a measured-fact row.
7. On first capture, have the host submit a structurally valid older authoritative snapshot/cutoff that omits a newer receipt. Prove snapshot shape alone never confers authority: first capture must reject or replace it with an internally captured current snapshot. Only a snapshot recovered from the already authenticated measured-fact row may be validated at its stored cutoff during read/replay.

## Reviewed evidence

- Historical blocked review: `evidence/integrations/S5/20260912-measured-facts/review.md`.
- Containment review: `evidence/integrations/S5/20260912-measured-facts-containment/review.md`.
- Authoritative accounting correction-2 review: `evidence/integrations/S5/20260912-authoritative-accounting/review-correction2.md`.
- Repair contract SHA-256: `0E2440D1BFB55E19DA07ADEA49098E808E5F037E6209EAF2C5BBD540F5A278C2`.
- Pre-repair measured-facts source SHA-256: `AFF76F3ED5A7EE2C650B8B2D59247860F9FF27086EF930130E328CE640F2ADB1`.

No product/test source, migration, Core, provider, model, native, Electron, network, or paid-call action was performed in this design pass. This is approval to implement and test the bounded repair, not approval of measured facts, trial conversion, measurement completion, or Core exposure.
