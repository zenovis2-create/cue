# Current-source generator follow-up

Verdict: **PASS** for the current bounded static source snapshot and declared-import diagram/comparison at content digest `55859c698ae86026376445a59ac852beef4be5852e6c3d6aa9e530148e69d26d`.

## Current snapshot evidence

The atomic pointer selects `generations/55859c698ae86026376445a59ac852beef4be5852e6c3d6aa9e530148e69d26d`. Independent recapture matched all 157 file hashes, 711 AST import observations, 351 deduplicated declared-import edges, inventory entries, extraction limits, and Rolldown parser JS/native binary identities. The source basis before and after capture matched, and the generation manifest and pointer stayed byte-identical through verification.

- Pointer SHA-256: `207ff09875f28e6663dea22c043e7619360ce0e621f224ad7e0ede7e426217a0`
- Manifest SHA-256: `d6a327af15950cdfde7825dac307b68b30c2c15126124a61cac8a0b254a1acdd`
- Structure HTML SHA-256: `3ec8952852a0be6d1c45da8a1eaf83706862bfb70972024d2099cc2bc638e6c6`
- Comparison HTML SHA-256: `dedfcafa4d5f127e136bf23530e9ab81b9213211471b1c08f3d15dc4c0ce7cea`

One root-authorized hidden Electron invocation opened both exact saved HTML byte strings through the production `openReportWindow` path. Both observations recorded JavaScript, Node integration, preload, and DevTools disabled; context isolation, sandbox, and web security enabled; permission/download guards installed; the restrictive CSP present; zero scripts or external asset/link attributes; and exactly one allowed `data:` main-frame request with no external requests. Default, 480px narrow, and expanded views had no horizontal document overflow.

Root and the independent QA owner separately inspected all six screenshots. The matrix, legend, current digest, comparison counts, narrow reflow, and expanded inventories/details painted correctly. Long paths and provenance wrap densely in the narrow expanded source table; this is a recorded usability limitation rather than missing content. The current structured and visual evidence is preserved under `qa/snapshot-55859c698ae86026376445a59ac852beef4be5852e6c3d6aa9e530148e69d26d/`.

## Corrections

1. Bound both Vitest dynamic imports to exact `import.meta.url`-relative module URLs.
2. Built the test's archived report with the same compiled IR module instance used by the generator. The focused bundle test now verifies the real extractor edge shape and its normalized `source-declared-unverified` report shape.
3. Reused canonical extraction metadata so `result.json` includes `limits` plus parser name, version, API, and binary identities/hashes.
4. Staged all output bytes under a content-addressed generation directory and atomically commits `current-generation.json` only after source/basis revalidation. A late failure restores the prior pointer only when the pointer still contains this writer's bytes; a competing commit is preserved.

Independent code QA then exercised the exact returned current-comparison receipt and found that its provenance was changed after the inherited historical specification digest was computed. Correction hypothesis 4 recomputes `specificationSha256` and `specificationBytes` from the exact final returned `comparison` serialization. The direct comparison test asserts both fields; the historical renderer and archive receipt behavior remain unchanged.

The committed layout is `evidence/integrations/S7/20260912-current-source/generations/<snapshotDigest>/` with `current-generation.json` as the atomic active-generation pointer. A hidden incomplete staging directory is never active evidence.

## Gates

- `npm run build --silent` from `daemon`: exit 0.
- `npx --no-install vitest run test/integration-reports.test.ts test/integration-report-comparison.test.ts test/current-source-report.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 --passWithNoTests=false`: exit 0; 3 files PASS, 16 tests PASS.
- `node scripts/reuse/cue-source-structure-report.mjs --self-test`: exit 0; `self-test PASS: AST/type/external/nonliteral, changed bytes/inventory, symlink skip, badpath`.
- `node --check` for both source-report scripts: exit 0.

## Source hashes after gates

- `scripts/reuse/cue-source-structure-report.mjs`: `e4846dcbe150646e448a223a84f78a964f1d01c4cb63ef54363c464457a82344`
- `scripts/reuse/cue-current-source-report.mjs`: `e51c77c5f49a46ea5f8db6edc94e66e310f37f78abadf8f3a46f7656bd24d858`
- `daemon/test/current-source-report.test.ts`: `c828b9e5e04e8399ff24e33adc1fc22c4c98a9c3338ece21bf70a719d1fa053a`
- `daemon/src/reports/comparison.ts`: `12fe42fb407bb7a1199a6e214fe509eeacbdeadffcb7efc4cbbb050bf7677646`
- `daemon/test/integration-report-comparison.test.ts`: `4c8596f852814aa50530a68ba68ead7942624311fb694b77ba1592c5fba29b7d`

## Remaining boundary

This evidence establishes only a current bounded static source snapshot and declared-import diagram/comparison. It does not establish runtime dependencies, execution impact, safety, performance, clean Git state, model qualification, or broader S0-S7 completion.

## Historical current snapshots

Snapshot `24f8d9785941a22b436a496aaa057a8680abb5b25bbcd43b45cbf7b26d9bc8dd` previously passed independent source and hidden Electron QA at 153 files and 346 edges. Its exact structured evidence, six screenshots, and root visual review remain preserved under `qa/snapshot-24f8d9785941a22b436a496aaa057a8680abb5b25bbcd43b45cbf7b26d9bc8dd/`. It is historical and is not the active current-source pointer.
