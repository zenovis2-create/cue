# Independent S5-07 original-contract audit

## Verdict

PASS for the exact original checkbox: `개선 미확인 정책을 승격하지 않고 이전 정책으로 복구할 수 있다.`

This is a bounded offline transition-safety closure. Actual four-mode improvement proof, a real empirical qualification producer, provider/billing truth, and production rollout remain open under S5-05 and the live evaluation work.

## Contract basis

`docs/INTEGRATION_SPEC.md:227` defines the monetary deployment channel as a state-management contract: promotion binds a host-provided canonical qualification to the current and candidate policies, separated evaluation/holdout evidence, and measurements; history retains the prior policy; replay verifies stored qualification; revert targets only the active promotion's predecessor; future runs read the active head while bound runs retain their policy. The same paragraph says descriptive comparisons cannot be promoted and no measured improvement is declared without an actual qualifier.

The broader completion paragraph at line 267 separately requires actual frozen cohorts, holdout comparisons, four-mode objectives, sample/variance/price evidence, and demonstrated improvement. Those empirical requirements remain S5-05 and related live work; they are not silently treated as satisfied here.

The earlier `20260915-policy-deployment/review.md` correctly refused broad S5-07 closure because it bundled the transition mechanism with a missing real qualifier. Against the exact original checkbox, the already implemented refusal and predecessor-revert behavior is independently sufficient, using the same narrow-contract reasoning applied to A06.

## Source evidence

- `daemon/src/selection/policy-promotion.ts:48-56` canonicalizes plain qualification data, requires the authenticated empirical authority label and `qualified-improvement` verdict, binds disjoint dataset/holdout commitments and evidence digests, rejects future qualification, and verifies the canonical digest.
- Lines 84 and 87 reconstruct the append-only chain, reject generation above 10,000 before traversal, reject descriptive/malformed authority, require at least one favorable measured dimension, and revalidate the current head inside the write transaction before CAS promotion.
- Line 88 permits revert only when the named promotion is the current latest transition and restores that promotion's exact saved predecessor.
- Line 94 keeps a bound run's immutable policy only when the policy appears in the verified channel history; future unbound runs receive the current head.

The permanent tests reject descriptive, malformed, overlapping, future, regressed, wrong-mode, and wrong-currency qualifications without writes; cover resolver-side head races, exact replay, tamper/reopen, transaction rollback, exact predecessor revert, future-run activation, and existing-run retention.

Existing independent hostile evidence at `../20260915-policy-deployment/independent-hostile-additions.ts.txt` preserves two additional cases: generation 10,001 fails with `chain-limit`, and mutation of the raw authority object by a later trusted-clock callback cannot rewrite the canonical qualification already captured for persistence. Its pass-2 log records 8/8.

## Independent gate

`npx --no-install vitest run test/integration-policy-promotion.test.ts test/integration-generated-json-policy-deployment.test.ts test/integration-generated-json-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0, 3 files and 26 tests passed. The durable transcript summary is `gate.log`.

## Pins and limits

- `daemon/src/selection/policy-promotion.ts`: `45EA588866BAC0823DF02F0F4192F66DF813824C832BE234CD234FEA8A596810`
- `daemon/test/integration-policy-promotion.test.ts`: `8CC636D85F97A17249A4E87EF8BF8F99EB1891DA944C006E45D2DD9F19AE5BB6`
- `daemon/test/integration-generated-json-policy-deployment.test.ts`: `AD32475E1319FA872D1AE7C00E52CC92B8228DAD711C80875BB7C01F8E89B25C`

All positive qualification authority in these fixtures is explicitly synthetic. This review does not grant promotion eligibility to the current descriptive comparison, assert empirical improvement, or qualify a provider, account, billing source, or production deployment.
