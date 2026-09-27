# Independent final verification

The earlier maker history and first independent green-but-unqualified candidate remain preserved in `independent-audit.md`.

## Final pins

- `daemon/src/selection/exploration-budget.ts`: `265bbbfef0755b2a978036ba9c466ca719328f9f0b484097ef8a0e48fc505d6d`
- `daemon/migrations/041_exploration_budget.sql`: `c2931f2ae20c5605d6f3adc58a58a6aca645e6fdcd62d0c8ccd0423c70b8f951`
- `daemon/test/integration-exploration-budget.test.ts`: `b82de1c3e48159bb4a1bac0068c4d3bf37792763034b71ce0d8ffafbd0341957`

Root's full correction preimages match their manifest: store `072f5c...5669`, migration `03c89a...62cd`, and post-cap test candidate `a54925...25b7`.

## Contract audit

- Authorization is accepted only before any approval, attempt, ordinary reservation, or receipt and binds one candidate to the exact run selection-policy ID, revision, digest, candidate membership, currency, unit, positive subcap, and ordinary budget `policy_revision = policyId:revision`.
- The same exact binding is rechecked on every read/replay, so a later corrupt or foreign budget-policy lineage fails closed.
- Exploration reservation requires an outer transaction and the exact existing ordinary run/request/attempt/upper reservation. The exploration row adds no ordinary charge; summaries read the ordinary receipt revisions.
- Pending/unknown accounting conservatively retains the greater observed/upper amount. Latest actual provider-final accounting settles to actual; overrun becomes durable debt and denies the next exploration reservation.
- SQL and store guards cover immutable authorization/reservation rows, exact replay, update/delete/replace denial, hash/payload mismatch, foreign candidate/policy/budget, first-attempt timing, reopen corruption, concurrent writers, and outer rollback.
- The repaired raw SQL oracle uses valid canonical payload bytes with an intentionally wrong 64-byte digest, asserts the payload-mismatch trigger, then inserts the same payload with `cue_sha256` as a positive control.
- Tests explicitly execute migration 041 after opening the current ledger migration set; ledger/engine registration remains outside this unit.

## Independent re-gate

- Build exit 0. Raw log SHA-256: `89f372151bf1861e05da5fcf17034620efbad440875f28d2f36289729f3aac06`.
- Focused gate exit 0: 3/3 files, 29/29 tests. Raw log SHA-256: `3b0b9847088737519b987a88ef74f34f22f6da17ef500a0267945e4b66d2e21e`.
- Command: `npx vitest run test/integration-exploration-budget.test.ts test/integration-budget.test.ts test/integration-policy-store.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.

Verdict: PASS for the standalone exploration-budget migration/store contract. The shared build also compiled an unrelated draft migration/unit present in the worktree; no functional claim for that draft follows.

Scope: deterministic SQLite/store behavior only. No provider billing correctness beyond injected ordinary receipts, engine wiring, live/provider/model/native/Electron/network behavior, or whole-product completion is established.
