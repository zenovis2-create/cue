# Selected-scope catalog correction plan

## Done

`upstream-source-catalog.json` represents every current selected/adopted/limited component, binds its current local bytes and actual seam, distinguishes reference-only upstream facts from selected external bytes, and preserves every deferred research row and `adoptionAuthorized:false` flag. The catalog parses, all bound paths/hashes match, and the existing focused reuse-manifest suite remains green.

## Attempt cap

Two correction passes. A failed gate requires a new hypothesis; after two failed corrections, stop and hand the exact failure to the root checker.

## Per-pass gate

Parse the catalog; verify all local selected-byte, manifest, evidence, and archive hashes; assert exactly four applicable decisions (`R-04`, `R-05`, `R-06`, `R-08`); assert the three research rows retain identity, commit, incomplete BOM status, and false authorization; run `npx --no-install vitest run test/integration-reuse-manifest.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon`; run scoped `git diff --check`.

No build, provider, executable, local endpoint, installation, or product source operation is in scope.
