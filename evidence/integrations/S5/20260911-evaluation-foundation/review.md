# Independent review: evaluation comparison foundation

Reviewer `/root/broker_review`, 2026-09-11. Product code read-only. Initial status: **cost-unit correctness correction requested**. No actual performance, model call or policy promotion is claimed.

Initial source identities:

- `daemon/src/evaluation/comparison.ts`: `EE7C28A28B1C50508A56BE9A719AECA13DB8BAA1912664EEB00F4F4FEA81513F`
- `daemon/test/integration-evaluation.test.ts`: `002A6F93E3243F0FC106CC012F5D8DEBEA4E21D29B739DA640A8B768683D8944`

## Initial independent checks

- `npx --no-install vitest run test/integration-evaluation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, **10 passed**, 234 ms, start 19:12:55 local time.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Tests cover dataset ordering/overlap, append-only replay, cost components, paired mean/sample variance, failed/cancelled/unknown denominators, missing holdout pairs, sample floors, expensive retries/handoffs, all four objectives and quality/budget constraints, provenance/price/environment mismatches and unsafe data rejection.

## Cost-unit finding

`summary()` initially reported a numeric sum and mean/variance even when an individual arm/split mixed currencies or units. An independent source-level probe supplied USD 10 and EUR 10 in each split under a speed-only comparison. It returned `{"status":"observed-improvement","currency":null,"total":"20","cost":{"n":2,"mean":10,"sampleVariance":0},"promotion":false}`. The speed conclusion is allowed to ignore costs; the mixed-currency monetary aggregates are not meaningful.

The same compatibility condition must prevent a cost-dependent paired improvement from subtracting incomparable monetary units, even if its status already says insufficient. Requested correction: report null monetary sum/statistics unless currency **and** unit are uniform; report no cost-dependent paired numeric difference for incompatible units. Preserve speed-only paired time improvements and retain the visible currency/unit uncertainty. The maker was asked for within-arm mixed-currency and mixed-unit regression coverage.

## Other assessed contracts

- All reports remain descriptive, with `promotionEligible: false`, `statisticalQualification: not-performed` and explicit floating-point precision. Fixture/observed labels are recorded provenance, not proof that measurements happened.
- Dataset construction requires both evaluation and holdout sets, rejects duplicate case IDs and exact input digests, snapshots plain data and binds a stable sorted manifest digest. The private construction marker rejects a structurally copied dataset as authority.
- Each case/arm/policy has one immutable trial slot. Replays with changed contents or a replacement trial ID are rejected, so failures cannot silently be replaced by a later success in this study. Retry, handoff and verification costs remain in the total.
- Fail, cancelled and unknown outcomes remain in trial counts and success denominators; their quality contribution is explicitly zero. Missing successful quality, required time/cost, future trials, stale/unverified prices, mixed source labels, conflicting policy revisions or unmatched per-case environment/account-limit digests prevent a comparable improvement status.
- Both splits must have complete paired coverage, sufficient samples and required quality/success/unknown/budget floors. Quality regression blocks the non-performance modes. Performance mode requires an explicit per-trial monetary cap; speed-only comparisons may retain unknown costs but do not claim cost efficiency.

## Scope limits

This is an in-memory record/comparison unit, not a durable benchmark runner, rollout manager, holdout secrecy system, statistical significance test or automatic promotion path. It cannot detect semantically equivalent inputs with different supplied digests, verify that a caller measured its claimed revisions, or prevent a human from tuning against a visible holdout. Source records preserve provenance fields; digests and `source: observed` do not confer real-world truth. No full S5 completion or actual model superiority follows from these fixture tests.

Final correction evidence follows when available.

## Final correction and independent review result

**PASS for the corrected descriptive evaluation foundation.** The maker now requires one currency/unit pair and known totals before emitting an arm's monetary sum or statistics. Cost-required comparisons with incompatible units emit `pairedImprovement: null`. Pure speed comparisons without a budget retain their valid time difference while mixed monetary aggregates remain null. No promotion or statistical-qualification path was added.

Final source hashes:

- `daemon/src/evaluation/comparison.ts`: `94A952572E584B61EEE69F72D585C90FAD0C21284F80D5F72BA17326FBD54342`
- `daemon/test/integration-evaluation.test.ts`: `91EDA0856A86ECA3FB1EDBD5D41488157AA9A8ECBB6500ADBF52EEB8B1ED975E`

Independent final checks:

- Same focused Vitest command above: exit 0, **12 passed**, 186 ms, start 19:18:08 local time.
- Added currency and unit cases each exercise mixed values **within** the candidate arm in both splits, require null monetary aggregates and unchanged valid baseline totals, and preserve speed-only paired time statistics. They then test all four modes with a cost requirement, require `incompatible-cost-units`, insufficient status and null paired improvement.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.

The initial finding and its reproduction remain above. Final evidence proves the bounded comparison logic and its corrected monetary presentation, not actual tool/model performance or S5 end-to-end operation. `promotionEligible` remains unconditionally false and the stated in-memory/statistical/holdout limits remain unchanged.
