# Independent review — initial-default store and migration 040

Verdict: **PASS for the bounded store layer**.

The implementation adds one immutable `cue-initial-default-v1` configuration per run. It binds the exact existing run selection policy, ordinary budget revision/currency, and an allowed candidate to a complete conservative `verified-completion-total` estimate. API and SQL checks enforce known quality, cost and time bounds, policy limits, freshness, provenance, canonical bytes, and insertion before any approval event or first attempt. Reads revalidate the full payload, hash, columns, policy, budget and candidate after reopen.

Migration 040 is wired once through `openLedger`. A ledger without migration 040 reads the feature as absent; a partial schema or missing marker fails closed. Configuration and attempt-provenance rows reject update, delete, replacement and conflicting replay. A raw preapproval payload with a valid hash but an over-limit bound is rejected by SQL, and a valid raw payload after approval is also rejected by SQL.

The attempt helper requires an existing attempt, its exact ordinary reservation, the configured run and digest, and an active caller transaction. Its reader verifies canonical bytes, every stored column and the current immutable default. The helper is intentionally not wired to the engine in this unit.

## Pins and verification

- Store: `94691e71ece1b867626c975ab45a21cdcde0539633bab844789e25a49adce60c`.
- Migration 040: `f55ec99b902c1c191364587b9521fa937bfc25941cc740fc3667d25eebd04985`.
- Ledger: `e3954a13055cbb818d5c5ba384e985c8262640504137c40cc1808964b7743d48`; full byte preimage `19bcb46c6c3d0c02b2f6b4cf828c1d277072def59ff4e158f2e8535ce394e47e`.
- Store test: `50c319890bc0aa9803607d091dca34ce308d0751385a045dafc0717ecde21ac2`.
- Frozen baseline fixture/test pins remain `b900703c03718b24e4efd90734282cad879599ed98a4764b9a9bdff2f196b949` and `430700fb5eb898fa61d89226975f0042591ba457d3167cee9b04ed845fb5687f`.
- Maker build exited 0; maker focused gate passed 31/31. All maker final/preimage/log pins matched.

Independent store/policy/budget/baseline gate: 4 files, 30/30 tests passed, exit 0. Raw log SHA-256 `3a8c4283db13595a51059bdaf2169274f5db2d57982970d2e8f15d855f134c05`; exit receipt `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.

Independent existing engine compatibility gate: 1 file, 10/10 tests passed, exit 0. Raw log SHA-256 `1cdcc9a18964c288977688d0bdbf33fae404ffa2756c130b5136426c5c980854`; exit receipt `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.

## Scope boundary

This PASS covers storage, migration, immutable provenance helpers and compatibility with the unchanged engine. No engine selects the configured default or records this provenance yet. It does not prove no-statistics observation handling, manual-pin interaction, callback mutation safety in an engine path, atomic provenance recording with a claim, exploration authorization/accounting, UI/IPC, trusted production statistics/prices, or live provider/model/native/Electron/server/network behavior. The broad cold-start/exploration checklist item remains incomplete.
