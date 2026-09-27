# Independent checker log

Source freeze: `docs/reuse-decisions/upstream-source-catalog.json` SHA-256 `51d3edea28e779dd6e34a13b1b29ac33e3677e89e1e3d2166b0ee64da015149f` (maker-declared 16,360 bytes; independently recomputed hash matches).

## Byte and scope validation

The corrected PowerShell catalog/archive validator exited 0 and reported:

```text
catalogHash                : 51d3edea28e779dd6e34a13b1b29ac33e3677e89e1e3d2166b0ee64da015149f
applicableCoverage         : R-04,R-05,R-06,R-08
archiveFiles               : 5
archiveHash                : 4ebb9f9f3a35f61dcc74f3215e94b4b157d462a90eeade018137b90c73171263
retrievalManifestHash      : c299dbeca5bdc73cb10e81c042ce50358f299088388a6e3da8d65ee3ebdf0b5e
nonFalseAuthorizationCount : 0
failures                   : 0
```

The validator recomputed every `selectedBytes`, `cueProductBytes`, `manifest`, and `decision` local SHA-256 in all four applicable selections. It decoded all five preserved Archify base64 files and checked both decoded byte length and SHA-256. The first validator invocation failed before doing work because of a PowerShell interpolated-variable parser error; the corrected command changed only the string interpolation syntax and is the result above.

The two top-level evidence pins also match current bytes:

```text
retrieved-hashes.json     18c0ad52cd1b469aeb3b9297860969247e8b1ebd67f7728c857e17d2636555b3
retrieval-manifest.json   c299dbeca5bdc73cb10e81c042ce50358f299088388a6e3da8d65ee3ebdf0b5e
```

`rg -n "role-contract|usage-normalization" app daemon -g '!node_modules/**'` exited 1 with no matches. This supports the catalog's fixture/tool-only claim. Inspection of `app/core.mjs` found the stated imports of compiled Cue report IR, HTML, and delivery modules.

## Focused tests

From `daemon`:

```text
npx --no-install vitest run test/integration-reuse-manifest.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
Test Files  1 passed (1)
Tests       7 passed (7)
exit 0
```

From the repository root:

```text
node --test scripts/reuse/role-contract.test.mjs scripts/reuse/usage-normalization.test.mjs scripts/reuse/reuse-fixture-receipts.test.mjs
tests 17; pass 17; fail 0; exit 0
```

No product build, OS/native helper, provider/model call, network operation, or localhost service was used.
