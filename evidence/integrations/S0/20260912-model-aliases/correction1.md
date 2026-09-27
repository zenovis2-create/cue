# S0 model alias source-claim digest — correction 1/2

Date: 2026-09-12 (Asia/Seoul)

Status: maker correction complete; independent reviewer re-review requested. This file does not close checklist line 31.

## Blocker and correction

Independent review blocked the v1 evidence because its 11 web rows did not carry a digest kind or per-row observation date and there was no committed deterministic generator/verifier. The root-level declaration was `sha256(UTF-8 reference + LF + claim + LF + observedDate)`, leaving the date inheritance and exact serialized contract outside each row. Ad-hoc shell checks were not an acceptable proof.

The v2 rule is explicit and generated:

- `web-claim-v1`: `sha256(UTF-8(reference + 0x0A + claim + 0x0A + observedDate)); no terminal LF`.
- `local-file-sha256-v1`: `sha256(exact referenced file bytes)`.
- Every row now has the ordered fields `alias`, `kind`, `reference`, `claim`, `observedDate`, `digest`.
- `source-claims.json` is canonical two-space JSON with LF line endings and one terminal LF. The terminal LF belongs to the JSON artifact, not to a web digest payload.
- `daemon/scripts/model-alias-source-claims.mjs` is the single deterministic definition, generator, and verifier. It rejects non-UTF-8/CRLF, reordered or unknown fields, changed source/claim/date even if re-signed, duplicate claims/aliases, digest tampering, unknown/swapped kinds, changed rules, and changed Qwen file bytes.
- The web digest payload semantics remain the intended reference/claim/date tuple, so the 11 individual web digest values did not need manual replacement. They are now regenerated rather than hand-maintained. The registry-to-generated-claim test proves every evidence reference, date, and digest is exact.
- Mapping/state remains the independently confirmed 8 `resolved-inactive` / 4 `inactive-unresolved`.

## Verification

- `npx vitest run test/integration-model-alias-registry.test.ts test/integration-model-alias-source-claims.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0; 2 files, 17 tests passed.
- The verifier cases include source claim/reference/date changes, CRLF, field reordering, unknown field, duplicate claim, digest tamper, Qwen kind/rule/file tamper, registry evidence equality, and fresh temp byte equality.
- `npm exec -- tsc -p tsconfig.json --noEmit --pretty false` — exit 0.
- `npm run build --silent` — exit 0.
- Fresh CLI temp regeneration — byte-equal; SHA-256 `4512ebd8a94ba702dd47e9f466541a44954e65ce9fb8574a0c8a760806debb9f`.
- `node daemon/scripts/model-alias-source-claims.mjs --check` — exit 0; 11 web claims, 1 local-file claim, 4,475 bytes, same SHA-256.
- Official/local documentation links — pass.
- Runtime import graph for registry and verifier — disconnected.
- Target trailing-whitespace scan and `git diff --check` — exit 0.
- No model, provider API, application network, native helper, or Electron execution occurred.

## Changed hashes

- `daemon/src/model-alias-registry.ts`: `c33df9c0e27641822564670bf39fcd9ab63a4f2a680f8cdb784977b4840a5518` (unchanged mapping and evidence digests)
- `daemon/scripts/model-alias-source-claims.mjs`: `74b7a088dfe3e81d28cd7d6edf9ee1dc3f04af48010c474040bb63567000166d`
- `daemon/scripts/model-alias-source-claims.d.mts`: `5712c3ba35723ba177a6879651a02f7ffe7a68a45b79284ab0d4c5ac79992371`
- `daemon/test/integration-model-alias-registry.test.ts`: `6e78992f75f95e6abe8376c22c39574462a884435ae6078294d79d6a1f60f790`
- `daemon/test/integration-model-alias-source-claims.test.ts`: `683af7f092967650793fdbff86a9d59d7e43c373196a7fea0b312bf83c6cfe11`
- `docs/reuse-decisions/MODEL_ALIAS_INVENTORY.md`: `9d561a2c3a45217fdc3a13d2002881b0975a5d4efd6bebea0935eae74446a362`
- `evidence/integrations/S0/20260912-model-aliases/source-claims.json`: `4512ebd8a94ba702dd47e9f466541a44954e65ce9fb8574a0c8a760806debb9f` (old v1 artifact `73d60b8ce291e589debc85fc55633b94f3aeeab6e792f64c3194aa3045d1c9a4`)
- `evidence/integrations/S0/20260912-model-aliases/maker.md`: `527cf51bd15688b16f6f6b95fefc44b70f85131c5e71d834f442c425e17f3d6c`
- `evidence/integrations/S0/20260912-model-aliases/hashes.json`: `005bf6ebe354eba600cd28e5978ee0ba2b5a0878827002b0e0bdb2cce9b9c5f7`
- Referenced Qwen response bytes: `9c2f0bd6475e3890c5d5547173667d841325039013501d5a25e837ef8661aa40`

Please independently rerun the two focused test files, the CLI `--check`, and a fresh `--output` byte comparison, then audit the v2 schema and registry evidence equality before deciding checklist line 31.
