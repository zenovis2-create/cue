# Independent measurement-subject review

Reviewer: `/root/transport_review`; no implementation edits. Scope: `daemon/src/model-measurement-subject.ts`, its focused test and supporting artifact hash implementation. No provider/model calls. No dist/node_modules source reads; the saved manifest was inspected as evidence only.

Status: PASS for the bounded measurement-factory scope; no current shipped-closure blocker found. Focused 3 tests PASS and final independent typecheck exit 0. No eligibility or full runtime attestation is implied.

## Verified behavior

- Input requires the exact six own string data properties, recognized model/checker kind, no proxy or accessor evaluation. The caller cannot supply a convenient artifact subset.
- Fixed source/compiled/migration/app/package/policy/probe inventory is bounded. Required files and source-to-compiled counterparts are checked; missing files and path escapes reject. Real-path/type and junction/symlink checks cover enumerated paths.
- Source, compiled executable formats, SQL migrations and application assets in the stated extension sets are hashed. Every file is measured through an opened descriptor with size/time/inode consistency checks. The factory also compares all measured path metadata and enumerated directory membership after the complete hash pass.
- Host runtime is the actual process executable. Isolated Node and the fixed host PowerShell executable are measured. The Windows build/UBR query uses the established process boundary and fails if the result is missing or malformed.
- The supported SQLite closure is explicitly better-sqlite3 13.0.3: loader/package/native bytes are hashed; new declared runtime dependencies reject. The allowed node-addon-api build-header declaration is not represented as runtime/build provenance proof.
- Frozen subject/manifest digests and distinct kind-specific probe grouping are emitted. No admission/eligibility, checker verdict or live provider qualification is issued. No production caller of the factory was found at review time.

## Evidence and limits

Independent command: `npx vitest run test/integration-model-measurement-subject.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, daemon directory. Result 3 PASS, 2026-09-11 20:07 local, duration 3.74 seconds. Fixtures use actual Windows OS/runtime observations with controlled file trees; they are not live eligibility fixtures. Missing compiled/app/policy/probe/dependency files, unsupported dependency metadata, changed and added runtime files, outside native dependency, a junction and a non-invoked accessor are covered.

The tests compare mutations between completed calls. They do not deterministically inject an in-flight file/directory mutation. The within-call checks were reviewed in source; that branch is not claimed experimentally exercised here.

`actual-checker-manifest.json` contains 273 historical artifact entries, including the four binary roles and the installed SQLite JS/package/platform .node tree. It was not remeasured while other agents were adding source files. This is the maker's historical actual installation measurement, not an independent assertion that today's moving workspace still has that digest.

The known extension inventory is not a general dependency resolver. No actual required shipped local executable omission was identified. Future loaders/native/wasm assets or additional dependency families require manifest/version work rather than an assumption they are automatically covered. Windows/.NET/system DLLs, Electron/host executable supporting runtime libraries, the native build toolchain and provider process remain external trusted dependencies; measuring an EXE does not attest an entire runtime installation. Installed control paths and the host invoking the factory are trusted. The factory does not establish that source and compiled bytes are semantically equivalent.

## Typecheck history and final gate

`npx tsc -p tsconfig.json --noEmit` produced unrelated active-work errors in `src/reports/ir.ts`: lines 47/59 nullable strings, 76/81/85 unknown values. The following focused test command passed; the combined shell's final exit 0 must not be treated as typecheck success. No unchanged retry was performed. Parent acknowledged the report owner was editing and requested awaiting compile-ready.

After the report owner explicitly confirmed its correction and compile readiness, the reviewer ran `npx tsc -p tsconfig.json --noEmit` once more independently: exit 0 (tool chunk 923d62). The two reviewed subject source/test hashes below remained unchanged, so focused tests were not redundantly rerun.

## Reviewed SHA-256

| Artifact | SHA-256 |
|---|---|
| daemon/src/model-measurement-subject.ts | 7AA218F42D2B72351E889FF61287F945C9A85F4125858A3086939D046B7A8962 |
| daemon/test/integration-model-measurement-subject.test.ts | B2110FB27A7DB888F9C53490CB18887114036EC04436F0D1EFC411D5A4D3C0CB |
| historical actual-checker-manifest.json | 06D971059DE4F1F3CFBF5253F39C9115FCF3BED7105773B156411DD1A2AD3576 |
