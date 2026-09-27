# Applicable upstream source/BOM completion result

## Scope result

The current bounded selections contain no external package, code, font, brand mark, or other asset bytes. R-04 and R-06 select Cue-native source only; their external BOM/license/notice/assets applicability is therefore recorded as not applicable with exact local manifest, source, test, and lifecycle bindings. TeamAI, Ajv, and Zod remain rejected or deferred rather than silently disappearing.

R-08 is limited to Archify's declarative schema, stable-identity comparison, and delivery-evidence principles. The catalog now binds those observations to the exact decision revision `18911058008f17dc065af23a2cdc9bfeff6d3f7a`. It records immutable hashes for the license, notice, schema, delta reference, delivery contract, and package manifest. Archify CLI, renderer code, package/dependencies, skills, fonts, brand marks, and all other assets remain explicitly excluded. The previously captured `d673e8...` repository remains a later research snapshot and is not relabeled as the selected source.

PI-Desktop and TeamAI catalog entries remain preserved research snapshots with their original incomplete BOM facts. R-01/R-02 transport experiments remain deferred. No adoption authorization changes: catalog, scope, selections, research repositories, and retrieval manifest all retain `adoptionAuthorized:false`.

## Original-condition assessment

- R01 is complete only for the currently bounded Cue-native and limited-principles scope: identity, revision, public/internal seam, and source references are explicit. It remains incomplete for deferred transport candidates.
- R02 is complete only for currently selected bytes: Cue-native selections contain no external dependency/assets, while Archify package/assets are excluded. This is neither a license compatibility verdict nor completion for deferred candidates.
- S0-03 remains program-wide incomplete because deferred/research external candidates still lack adoption-grade dependency, notice, and asset inventories. The absence of selected external bytes does not erase those unknowns.

## Validation

- Catalog invariant command: 3 applicable selections, 3 preserved research snapshots, 0 selected Archify external bytes, all authorization false — PASS.
- Local selected-byte and manifest SHA-256 bindings plus retrieval-manifest binding — PASS.
- Five exact decision-pin source files are preserved as base64 bytes in `archify-pin-files.json`; decoding reproduced every recorded byte length and SHA-256 and matched every retrieval-manifest row — PASS. The large Archify delta implementation is no longer claimed as newly archived evidence; the decision retains it as linked design context only.
- `npx --no-install vitest run test/integration-reuse-manifest.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — 1 file / 7 tests PASS.
- Four existing manifest CLI validations — exit 0; R-01/R-02/R-04/R-06 remain `incomplete`, `adoptionAuthorized:false`, with the four existing unknown compliance dimensions. The catalog does not weaken that validator or overwrite those manifests.
- `node --check scripts/reuse/reuse-manifest.mjs` — exit 0.
- Scoped `git diff --check` — exit 0.

Final hashes:

- `docs/reuse-decisions/upstream-source-catalog.json`: `65e5af0b0a85ba458655de45b93b320866a4099d3f66394e5b2f1e63a19507d7` (12,724 bytes)
- `retrieval-manifest.json`: `c299dbeca5bdc73cb10e81c042ce50358f299088388a6e3da8d65ee3ebdf0b5e` (1,292 bytes)
- `archify-pin-files.json`: `4ebb9f9f3a35f61dcc74f3215e94b4b157d462a90eeade018137b90c73171263` (31,815 bytes)

## Independent review history

The initial independent review was blocked because the first retrieval manifest asserted hashes for the R-08 decision pin without preserving the fetched bytes; the prior archive belonged to the distinct later `d673e8...` research snapshot. Correction pass 1 preserved the exact bounded license, notice, schema, delivery-contract, and package-manifest bytes at `189110...`, bound the archive hash through the retrieval manifest and catalog, and removed the unarchived large delta implementation from the newly asserted byte set. The final independent re-review passed with no actionable findings.

The retrieval was read-only. No fetched code was installed or executed, and no model, provider, credential, native helper, or product dependency was used.
