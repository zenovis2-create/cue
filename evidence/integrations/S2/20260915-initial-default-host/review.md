# Independent review — trusted-host initial default

## Verdict

**PASS for the bounded offline monetary-host preparation and Core approval path.** The final source binds an optional trusted initial default to the exact run and selected policy, preserves legacy absence, and exposes the configured candidate and conservative bounds for approval. This does not qualify exploration consent, live providers, native helpers, Electron, or the deferred local model.

## Contract and source review

- `prepare.initialDefault` accepts exactly `defaultCandidateId`, `conservativeEstimate`, `source`, and `boundAtMs`. The existing plain-data snapshot rejects accessors, proxies, extra lineage, and later host mutation. Version, run, and policy identity are derived by the driver.
- Local-invocation hosts reject the option before policy, budget, plan, or initial-default persistence.
- The driver binds policy, initializes the monetary budget, then calls the immutable initial-default store inside the existing preparation transaction before plan installation. A later preparation error rolls all of these writes back.
- Exact prepare replay and a newly created driver over the same ledger accept the same configuration. Changed configuration conflicts; omission with an existing binding fails closed. `assertPersisted` rereads the canonical record, whose store decoder checks its complete payload and digest, so missing or tampered data cannot be justified by the smaller approval projection.
- The existing `...host.engine` composition forwards `observeInitialSelection`. The real driver test supplies a null candidate estimate plus an explicit `no-statistics` observation and proves the resulting attempt marker and configured candidate. No statistics or measurements are invented.
- Core uses the existing approval renderer. Visible Korean copy includes candidate, conservative cost/time, and currency. The canonical digest remains frozen in the internal approval summary and ledger but is not exposed in `threeLines`.

Final source pins match `source-pins.json`:

- `app/orchestration-driver.mjs` `e1640ca4009d489ac3c19c4d72553015a246da7268d7d28dc5e4518b7ec1819d`
- `app/orchestration-driver.d.mts` `432818c6ad4588e49a1e4847225d1a550ce55f3a6710c6afc56ee8d611bc0da6`
- `app/core.mjs` `cd00ba74e58efe44adb8687b6b8e0e48eda9be7a8566de4aae3cedcadbcce70c`
- `daemon/test/integration-driver.test.ts` `a3f8013dac3700e85c0370b1dbee5e3b2aa14dad5cb79e500ee0c5a2c59efceb`
- `daemon/test/integration-selection-preference-core.test.ts` `eef83f9a2a45dd76b7323bca81d3eac46e869fdadb65ad4973c0732879efd9d0`
- `daemon/test/integration-local-driver.test.ts` `8ab58652af7da80abdf8bb11c488ed78fcfb8075069a03026b1e4a2423e5a673`

## Evidence

- Maker final pre-copy combined gate: six files, 94/94, exit 0. Maker pass 3 then changed only Core copy and its focused assertion; its current build exited 0 and focused Core gate passed 5/5.
- Independent pre-copy combined gate: six files, 94/94, exit 0. Raw log SHA-256 `2d41850d19a6b80ce48281973092317da94f20fd8428d3d86bf5248b9bd7a37f`.
- Independent final proportional gate after the copy correction: `integration-selection-preference-core.test.ts`, 5/5, exit 0. Raw log SHA-256 `fa6e1d6b12825e3423c5f8254a977fff5b9a048161492ab53a76e1ac6baf5c7e`.

The counts overlap and are not additive. The first maker attempt's wrapper/redirection failure and 92/94 fixture failures remain preserved. Pass 2 corrected only the observation timing and unrelated sealed change-target reopen fixture; pass 3 removed the visible digest. No provider, model, native, Electron, or network call was made.
