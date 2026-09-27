# Independent review — reuse fixture receipts

Reviewer: `/root/sol_reuse_fixture_review`

Review date: 2026-09-12 (Asia/Seoul)

Scope: read-only review of the R-01–R-06 receipt system. This file is the reviewer's only repository write.

## Verdict

**PASS — common checklist line 15 can be checked for R-01 through R-06. No blocker found.** Each R-ID has a recorded command, exit code, positive duration, current implementation-file hashes and aggregate implementation-set SHA-256, canonical input SHA-256, result/output SHA-256, and `noDrift: true`. Independent recomputation matched every recorded source, set, input, and result hash.

This verdict is limited to the exact line 15 requirement, “분리된 fixture 실험의 명령/exit code·입력/결과 hash를 기록한다.” It does not qualify an external candidate, prove product integration, close lifecycle/common gates 13–14 or 16–22, or replace actual CLI/model/native/Electron validation.

## Per-entry verification

All hashes below are SHA-256 and matched the current bytes independently of the generator.

| R-ID | Recorded command / exit / duration | Implementation set | Canonical input | Result/output | No drift |
|---|---|---|---|---|---|
| R-01 | `node --test scripts/reuse/model-transport.test.mjs`; `0`; `301.5959 ms` | `e1ff9179434831dad3229bec93532e837e756644122bb2708c3e8357aae624a3` | `b5014c3b2e3581cef3019486be3837eb567b88e5b9139ef445d1ec795b06c9bf` | `72c1332387336e1c242790e9950b15a73c97635b0667a1e5470a9947f5b37279` | `true` |
| R-02 | `node --test scripts/reuse/role-contract.test.mjs scripts/reuse/claude-launch-spec.test.mjs`; `0`; `101.2588 ms` | `57b44f427f978d8ef5518295bb160eef5ea4380877a8264d2038e086963b409c` | `28ed8cbc0295f22ddad63afe240ce63aa2bfb0911b9e091396b13e8b548481d4` | `21519177646e252f9664b9b5ffe29bce73a8e31771e818a10771de65c5e779d8` | `true` |
| R-03 | `node --test scripts/reuse/model-transport.test.mjs`; `0`; `301.5959 ms` | `e1ff9179434831dad3229bec93532e837e756644122bb2708c3e8357aae624a3` | `b5014c3b2e3581cef3019486be3837eb567b88e5b9139ef445d1ec795b06c9bf` | `72c1332387336e1c242790e9950b15a73c97635b0667a1e5470a9947f5b37279` | `true` |
| R-04 | `node --test scripts/reuse/role-contract.test.mjs`; `0`; `90.164 ms` | `e5e9bc0ccd42d650cb95ad611d593f22f503fd92fce1a497209fa2803b8e8b9a` | `1cf248c7f675912b9c1073215f2b3822b12e1339b5d6800cdd69876dd1813138` | `a303f5d15c8830b860db9bdd922d473384a5003587f32e08dbb69d1ca9f703d4` | `true` |
| R-05 | `node --test scripts/reuse/usage-normalization.test.mjs`; `0`; `89.3291 ms` | `496e0f13bbf684dbcf0043ae25a9264d0f54885066c5e3391124871533e91fb6` | `d64c28443c88063248922fea99541ceeaf959e265c49cde26f1567be8423209f` | `435e579ff5aff8e16280c931c134474aa5d64e220b65b440303f209a6ec24878` | `true` |
| R-06 | `node scripts/reuse/reuse-fixture-receipts.mjs --probe-r06`; `0`; `166.7372 ms` | `9d01b8129699d908fea98820ceda7b1545cd7b6d7610122c9c72249fe2cd8549` | `7726f83579890827d11c600278b3099e3de178493979fb7f42156ba7ea244e4e` | `8f4cb45f7836ed561ff73189038adf62bd6723ef064941f84325d9f0497987c3` | `true` |

R-01 and R-03 intentionally reference the same historical loopback experiment. The historical `RESULT.md` bytes hash to `72c1332387336e1c242790e9950b15a73c97635b0667a1e5470a9947f5b37279`, matching both receipt entries and both `historicalReceipt` objects. Its embedded adapter hash `77d5835fee99a96baf87017d5efae99458d3b702e060453e9ecb62bb2cd42a28` matches the current `model-transport.mjs`; its embedded test/inline-fixture hash `b5014c3b2e3581cef3019486be3837eb567b88e5b9139ef445d1ec795b06c9bf` matches the current `model-transport.test.mjs`. The reviewer did not execute that loopback test.

The input/result fields are not substituted source/test fingerprints. R-02, R-04, R-05, and R-06 bind separate canonical `R-*-input.json` files and separate normalized `R-*-result.json` files. Their implementation source files are recorded in a different object and aggregate to a separately recomputed set hash. R-01/R-03 use `model-transport.test.mjs` only because the historical fixture is defined inline in that test, as stated by the historical receipt and the done contract; their result is the immutable historical `RESULT.md` byte stream.

## Determinism, R-06 boundary, and drift rejection

In a reviewer-created OS temporary directory, fresh generation of `R-02-result.json`, `R-04-result.json`, `R-05-result.json`, `R-06-result.json`, and `receipt.json` was byte-for-byte equal to every checked-in expected file. The standalone verifier also exited 0 and printed `reuse fixture receipts: verified byte-for-byte`.

The recorded R-06 probe command independently exited 0 and its normalized stdout was exactly equal to `R-06-result.json`. R-06 is a dedicated validator boundary rather than reused R-04 evidence: its own fixture/result contains one accepted exact role object plus four rejected cases for a top-level privilege field, a nested model extra field, a negative usage counter, and an array usage record. The expected rejection messages also matched exactly.

Two independent temporary tamper probes were rejected with exit 1:

1. Appending one byte to `R-04-result.json` caused expected-result drift.
2. Replacing R-02's bound canonical input hash in `receipt.json` with zeroes caused receipt drift.

The included negative regression performs the same class of altered-fixture-hash check. Although `noDrift: true` is emitted by the generator, the fresh-byte comparison and negative tamper results provide the operative evidence for that field.

## Reproduction and prohibited-operation check

The reviewer ran:

```text
node --test scripts/reuse/claude-launch-spec.test.mjs scripts/reuse/role-contract.test.mjs scripts/reuse/usage-normalization.test.mjs scripts/reuse/reuse-fixture-receipts.test.mjs
```

Result: **26 tests, 26 pass, 0 fail, exit 0**, runner duration `126.6325 ms`.

The reviewer then ran fresh `--write` generation in a reviewer-owned OS temp directory and `--verify` against the checked-in directory; all five artifacts were byte-equal and verification exited 0. Static inspection found that the generator, its receipt test, and the imported R-02/R-04/R-05 pure modules do not import HTTP, network, child-process, or Electron primitives and do not call `fetch`, `spawn`, or `exec`. No external/network/loopback request, real Claude or other CLI, model, native helper, Electron, install, or download operation was run. In particular, `model-transport.test.mjs` was read and hashed but not executed.

Targeted `git diff --check` exited 0. A strict trailing-whitespace scan over the generator, receipt test, four inputs, four results, receipt, done contract, and implementation evidence found no match. JSON inputs, results, and receipt parsed successfully during generation and independent hash verification.

## Checklist snapshot and exact limits

The planning audit recorded checklist SHA-256 `95a30a55bd97f4156938734c88d7a38aac61e865315ff79f14cfb730c8c1d1b4`; the review observed current SHA-256 `a7ade3f2be6e0dbb87663b6d471f48b5f96bdd383d39f25b2d21f745d91e6aa0`. This whole-document change is outside the receipt target: the done contract says the implementation evidence does not itself check line 15, the generator never reads or hashes the checklist, and the current line 15 remains the exact receipt-record requirement evaluated here. Concurrent changes elsewhere in the checklist therefore do not invalidate these receipt bytes or this line-specific PASS.

The historical R-01/R-03 command, exit, duration, and loopback behavior were not rerun; this review proves that the preserved historical result bytes and their embedded hashes still bind the current source/inline fixture. The R-02/R-04/R-05 execution durations are preserved observations from their cited historical review/logs, and R-06's duration is the recorded maker observation; the independent run confirms current exit and deterministic output, not identical wall-clock timing. This evidence remains an offline fixture receipt and does not prove live provider behavior, process cleanup, identity, billing, Windows/native boundaries, or product authority-chain integration.
