# S0 model alias registry — independent review

Final review date: **2026-09-12 (Asia/Seoul)**

Final verdict after correction 1: **PASS**

Checklist line 31: **may be closed**

This final verdict supersedes the earlier v1 **BLOCKED** verdict preserved below. Correction 1 fixes the missing row-level digest inputs and supplies one deterministic generator/verifier. Independent byte-level recomputation and the complete corrected gate found no remaining blocker. This reviewer did not edit the checklist.

## Correction 1 independent results

- A verifier-independent Node calculation reconstructed every `web-claim-v1` payload as the exact UTF-8 bytes `reference`, `0x0A`, `claim`, `0x0A`, `observedDate`, with no terminal LF. All **11/11** web digests matched.
- The same independent calculation hashed the exact saved Qwen evidence bytes for `local-file-sha256-v1`. The **1/1** local digest matched `9c2f0bd6475e3890c5d5547173667d841325039013501d5a25e837ef8661aa40`.
- The committed v2 JSON contains no CR byte, has canonical LF line endings and one terminal LF, is 4,475 bytes, and hashes to `4512ebd8a94ba702dd47e9f466541a44954e65ce9fb8574a0c8a760806debb9f`.
- Fresh CLI `--output` generation in a newly created system-temp directory was byte-identical to the committed v2 JSON, with the same length and SHA-256. The exact temp target was verified under the system temp root before the generated file and empty directory were removed.
- CLI `--check` returned 11 web claims, 1 local-file claim, 4,475 bytes, and the same source artifact hash.
- Focused Vitest passed **2 files, 17 tests**. It reproduced fresh byte equality; exact registry evidence equality; changed claim/reference/date rejection even after re-signing; CRLF, field-order, unknown-key, duplicate, digest, kind, rule, and Qwen-byte tamper rejection; and all original registry hostile-input and immutability cases.
- Final `npx --no-install tsc -p tsconfig.json --noEmit --pretty false` exited 0. Final `npm run build` exited 0.
- All **11/11** paths in `hashes.json` matched their current bytes.
- Registry runtime readback remained exactly 12 aliases, 8 `resolved-inactive`, and 4 `inactive-unresolved`, with every enablement/qualification flag false, all entitlement/price/capability values unknown, and every authority grant false.
- Product-source import scan found zero import of either the alias registry or source-claim verifier under `daemon/src`.
- Local Markdown links: 4 checked, 0 broken. Official-source links: 10 extracted; the vendor pages used for the mapping conclusions were already opened and inspected during this independent review on the review date.
- Direct trailing-whitespace scan passed for all 11 correction implementation, test, documentation, and evidence files.

The first full TypeScript/build attempts overlapped unrelated shared-worktree edits and respectively reported temporary errors in `integration-engine.test.ts` and `integration-generated-json-host.test.ts`. Both files changed during observation. After those edits stabilized, one fresh TypeScript run and one fresh build passed without any reviewer change outside this review file. These transient failures do not concern the model-alias correction, but are retained here rather than hidden.

The official-source conclusions below remain current: seven remote IDs have direct vendor support; the saved local server supports only the opaque Qwen advertised ID; and `terra`, `luna`, `haiku`, and `muse 1.3` correctly remain unresolved. The correction changes evidence reproducibility only and does not expand mapping, qualification, availability, entitlement, pricing, capability, selection, or dispatch claims.

## Superseded v1 review record

The initial registry behavior and eight resolved mappings were supported by current first-party evidence, but the v1 claim rows omitted per-row observation dates. The earlier independent calculation therefore could not reconstruct the declared payload and issued the following blocker. Correction 1 has now satisfied it.

### Historical blocker

🔴 **Declared web-claim digests do not match the declared digest rule.**

The v1 `source-claims.json` declared `sha256(UTF-8 reference + LF + claim + LF + observedDate)` while keeping the observation date only at the document root. Independent Node `crypto` recomputation from the row values therefore produced mismatches for all 11 web claims; only the Qwen `sha256(file bytes)` entry matched.

Concrete counterexamples:

| Claim | Recorded digest | Recomputed digest |
|---|---|---|
| `GPT-5.6 Sol -> gpt-5.6-sol` | `02c3148374d626a52ddf2cb9111d2e27a27e2478013fa61c364638890a5c0d26` | `c22eafb72706d665460b228e79f9a17b54875230e18c36d4817ebdc944104b51` |
| `Grok 4.6 -> grok-4.6` | `545dc157ff70dee09ade47435caae7da291c19fba45adc51f50fff9957db6858` | `a7a496c597aebf59ec3d22adae4583168604b8c67d80bf586501ffabedc93866` |

This was an evidence-integrity failure rather than a counterexample to either mapping. The required remediation was to bind every digest input to each row and rerun the complete gate. The v1 `hashes.json` matched the then-current bytes of all seven files it covered, including the then-incomplete `source-claims.json`; that outer file hash did not make the inner claim payload reproducible.

### Official mapping review

The following mappings have direct current support on official vendor pages and may remain `resolved-inactive`:

| Original alias | Canonical ID | Direct evidence |
|---|---|---|
| `gpt 5.6 sol` | `gpt-5.6-sol` | [OpenAI Models](https://developers.openai.com/api/docs/models) displays GPT-5.6 Sol and this model ID together. |
| `6 astra` | `gpt-6-astra` | [OpenAI GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) displays the model and ID and lists the API endpoints. |
| `claude opus 5.0` | `claude-opus-5` | [Anthropic model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions) directly states that major-version releases such as Claude Opus 5 omit the minor segment and lists `claude-opus-5`. |
| `sonnet 5` | `claude-sonnet-5` | [Anthropic Claude Sonnet 5](https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5) directly labels `claude-sonnet-5` as the API model ID. |
| `fable 5.1` | `claude-fable-5-1` | [Anthropic Claude Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview) lists `claude-fable-5-1` under Claude API model IDs. |
| `gemini flash 3.8` | `gemini-3.8-flash` | [Google Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) directly identifies the model code and stable version. |
| `qwen 3.8 27b (로컬)` | `qwen38-27b-unc` | Saved local `/v1/models` evidence advertises exactly this opaque ID. It does not establish a marketing-name or weight identity. |
| `grok 4.6` | `grok-4.6` | [xAI Grok 4.6](https://docs.x.ai/developers/models/grok-4.6) directly lists `grok-4.6` as the model name. |

The four unresolved rows are appropriately conservative:

- `terra` and `luna`: OpenAI's page identifies **GPT-5.6 Terra** and **GPT-5.6 Luna**, but does not define the bare words as standalone API aliases. The collaboration environment labels were not treated as public API IDs.
- `haiku`: Anthropic's current overview identifies a versioned Haiku model and ID; the bare family name does not uniquely select that generation or a canonical ID.
- `muse 1.3`: [Meta's public announcement](https://research.meta.ai/blog/introducing-muse-spark-1-3) names **Muse Spark 1.3** and says it is available through Meta Model API, but the public page gives no canonical API model ID for the shorter alias. The linked developer portal required login during review, so no direct public ID was established.

The Qwen evidence reports `id: qwen38-27b-unc`, `owned_by: llamacpp`, and metadata including parameter count and quantization. The registry correctly limits its claim to the server-advertised opaque ID; marketing lineage and exact weights remain unknown, and the row stays disabled and unqualified.

### Registry and test results

- The spec's single source line contains exactly 12 aliases. The static registry contains the same 12 in the same order, exactly once, with no extras.
- Runtime readback found 8 `resolved-inactive` and 4 `inactive-unresolved` records.
- Every record has `enabled: false`, `qualification: false`, and `entitlement`, `price`, and `capabilities` set to `unknown`.
- Registry authority is `observation-only`; selection, admission, price, rank, entitlement, and dispatch grants are all false.
- `rg` found zero imports of `model-alias-registry` anywhere under `daemon/src`; selection/admission/dispatch therefore receive no authority from this registry.
- Focused Vitest reproduced exact coverage, Qwen binding, unresolved lookups, fuzzy/wrong-case rejection, deep freezing, hostile proxy/getter/custom-prototype/String-object/oversize/control-character handling, extra-argument rejection, and duplicate/mutation resistance: **1 file, 9 tests passed**.
- `tsc -p tsconfig.json --noEmit --pretty false`: exit 0.
- `npm run build --silent`: exit 0.
- Runtime readback of the compiled module: 12 records, 8 resolved, 4 unresolved, all grants false; fuzzy lookup rejected.
- Local Markdown links: 3 checked, 0 broken. All five official vendor source surfaces used by the records were opened and inspected on the review date.
- `hashes.json`: 7/7 current file hashes matched.
- Direct trailing-whitespace scan: 7 reviewed implementation/test/document/evidence files clean.
- Claim digests: **1/12 matched**; the one match was the local Qwen file-bytes digest. This is the blocking gate.

### Limits

- This review confirms documentation identity, static behavior, and isolation only. It does not prove account entitlement, live provider availability for a particular account, pricing, capabilities, qualification, or dispatch readiness.
- No remote provider or model was called. The local Qwen result is a saved observation from 2026-09-11 and does not independently identify the marketed model or weights.
- The repository-root `AGENTS.md` requested for inspection is absent from this checkout; the session-injected root instructions were applied.
- The reviewed target files are untracked in the shared worktree, so ordinary Git patch checks cannot establish their provenance. Direct hashes, content checks, and focused tests were used instead.

Correction 1 made the 11 claim digests reproducible and the full gate remained green. No other blocker found in this review prevents checklist line 31 from closing.
