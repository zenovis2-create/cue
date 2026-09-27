# S4 journal helper packaging done contract

Done means the reviewed helper digest is bound to a checked manifest with source hashes and provenance, the build copies the verified helper and manifest to the fixed compiled asset path, the compiled host has no source-tree fallback, installation generation covers both native asset closures, and focused tests prove success plus missing/mismatch fail-closed behavior.

Correction attempt cap: 3.

Every pass runs:

1. `npx --no-install tsc -p tsconfig.json --noEmit`
2. focused Vitest for journal packaging, native snapshots, and installation identity
3. `npm run build`, followed by SHA-256 checks of source and compiled helper/manifest
4. scoped `git diff --check` and final changed-file SHA-256 receipt

A failed pass gets one new evidence-based hypothesis and correction. A regression is reverted. After three failed correction passes, hand the exact failure and artifacts to the human.
