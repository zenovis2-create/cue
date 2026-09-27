# Maker evidence

Renderer-only selection explanations reuse the projected historical DTO in existing stage and attempt rows. The details retain their open state for the same run during polling; a different run does not inherit it. Korean labels distinguish recorded, missing legacy, invalid and not-started. Local fixed-pair decisions explicitly were not ranked. At most 50 candidate rows are displayed with total and omission indication. Text-only safe identifiers and reason labels prevent HTML injection; numeric scores are not presented as quality measurements. Execution ownership and Stop logic are unchanged.

Gate 2026-09-12 01:14 KST: `npx vitest run test/integration-selection-explanation-ui.test.ts test/integration-native-recovery-ui.test.ts --reporter=dot` exit 0, 10 PASS (new 4 + recovery 6).

`npx tsc --noEmit -p tsconfig.json` exit 1: other-owner `test/integration-local-driver.test.ts:13` imports `../dist/src/ui/orchestration.js` without declaration. Parent notified; no build executed by maker. This is not a clean global typecheck claim.

No model/helper/native calls. DOM fixture tests are not actual Electron or real selection evidence. Independent code review and root-coordinated build/actual Electron compiled-Core fixture QA remain separate gates. Preimage and current hashes are retained alongside this file.

## Correction 1 — explicit legacy membership

Independent review found that missing/null selection for an existing attempt was inferred as legacy. Only the projected explicit legacy status can carry that meaning; missing/null with an attempt now displays invalid. Missing selection without an attempt remains not-started. The regression distinguishes both null/undefined, explicit legacy, invalid, and no-attempt cases. Pre-correction hashes and renderer are preserved.

Final focused gate 2026-09-12 01:16 KST: selection UI 4 + recovery UI 6 = 10 PASS; daemon `npx tsc --noEmit -p tsconfig.json` exit 0 after the other owner corrected its test import. No product build or actual runtime calls by maker. Independent recheck pending.
