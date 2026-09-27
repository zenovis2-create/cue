# Selected-scope catalog correction result

The catalog now represents four current selected/adopted/limited decisions: R-04, R-05, R-06, and R-08. R-05 is bound to its Cue-native source, test, and decision hashes and is explicitly limited to a fixture/tool-only seam. R-08 is bound to the current Cue report IR, HTML, delivery, and `app/core.mjs` product seam while retaining zero selected Archify bytes. R-04 and R-06 now explicitly say their current reach is fixture/tool-only. Every row records an empty patch list and a source-notice fact scoped to the selected bytes; none states a legal compatibility conclusion.

PI-Desktop, TeamAI CLI, and the later Archify research snapshot are unchanged in identity, commit, incomplete BOM status, and false adoption authorization. Deferred R-01/R-02 transport choices remain deferred and unauthorized. The catalog-level `adoptionAuthorized` and every applicable/research row remain false.

## Gates

- Catalog parse and invariant check: applicable IDs exactly `R-04,R-05,R-06,R-08`; research IDs exactly `pi-desktop,teamai-cli,archify`; selected external byte count 0; authorization violations 0 — PASS.
- All applicable local `selectedBytes`, `cueProductBytes`, decision, and manifest path/hash bindings — 0 mismatches.
- R-08 preserved upstream archive: 5 archive files / 5 retrieval rows; decoded byte length and SHA-256 mismatches 0. Archive SHA-256 `4ebb9f9f3a35f61dcc74f3215e94b4b157d462a90eeade018137b90c73171263`; retrieval manifest SHA-256 `c299dbeca5bdc73cb10e81c042ce50358f299088388a6e3da8d65ee3ebdf0b5e`.
- Existing focused command from `daemon`: `npx --no-install vitest run test/integration-reuse-manifest.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — 1 file, 7 tests passed, exit 0. The test file was located and not edited.
- Scoped `git diff --check` — exit 0.

Final catalog: 16,360 bytes; SHA-256 `51d3edea28e779dd6e34a13b1b29ac33e3677e89e1e3d2166b0ee64da015149f`.

This correction supplies factual inputs for an independent R01/R02/S0-03 scope review. It does not itself edit an authoritative checklist, authorize adoption, qualify a deferred candidate, or provide a legal license certification.
