# S5 measured-facts authoritative repair contract

Done means monetary measured-fact validation uses `createAuthoritativeAccountingStore` as the complete reservation/latest-receipt inventory and derives each accepted item's attempt, receipt, revision, units, currency/unit, and cost class from that stored snapshot. A host cannot omit a latest receipt, relabel base/retry/verification, or introduce handoff classification; incomplete or unclassified authoritative inventory cannot be sealed as complete monetary accounting.

Exact replay of an existing fact returns its immutable original after newer observations exist, without invoking host capture or reapplying the latest-observation gate. Reuse of its fact ID with a changed enrollment or observation tuple remains a replay conflict. Latest-observation enforcement applies only to first capture.

Core containment and `trialReady:false` remain unchanged. No migration, Core, IPC, UI, provider, model, native helper, network, price fabrication, trial conversion, promotion, or checklist completion is in scope.

Attempt cap: two new diagnosed correction hypotheses. Every pass runs the focused measured-fact tests, authoritative-accounting tests, and measured-fact containment regression; the final pass also runs TypeScript no-emit and a scoped diff check. A failed pass gets one new evidence-backed hypothesis; after two failures the frozen blocker is returned to root.
