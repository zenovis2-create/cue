# Held recovery admission reproduction contract

The before behavior is preserved in `RESULT.md`: the real store issued a replan while an open held case remained.

Implementation is done when `recordDecision` performs a final, integrity-checked held-recovery read after all host callbacks; open or corrupt cases fail before decision insertion, reconciled-stop produces only a stop decision, a valid sealed eligible-for-disposition case can proceed, and no-held behavior remains unchanged. Existing decision replay and `appendRevision` must not revive a non-stop decision if a new open or reconciled held case appears later.

The claim boundary is included: after a persisted retry/switch/replan decision is read, the orchestration store must perform the same fresh held authority check as its final admission read before inserting a replacement attempt or mutating stage/lease/reservation state. A held case created after decision commit therefore remains blocked.

Implementation attempt cap: two passes. Every pass runs `npx vitest run daemon/test/integration-held-recovery-admission.test.ts daemon/test/integration-recovery-policy.test.ts`. A failure requires a new evidence-based hypothesis or handoff; no shared build is part of this bounded unit.

No native helper, model/provider, network, external effect, or live workflow is invoked.
