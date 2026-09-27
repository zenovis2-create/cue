# Independent review — exploration engine integration

## Verdict

**PASS** for the bounded offline engine/store/SQLite contract. This does not qualify live providers, native helpers, Electron, network behavior, provider billing truth beyond injected authoritative receipts, or the whole product.

## Criteria and source audit

- The optional `cue-exploration-request-v1` object is copied from exact own enumerable data descriptors, validates its digest and candidate, rejects proxies/accessors/extra or missing fields, and is frozen before the request journal digest is computed.
- A grant remains inert without the explicit flag. The no-flag engine path does not instantiate or query the exploration store. Explicit exploration performs the exact two-table/eight-trigger migration inventory check before policy binding, installation, or host callbacks.
- Authorization is bound to the current run, candidate, policy ID/revision/digest, and the ordinary budget policy/currency/unit. Selection retains task, plan approval, forced candidate, pin, freshness, quality, cost, and time filters.
- The ordinary reservation and exploration reservation share run/request/attempt/candidate/upper terms and execute inside the same outer IMMEDIATE transaction before preparation and launch. Later synchronous failure rolls back the claim and both reservations.
- Replay first matches the journal-bound request. It requires an existing exploration link and calls the read-only exploration summary, which revalidates canonical payload/hash and exact ordinary reservation lineage. It does not reserve, repair, recharge, or relaunch. Missing linkage, changed intent, corrupted payload, and changed ordinary upper units deny replay.
- An explicit exploration request conflicts with an initial-default `no-statistics` observation. The local engine rejects the flag before binding or any host effect.
- The overrun regression reserves 40 ordinary/exploration units, accepts a separately trusted provider-final actual receipt of 50 under exploration cap 40 and ordinary cap 100, and proves the next 40-unit exploration is denied by exploration debt while ordinary room remains; the new claim/reservations roll back.
- Ledger startup installs migration 041 only when neither table exists, rejects partial table/guard inventories, and preserves existing history rather than reconstructing a partial schema. The asset copier includes 041.

## Frozen pins

- `daemon/src/orchestration/engine.ts`: `A66F5AFD3CEE61774AB7B9FBCDE8E0E076A1B11743428424DDBFA6B07E8D863D`
- `daemon/src/ledger.ts`: `82FB44EEEB7CF69402A8C54AF185DD1DE77798FE66C96F973734091377C0C2E7`
- `daemon/src/selection/exploration-budget.ts`: `265BBBFEF0755B2A978036BA9C466CA719328F9F0B484097EF8A0E48FC505D6D`
- `daemon/migrations/041_exploration_budget.sql`: `C2931F2AE20C5605D6F3ADC58A58A6ACA645E6FDCD62D0C8CCD0423C70B8F951`
- `daemon/scripts/copy-assets.mjs`: `FB1D47C891B33D2A2B73615D4DBA59ACAF8CDCF6BED69B687EFF61BA12643737`
- `daemon/test/integration-exploration-engine.test.ts`: `FBF3ACE9714CC178DA0CE9AAE9A3454EE59CDFDB324C3696BFE7C68760093230`

## Independent evidence

- Build: `npm --prefix daemon run build`, exit 0. Raw log SHA-256 `89F372151BF1861E05DA5FCF17034620EFBAD440875F28D2F36289729F3AAC06`.
- One combined gate from `daemon`: `npx vitest run test/integration-exploration-engine.test.ts test/integration-exploration-budget.test.ts test/integration-initial-default-engine.test.ts test/integration-initial-default-store.test.ts test/integration-initial-selection-baseline.test.ts test/integration-engine.test.ts test/integration-budget.test.ts test/integration-policy-store.test.ts test/integration-driver.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts test/integration-local-engine.test.ts test/integration-recovery-policy.test.ts test/integration-recovery.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 14 files and 169/169 tests. Raw log SHA-256 `F6C8C7F5B1A45F7F1E0B1495E43F5C8B356AD294F4C1332F6C573178CB87F87D`.
- Compiled `dist/src/ledger.js` fresh/reopen smoke: both passes returned exactly two exploration tables and eight named triggers, exit 0. Raw log SHA-256 `FF709B1608B7DB6885833EFB1A646A858FDD055FA28E5C0A90939DC3524C73B7`.

The first build logging wrapper used an evidence path relative to `daemon`; its sink failed and produced no evidence. The build was then run and captured from the repository root. The first smoke attempt referenced `dist/ledger.js`; the second used invalid SQLite string quoting. Both failures are retained as `independent-final-smoke-attempt1*` and `attempt2*`; neither exercised product behavior. The third smoke used the correct compiled path and query, passed fresh and reopen inventory checks, and is the qualified smoke evidence.
