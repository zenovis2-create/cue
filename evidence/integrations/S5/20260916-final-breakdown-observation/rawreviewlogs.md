# Independent review raw logs

## Preimage verification

```text
decoded daemon\src\evaluation\observations.ts bytes=13794 sha256=0c0fc97a29dd7eae4eacd2da9f85c554c2c7b6b1dd6e63a5ab68aee0a194d588 match=True
decoded daemon\test\integration-evaluation-observations.test.ts bytes=8489 sha256=468f2a4c06eae49b2d2b5ac3bf52eea2bc1fbfd67046e017c5bda6f713c8ea57 match=True
```

## Combined corrected gate

Command:

```text
npx --no-install vitest run test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result:

```text
Test Files  2 passed (2)
Tests       26 passed (26)
exit code   0
```

The run included positive final classified accounting, retry inventory, verification class totals, missing/estimated inventory, revised/unclassified lineage, forged arithmetic, noncanonical/overflow decimals, fabricated handoff, non-final classes, forged final totals, receipt mutation, immutable replay, historical cutoff, reopen/hash/chain, oversized payload, arbitrary outcome, and SQL mutation cases.

## TypeScript gate

```text
npx --no-install tsc --noEmit
exit code 0
```

## Final cohort assertion gate

Command:

```text
npx --no-install vitest run test/integration-evaluation-observations.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result:

```text
Test Files  1 passed (1)
Tests       13 passed (13)
exit code   0
```

The positive test asserts the exact final breakdown returned by `readRunOutcome`, by `observe`, and by `coverage` at cutoff `final-cost`.

## Final hashes

```text
daemon/src/evaluation/observations.ts bytes=15940 sha256=90b840b1078864b0e42ec44c637c64175ce5aebbf2edac1b22300544f559fcc7
daemon/test/integration-evaluation-observations.test.ts sha256=06c56d5899bbc3127c4be461b5327288ec48f6f571a3f3092c43e6f69ff387fc
```

## Final phase and cutoff correction review

Command:

```text
npx vitest run test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result:

```text
Test Files  2 passed (2)
Tests       29 passed (29)
exit code   0
```

The final gate includes immutable phase classification, redistribution refusal, omitted newer-at-cutoff receipt refusal, and later-than-cutoff preservation.

```text
npx tsc -p tsconfig.json --noEmit
exit code 0

daemon/src/evaluation/observations.ts sha256=e0e2ce7abeed14641267cc767023e611dc7b5814fa5aff201724d6a63833b0aa
daemon/test/integration-evaluation-observations.test.ts sha256=70d3d7e17a7e1a7e149a7f6de17515b23eac1e20b0633818ce3df5bde280bae8
```
