# Reuse fixture receipt implementation evidence

Date: 2026-09-12 (Asia/Seoul)

Repository HEAD observed: `8e2afa6366e3af62f7115b2c67be799130f8dfdf`

Scope: implementation evidence for common reuse checklist line 15; the checklist and historical evidence were not edited.

The offline generator/verifier is `scripts/reuse/reuse-fixture-receipts.mjs`. It recomputes canonical pure results, binds current implementation and fixture bytes, validates the hashes embedded in the historical R-01/R-03 loopback receipt, and compares a fresh temporary output directory with the checked-in result/receipt bytes. Its SHA-256 is `c402b8c32c8d8ef99448a75f9443000b919d8a4b4b5ac39babff7e244c8d8160`. The checked-in `receipt.json` SHA-256 is `36818803b0e572bb39fd851db27a08bbda006147830dcd63d73e65298554233e`.

## Exact R fields

`implementation` below is the current source-file SHA-256; `implementation set` is the canonical aggregate recorded in the receipt. All hashes are SHA-256.

| R-ID | Command / exit / duration | Current implementation / set | Canonical input fixture | Result/output | No drift / lifecycle |
|---|---|---|---|---|---|
| R-01 | `node --test scripts/reuse/model-transport.test.mjs`; `0`; `301.5959 ms` | `model-transport.mjs` `77d5835fee99a96baf87017d5efae99458d3b702e060453e9ecb62bb2cd42a28`; set `e1ff9179434831dad3229bec93532e837e756644122bb2708c3e8357aae624a3` | historical inline fixture/test `b5014c3b2e3581cef3019486be3837eb567b88e5b9139ef445d1ec795b06c9bf` | historical `RESULT.md` bytes `72c1332387336e1c242790e9950b15a73c97635b0667a1e5470a9947f5b37279` | `true`; historical loopback bytes revalidated, loopback/network not rerun |
| R-02 | `node --test scripts/reuse/role-contract.test.mjs scripts/reuse/claude-launch-spec.test.mjs`; `0`; `101.2588 ms` | `claude-launch-spec.mjs` `57a07d016be906f01cf2ae1d188a936cb36a036d385df9d0ec67e86f66b4fd17`; set `57b44f427f978d8ef5518295bb160eef5ea4380877a8264d2038e086963b409c` | `R-02-input.json` `28ed8cbc0295f22ddad63afe240ce63aa2bfb0911b9e091396b13e8b548481d4` | `R-02-result.json` `21519177646e252f9664b9b5ffe29bce73a8e31771e818a10771de65c5e779d8` | `true`; N/A, synchronous offline pure builder/transcript validator |
| R-03 | `node --test scripts/reuse/model-transport.test.mjs`; `0`; `301.5959 ms` | `model-transport.mjs` `77d5835fee99a96baf87017d5efae99458d3b702e060453e9ecb62bb2cd42a28`; set `e1ff9179434831dad3229bec93532e837e756644122bb2708c3e8357aae624a3` | shared historical inline fixture/test `b5014c3b2e3581cef3019486be3837eb567b88e5b9139ef445d1ec795b06c9bf` | shared historical `RESULT.md` bytes `72c1332387336e1c242790e9950b15a73c97635b0667a1e5470a9947f5b37279` | `true`; historical loopback bytes revalidated, loopback/network not rerun |
| R-04 | `node --test scripts/reuse/role-contract.test.mjs`; `0`; `90.164 ms` | `role-contract.mjs` `e87000f81d394bbe1c766af199778df2b85062e6a9b26a27b6bc6fc13653948b`; set `e5e9bc0ccd42d650cb95ad611d593f22f503fd92fce1a497209fa2803b8e8b9a` | `R-04-input.json` `1cf248c7f675912b9c1073215f2b3822b12e1339b5d6800cdd69876dd1813138` | normalized `R-04-result.json` `a303f5d15c8830b860db9bdd922d473384a5003587f32e08dbb69d1ca9f703d4` | `true`; N/A, synchronous pure role parser/serializer |
| R-05 | `node --test scripts/reuse/usage-normalization.test.mjs`; `0`; `89.3291 ms` | `usage-normalization.mjs` `2d5eb58c2d1d85a9bdeaf5b00840a780faaaaefd1585d9c5bce4668517f375fc`; set `496e0f13bbf684dbcf0043ae25a9264d0f54885066c5e3391124871533e91fb6` | `R-05-input.json` `d64c28443c88063248922fea99541ceeaf959e265c49cde26f1567be8423209f` | normalized `R-05-result.json` `435e579ff5aff8e16280c931c134474aa5d64e220b65b440303f209a6ec24878` | `true`; N/A, synchronous pure usage normalizer |
| R-06 | `node scripts/reuse/reuse-fixture-receipts.mjs --probe-r06`; `0`; `166.7372 ms` | role `e87000f81d394bbe1c766af199778df2b85062e6a9b26a27b6bc6fc13653948b`, usage `2d5eb58c2d1d85a9bdeaf5b00840a780faaaaefd1585d9c5bce4668517f375fc`; set `9d01b8129699d908fea98820ceda7b1545cd7b6d7610122c9c72249fe2cd8549` | validator-only `R-06-input.json` `7726f83579890827d11c600278b3099e3de178493979fb7f42156ba7ea244e4e` | exact-guard `R-06-result.json` `8f4cb45f7836ed561ff73189038adf62bd6723ef064941f84325d9f0497987c3` | `true`; N/A, synchronous pure validator-boundary cases |

R-06 independently records one accepted exact role object and four rejected boundary inputs: top-level privilege field, nested model extra field, negative usage counter, and array usage record. It does not reuse R-04's result as its validator evidence.

## Verification

Pass 1: the four related suites plus receipt tests passed 25/25, exit 0, duration 119.6642 ms. The CLI verifier independently regenerated all four result artifacts and the receipt in a fresh OS temporary directory and reported byte-for-byte equality. `git diff --check` exited 0. Inspection then added a direct negative regression proving that an altered bound fixture hash makes verification fail; this improved the stated drift gate without changing product code.

Pass 2 after that regression passed 26/26, exit 0, duration 147.3502 ms; fresh temporary receipt verification also passed byte-for-byte. The auxiliary strict whitespace scan then reported the two intentional Markdown hard-break spaces formerly on this document's date/HEAD lines. New hypothesis: the report was a documentation-format false positive rather than source, fixture, result, or receipt drift. Those spaces were removed before rerunning the targeted whitespace/hash checks. A separate comparison found `docs/INTEGRATION_CHECKLIST.md` had changed from the planning audit's snapshot hash while this work was in progress; because it is outside this task's ownership, no rollback or edit was made.

The implementation and tests import only Node filesystem/path/crypto/test primitives and the existing pure reuse modules. No external service, network or loopback request, real CLI, model, native helper, Electron, package install, or download ran. Product authority/runtime files and `docs/INTEGRATION_CHECKLIST.md` were untouched by this task. This evidence does not decide or check line 15; an independent reviewer must judge sufficiency.
