# Independent acceptance integration review

2026-09-11 · Reviewer `/root/contracts_review` · **PASS for the source-bound connected acceptance component**. Maker/checker separation: driver maker `reuse_pure`, historical reader maker `transport_review`, observation maker `admission_impl`; reviewer made no production edits.

Completion gate: connected focused tests and daemon build, source review of acceptance/cancellation/history/observation, current hashes, and resolution of concrete findings. Review correction cap: two bounded findings; historical lineage and driver snapshot consistency resolved by their respective makers. No broad baseline, native model boundary probe, live model request, or provider qualification was performed.

## Independent verification

From `daemon`, `npx --no-install vitest run test/integration-driver.test.ts test/integration-driver-core.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-observation.test.ts test/integration-observation-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, **39 tests across 6 files passed** at 16:53:51. `npm run build`: exit 0.

The reviewer then identified that driver `snapshot()` used the verifier's receipt-only `read()`, whereas UI history checked referenced evaluation/blob/stage integrity. That could produce contradictory verified/unverified observations after evidence corruption. The maker switched the driver to `readAcceptanceHistory(...).receipt`, catches integrity failure as unverified, and added a raw-evidence-corruption regression.

After that final driver/test change, independent `npx --no-install vitest run test/integration-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, **14 tests passed** at 16:56:05. Final `npm run build`: exit 0. The reader/UI source hashes remained unchanged. These are explicitly two test passes; no single final 40-test run or broad-project pass is claimed.

## Reviewed behavior

- Immutable criteria are bound before approval. Optional registered acceptance checker descriptors are projected to data fields; executable callbacks remain host-owned. Missing host/criteria and model self-report cannot produce accepted completion.
- The driver reaches acceptance only after clean completed stages. Per-run abort propagates through collection; cancellation/close guards prevent late evidence from finalizing. Timeout is bounded, replay does not relaunch completed stages, and final billing remains unknown/reserved independently of accepted work.
- Acceptance finalization requires an owned evaluation, registered checker availability, independent actual principals, current manifest, clean lineage, and temporary writer exclusion. It atomically stores the receipt and marks the root task completed; later callbacks cannot bypass cancellation or changed lineage.
- Historical reads are callback-free observations. They verify stored evaluation/receipt hashes, raw evidence bytes, immutable criteria, full attempt/step/stage lineage, observation stage/envelope links, principal consistency, source references, and observation timestamps. A pass evaluation without a final receipt stays unverified. Early unavailable-manifest/context records remain unknown. Historical reads never grant fresh execution authority.
- The reader's initially missing stage-lineage checks were raised during review and added before stable tests. Real SQLite tests cover collected pass versus finalized receipt, latest fail/unknown, corrupt bytes/receipt/evaluation, changed attempt lineage, immutable privacy projection, and the actual UI DTO.
- Driver and UI now use the same historical-integrity reader for acceptance observation. DTOs omit raw bytes, source references, paths, and detailed failure reasons. Renderer uses text nodes, preserves literal hostile IDs, separates pass/fail/unknown from final acceptance, and explicitly says the stored verdict is not a fresh inspection of current files.
- Migration 014 is included in ledger initialization and build asset copying. Existing core missing-capability denial still prevents fallback launches.

## Final source snapshot

| Path | SHA-256 |
| --- | --- |
| app/orchestration-driver.mjs | 991FFE85A139C9FCA0BAA8A73AB68E4A684AC899FDBAB37B954517C6358D152C |
| app/orchestration-driver.d.mts | 58943E1FE202960712FF3AACE125B5C3112B0AA933E1158D63D27A6B509EB8C9 |
| daemon/src/verification/acceptance.ts | 540E4474E1BF11C149238AF936F8453F8E51B6FD21C4486E011D6F87429956E7 |
| daemon/src/ui/orchestration.ts | 10326E4D6F43D66BD6899AE87B508C6246FDD2CC374D4DF647E3757F26FB42D8 |
| daemon/src/ledger.ts | 0F7BF27C45AD908756D915E3EA1028B8B6C9782B4F8B21B65886BD97D531E024 |
| daemon/scripts/copy-assets.mjs | A82590BE194C98782301A5856AB77BB987030A88B3AD98D4B75CD8782D4F0DB0 |
| daemon/migrations/014_requirement_acceptance.sql | F56756AF3B0480421F44042A6759B6E2792A0D93E3C3BF87B0741083A1DDAF7D |
| app/renderer/index.html | FF00544593DB1977E501D95978971292ECDC369B5B19B9992CA2C56236A05507 |
| app/renderer/renderer.js | B47A98C553C5B30A4A911BC2AC60D516E8A4F3CE629C51605400692FEB889029 |
| daemon/test/integration-driver.test.ts | C082FCF3E7DE3F22CD21E77FA7A4FF6EBEF4ACC83AA43D282A1381251D452755 |
| daemon/test/integration-acceptance-history.test.ts | 14C7E880B4DDEC1FB5D53ADFE207E07E52DCEF9ACC4540E29F9189AF93817AAD |
| daemon/test/integration-observation.test.ts | 7909E51ED9817D35775B24C38A54307D5C1EDD1FBBABB1BD7721F1446BC02EC7 |

## Limits

Tests use real local SQLite and DOM execution with synthetic trusted host observations/adapters. They do not establish real checker semantic accuracy, actual independent human/account identity, model/provider permissions, paid billing termination, or a qualified default host. Stored digests detect corruption and inconsistent lineage; they are not cryptographic authentication against an attacker able to rewrite the entire trusted database and all evidence. Acceptance history deliberately does not re-run live checkers or inspect current artifact contents. No independent Electron screenshot session was performed in this review; parent-owned visual QA is separate. Whole-project/S0–S7 completion and model M/P eligibility remain outside this PASS.
