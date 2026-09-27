# Independent cleanup candidate-ID correction review

Reviewer: broker_review, 2026-09-11. PASS for this bounded compatibility correction. Completion criterion: catalog-contract comparison, candidate-only validator scope, focused persistence/composition gate and exact hashes. No product edits, model calls, historical DB changes or live cleanup assumptions. No reviewer-requested correction was needed.

## Independent gate

From daemon: `npx vitest run test/integration-cleanup-observation-store.test.ts test/integration-generated-json-local-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.

Exit 0, 2 suites / 10 PASS, start 23:30:59 KST, duration 1.06 seconds. Maker's build 0 and original-source RED cleanup_observation_identity are separately recorded in maker.json; reviewer did not restore old source or rerun a build.

## Exact hashes

| File | SHA-256 |
| --- | --- |
| daemon/src/cleanup-observation-store.ts | A1C02CE329B1F13E7D125D9EABDB4452CDDEA3B74FF44865C524D5D7EA1D740A |
| daemon/test/integration-cleanup-observation-store.test.ts | 1DEBCEEDF6DE7F542B1906D4179E2EC145C4FE234D88A97936821962060D3E69 |
| daemon/test/integration-generated-json-local-host.test.ts | 3C10BBAA11F92685AB5423DA67F52AEF3BC6096D7DEB570DC63A6CF6731B28AA |

## Findings

No actionable blocker. The candidate-only validator exactly matches integration-catalog.ts's canonical ID regex: /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/. Run IDs and session handle/task IDs still use the original narrower 1–128-character rule. Canonical serialization, bounds, actual run/session validation, transaction restrictions, immutable reference hashing and historical read validation remain intact.

The observed production candidate cue.local.qwen38-27b-unc contains dots that the previous shared ID regex rejected. That is a concrete persistence incompatibility consistent with the actual workflow's missing cleanup observation/receipt. Accepting catalog-valid candidate IDs corrects that refusal; it does not establish that no other live failure exists.

New store coverage uses the actual exported producer/checker constants, a slash/colon candidate and the 200-character boundary. It verifies persistence/replay/read and rejects invalid prefixes, whitespace, 201 characters, dotted run IDs and dotted session IDs. Existing serialization/accessor, exact session, transaction, corruption and immutability tests also pass.

New host composition uses actual dotted constants, the actual cleanup observer/store and driver. Its checker factory queries SQLite before launching and requires the producer attempt already completed with verified cleanup plus durable receipt. Both final attempts/receipts and verified acceptance are asserted. Native executors/frames and eligibility are explicitly synthetic; actual OS absence checks concern fixture-selected identities/paths. Capability evidence table remains empty. This is a regression for composition/order, not actual native boundary or current live eligibility proof.

The historical failed Electron gate remains failed/running-with-unverified-cleanup in its preserved ledger. Its request allowance remains exhausted. No acceptance, receipt or cleanup result was backfilled; any further actual gate needs separate authorization and a newly frozen installation identity.
