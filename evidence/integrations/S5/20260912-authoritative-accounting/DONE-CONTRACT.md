# S5 authoritative accounting done contract

Date: 2026-09-12 KST

Owned implementation is complete when the focused integration test passes and proves database-enumerated membership, stored-lineage class derivation, conservative totals, immutable fixed-cutoff replay, separate current disclosure across two SQLite connections, cutoff tamper rejection, and zero writes. The owned source and test must pass a strict isolated TypeScript check and `git diff --check`.

Maximum correction budget: five distinct diagnosed hypotheses. Every implementation pass runs the focused test and type/build or isolated type gate. A failure requires a new hypothesis; no identical failing command is repeated three times.

Frozen containment boundaries: no migration, Core, measured-fact, budget, local-budget, selection, promotion, driver, provider, model, native, Electron, network, or paid-call mutation. Revision-linked role lineage remains unavailable until migration 036 receives independent contract approval; it never falls back to the original plan role.
