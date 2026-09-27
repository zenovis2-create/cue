# S0 model alias registry — maker evidence

Date: 2026-09-12 (Asia/Seoul)

This is maker evidence, not an independent verdict. The checklist was not edited.

## Result

The static observation-only registry preserves all 12 original aliases from `docs/INTEGRATION_SPEC.md` exactly once. Eight aliases have canonical IDs directly confirmed by official provider documentation or the saved local server response and are `resolved-inactive`:

- `gpt 5.6 sol` → `gpt-5.6-sol`
- `6 astra` → `gpt-6-astra`
- `claude opus 5.0` → `claude-opus-5` (Anthropic documents that major-version releases omit the minor segment)
- `sonnet 5` → `claude-sonnet-5`
- `fable 5.1` → `claude-fable-5-1`
- `gemini flash 3.8` → `gemini-3.8-flash`
- `qwen 3.8 27b (로컬)` → server-advertised `qwen38-27b-unc`
- `grok 4.6` → `grok-4.6`

`terra` and `luna` remain `inactive-unresolved` because the requested bare words omit the GPT-5.6 family and provider; the official OpenAI page does not define them as standalone API aliases. `haiku` remains unresolved because the requested alias omits a version while official Anthropic materials distinguish Haiku generations and IDs. `muse 1.3` remains unresolved because Meta's primary announcement names **Muse Spark 1.3** and its API surface but does not state a canonical API model ID for the user's shorter, provider-free wording. No environment label or third-party slug was substituted.

The local Qwen mapping makes no marketing or weight-identity claim. It preserves the opaque ID returned by the saved llama.cpp `/v1/models` evidence; qualification and enablement remain false, with entitlement, price, and capabilities unknown.

## Primary sources

- OpenAI: https://developers.openai.com/api/docs/models and https://developers.openai.com/api/docs/models/gpt-6-astra
- Anthropic: https://platform.claude.com/docs/en/models/overview, https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions, and https://platform.claude.com/docs/en/models/fable-5-1/overview
- Google: https://ai.google.dev/gemini-api/docs/models
- xAI: https://docs.x.ai/developers/models/grok-4.6
- Meta unresolved evidence: https://research.meta.ai/blog/introducing-muse-spark-1-3
- Local Qwen primary evidence: `evidence/integrations/S1/20260911-qwen-live/result.json`

The official pages were viewed for the required time-sensitive research. The implementation and verification commands made zero application network, model, provider, native-helper, or Electron executions. The historical local Claude help was treated only as a CLI declaration and did not establish entitlement or canonical mappings.

## Authority and graph checks

- Every returned object, nested evidence object, grants object, record array, and lookup result is frozen.
- Registry construction rejects exact or normalized duplicates. Public lookup uses exact original text only; normalized keys are collision metadata and never lookup authority.
- Proxy, getter, custom-prototype, String-object, oversized, control-character, extra-argument, mutation, and duplicate-insertion cases are covered without invoking caller code.
- Every lookup is unavailable. Resolved records report `resolved-disabled`; unresolved records report `inactive-unresolved`.
- `rg` found no importer of `model-alias-registry` in `daemon/src`. The source contains no fetch, process launch, child-process, native helper, or Electron integration.
- Existing catalog, policy, selection, engine, admission, price, ranking, entitlement, dispatch, and UI files were not edited.

## Verification

Attempt 1 after the initial implementation:

- Focused Vitest: 1 file, 9 tests passed.
- `tsc -p tsconfig.json --noEmit`: exit 0.
- `npm --prefix daemon run build`: exit 0.
- Local documentation links: pass.
- Twelve source/local evidence digests: pass.
- Runtime import graph disconnected: pass.
- `git diff --check` on owned paths: exit 0.

Attempt 2 after strengthening the test to parse the alias line directly from `INTEGRATION_SPEC.md`:

- Focused Vitest: 1 file, 9 tests passed.
- `tsc -p tsconfig.json --noEmit --pretty false`: exit 0.
- `npm --prefix daemon run build --silent`: exit 0.
- Local documentation links: pass.
- Twelve source/local evidence digests: pass.
- Runtime import graph disconnected: pass.
- Owned-file trailing-whitespace scan: pass.

Post-review conservative correction: the root reviewer required a direct primary-source connection rather than contextual expansion of bare labels. `terra` and `luna` were therefore lowered from resolved to inactive-unresolved. After this correction, focused Vitest again passed 9/9, `tsc --noEmit` and build exited 0, and claim digests, links, disconnected import graph, and whitespace checks passed.

Independent review later rejected the ad-hoc digest evidence because v1 web rows inherited a root date and had no explicit digest kind. Those earlier digest-pass statements are superseded by `correction1.md`. `source-claims.json` is now deterministic v2 output: every row carries alias, kind, reference, claim, observed date, and digest; the generator/verifier fixes canonical LF bytes and separately hashes the exact Qwen file bytes. Current content hashes are in `hashes.json`.

## Checklist line 31 maker opinion

Maker opinion: line 31 can be closed after an independent reviewer confirms the official-source interpretations, exact 12-alias coverage, frozen/no-authority contract, and final hashes. The line's required outcome is now represented: canonical IDs are mapped where primary evidence directly identifies them, while `terra`, `luna`, `haiku`, and `muse 1.3` remain inactive and unresolved. This maker did not check the box.
