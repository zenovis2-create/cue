# Independent review: policy deployment state mechanics

Date: 2026-09-15
Result: PASS for the bounded offline deployment mechanism. Broad S5-07 remains open because no real empirical qualifier produces an eligible comparison.

## Findings

- Migration 044 provides an immutable canonical qualification row, append-only transition chain, and compare-and-swap deployment head. Startup requires the exact marker, four tables, and nine guards.
- Qualification input is copied from exact descriptor-safe plain data and bound to an authenticated-authority label, baseline and candidate policy identities, disjoint dataset/holdout IDs, digests and case commitments, measured-fact digest lists, metric/environment/account-limit evidence, price/time and trial evidence, timestamp, verdict, and canonical digest. Descriptive comparison snapshots cannot qualify.
- Promotion verifies a real saved candidate policy with the same mode and currency, requires at least one favorable measured dimension, snapshots authority output before the later trusted clock callback, and rereads the deployment head inside the write transaction. A resolver-side winning promotion makes the loser write nothing.
- Reopen reconstructs and validates every transition back to the initialize record, including qualification lineage. Generation is capped at 10,000 before traversal. The independent hostile case proved generation 10,001 fails with `chain-limit`.
- Revert is limited to the current latest promotion and its exact saved predecessor. Future runs resolve the current head, while an existing run keeps its immutable saved policy only when that identity appears in the verified channel history.
- The generated JSON monetary host consumes this deployment channel. Existing local host and local template behavior remain separate and unchanged.

## Independent gates

- Build: exit 0; raw output and exit are in `independent-build.log` and `independent-build.exit.txt`.
- Combined regression: exit 0; 14 files and 171 tests passed in 48.95 s. It includes the prior account/driver/Core/handoff/evaluation ten-suite gate, policy promotion, generated policy deployment, generated local host, and JSON template Core.
- Hostile pass 2: exit 0; 8/8 passed. Six cases repeat the frozen base policy fixture; the two unique cases prove the 10,001 chain bound and that a trusted clock callback mutating the raw authority object after canonical capture cannot rewrite the persisted qualification. Exact additions and the base hash are retained in `independent-hostile-additions.ts.txt`; the temporary test was deleted.
- Compiled migration smoke: exit 0 with four exact tables, nine exact triggers, successful reopen, partial-schema refusal, missing-guard refusal, tracked handles closed, and owned temporary directory removed. Root supplied the corrected bounded harness under `registration/`; this reviewer inspected its script, output, and exit.

The first hostile run is preserved: it expected the wrong error prefix and armed mutation before authority resolution, which correctly caused digest refusal. Two reviewer migration harness attempts are also preserved; one let Windows cleanup mask the result, and the second used an overbroad trigger-name query that counted unrelated older triggers. The corrected registration smoke changes both hypotheses and is the migration evidence used for this verdict.

No provider, credential store, model, native helper, network, Electron, billing, or live evaluation was invoked.

## Reviewed pins

- `daemon/src/selection/policy-promotion.ts` — `45ea588866bac0823df02f0f4192f66df813824c832be234cd234fea8a596810`
- `daemon/migrations/044_selection_policy_promotion.sql` — `6983635eb86e63dc22f8960c87caf92b3abe730f6537883aafe61bee0a86d19f`
- `daemon/dist/migrations/044_selection_policy_promotion.sql` — `6983635eb86e63dc22f8960c87caf92b3abe730f6537883aafe61bee0a86d19f`
- `daemon/src/ledger.ts` — `cab67e79e4ac14fd849b2ee273fb0c41590dcdd248653f62623e6b92a9254759`
- `daemon/scripts/copy-assets.mjs` — `d65aa1919f6fc47f550b92db50d7f74bc7765f203b17e86699d244895f36ed34`
- `app/generated-json-host.mjs` — `bf6acec5cfdfb313a4371ab63b39d8aafde8dff319e4382619693192202865fa`
- `app/generated-json-host.d.mts` — `9b0e2ef81f2d94a4c54553b19f5f6a8dabc5267c94efcfb2865eef59133c1cfd`
- `daemon/test/integration-policy-promotion.test.ts` — `8cc636d85f97a17249a4e87ef8bf8f99eb1891da944c006e45d2dd9f19ae5bb6`
- `daemon/test/integration-generated-json-policy-deployment.test.ts` — `ad32475e1319fa872d1ae7c00e52cc92b8228dad711c80875bb7c01f8e89b25c`

## Limitation

All positive qualifications are explicitly synthetic. This mechanism supplies durable authority, refusal, promotion, future-run resolution, and predecessor-revert state transitions, but it does not create the trusted empirical comparison required by S5-05. It therefore does not make the current descriptive comparison promotion-eligible and does not close broad S5-07 or prove a production rollout.
