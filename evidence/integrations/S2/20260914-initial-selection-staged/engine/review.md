# Independent review — staged initial-default engine

## Verdict

**PASS for the bounded initial-default engine layer.** This qualifies the configured cold-start default path and its durable replay provenance. It does not qualify paid exploration, migration 041 registration, production statistics ingestion, or live/provider behavior.

## Source and boundary review

- Frozen pins match the working files: `engine.ts` `9e3d4edd2e6bf208f124418b283a2e0dcbe09b9c13cf7e155150ba82cf614cdd`, fixture `74a5b342605ad4b906b05624bca1e834d87db4955f7a22a442ee19ca41ac7856`, and new test `e5dd4dc0c674ed77a8261934eb6bed266ce0764deafe05235928dda11dd212b0`.
- The exact engine and fixture preimages are retained at hashes `6e6f0915c21422ebe937668dccae1f62e4011c46473960125b83180f17dee33c` and `b900703c03718b24e4efd90734282cad879599ed98a4764b9a9bdff2f196b949`; the new test was absent.
- With no run configuration, the existing selector path remains exact and does not call the new host hook. With configuration but no observation, ordinary selection runs and records `legacy-observation-absent`.
- With an explicit trusted-host `no-statistics` observation, the engine snapshots and validates all candidate own data before the hook, requires an exact fresh configured-candidate match, and substitutes the conservative default only for an exactly null estimate. A valid non-null estimate plus `no-statistics` is rejected rather than given false provenance. Stale, low-quality, wrong-currency, unknown-bound, ineligible, pinned, task, plan, and forced-selection failures remain enforced by the selector.
- The attempt marker is recorded inside the existing immediate claim/reservation/preparation transaction. The rollback test proves preparation failure removes the marker, attempt, reservation, and fixture artifact together.
- Configured replay requires exact run/request/candidate/default-digest lineage and performs no observation, authorization, reservation, preparation, or launch callback. A missing marker fails closed. A database with none of migration 040 remains legacy-compatible; the store layer rejects partial 040 schema.

## Evidence

- Maker build: `logs/revision-2-build.log`, exit 0, SHA-256 `79ae7b16f67e4c1d35b58dde6bcd910bf4e0ec266bebb364a2643027e3c7c67e`.
- The first smoke is correctly retained as a command-quoting failure before database open. Corrected compiled `openLedger` smoke: `logs/revision-2-smoke-continuation.log`, exit 0, reports `initial_default`, SHA-256 `8197f4a6de5b8ce55b630e47ff28c09729a201cd1b0f6d1658caeb6ed540d227`.
- Maker focused gate: 5 files, 39/39, exit 0.
- Independent focused gate: 5 files, 39/39, exit 0. Raw log `logs/independent-focused.log`, SHA-256 `f3e09cfdcdebd9b8fa05709466b84d4e48196745e07c63aeda6feeb439d53fbd`; exit receipt `logs/independent-focused.exit`, SHA-256 `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.

The compiled smoke proves migration 040 is packaged and applied by the built ledger. Although the migration 041 asset is packaged, this layer neither registers nor uses it. Broader driver, local, and recovery regressions are intentionally deferred to the final exploration-engine gate to avoid duplicate runs.
