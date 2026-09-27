# Independent review raw logs

Review date: 2026-09-16 (Asia/Seoul)

## Frozen byte verification

The working files matched the separately preserved `final-bytes` files by filesystem SHA-256. Git normalization was not used for this check.

```text
scripts/reuse/reuse-manifest.mjs
work/final 6833DCE115012359128BCCEBED39716BEAA8AF402D55C092FC7F57984EDEF6A9
preimage   165DBB84732ED0AB27D839A5DD0B38A53FABC616D306DC19FD6FAC272DA8061C

scripts/reuse/reuse-fixture-receipts.mjs
work/final C74F35DD7952F7B29BFBADA95F3F125E9217892B1D3A0B4E9218D2DA659AB49D
preimage   C402B8C32C8D8EF99448A75F9443000B919D8A4B4B5AC39BABBF7E244C8D8160

scripts/reuse/reuse-fixture-receipts.test.mjs
work/final 75562E58BDB619B93EA30A21E2B5637CA1F389179B0E24CF512AF3E110521BC1
preimage   DFB1AA774A0EAAB4CEE519C5A4555C2BEF1DA1744A984B8352B67AF905B3FB8C

daemon/test/integration-reuse-manifest.test.ts
work/final E5D1A75F9DE82502951714BBB53667C481F48513A9403212C45CA1B016E8C527
preimage   549BDE1366CFA77BB29C291F66B884EC7A08E01CC672FC98E517CD4497DE8798
```

## Focused tests rerun from actual source files

Command: `node --test scripts/reuse/reuse-fixture-receipts.test.mjs`

```text
exit 0
4 tests, 4 pass, 0 fail
duration_ms 176.5993
```

Command from `daemon/`: `npm exec -- vitest run test/integration-reuse-manifest.test.ts`

```text
exit 0
Test Files 1 passed (1)
Tests 8 passed (8)
Duration 244ms
```

The Vitest file exercises the old hostile descriptor, proxy, symbol, cycle, size, local path, traversal, nonregular-file, and junction contracts. All remained green.

## Adversarial fallback probe

Command:

```text
node --input-type=module -e "import {evaluateReuseEvidence} from './scripts/reuse/reuse-manifest.mjs'; const b={revision:'sha256:'+ 'a'.repeat(64),manifestDigest:'b'.repeat(64),receiptSha256:'c'.repeat(64)}; console.log(JSON.stringify(evaluateReuseEvidence({version:'cue-reuse-evidence-lifecycle-v1',current:{revision:'sha256:'+ '1'.repeat(64),manifestDigest:'2'.repeat(64),receiptSha256:'3'.repeat(64)},observed:null,fallback:{pinned:true,binding:b,observed:b}})))"
```

Observed:

```json
{"reusable":true,"action":"use-pinned-fallback","revision":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bindingDigest":"d941d8b15631a0562fe14a9ddb1cca1bea46958b09a27cb69d718d28956d16ae","invalidation":"missing-receipt"}
```

## Consumer binding probe

For the checked-in receipt, `receiptBinding()` produces:

```json
{"receiptSha":"8c38a733a5a924d44dd89d1cae2000bcb78726cf6b9a8774e3370bfcb1fbfc0e","revision":"sha256:8c38a733a5a924d44dd89d1cae2000bcb78726cf6b9a8774e3370bfcb1fbfc0e","manifestDigest":"b1b08146e3416e44a93e05b4eac92b849e2d5f1fb176a924303560125e81443b"}
```

The revision repeats the receipt digest. The manifest digest is SHA-256 of the literal `cue-selected-reuse-fixtures:R-04,R-05,R-06:v1`; no selected manifest file is read. The manifest directory contains R-01, R-02, R-04, and R-06 only; it has no R-05 manifest.
