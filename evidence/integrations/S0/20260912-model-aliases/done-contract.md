# S0 model alias registry — done contract

Date: 2026-09-12 (Asia/Seoul)

## Completion definition

1. Every original user model alias in `docs/INTEGRATION_SPEC.md` appears exactly once in the static registry.
2. Only aliases whose canonical API model ID is confirmed by official provider documentation, an installed CLI's bounded primary evidence, or the local server's primary evidence are `resolved-inactive`; every unconfirmed alias remains `inactive-unresolved`.
3. The local alias `qwen 3.8 27b (로컬)` maps only to the server-advertised `qwen38-27b-unc`; its marketing-name and weight identity remain explicitly unverified.
4. Registry authority is observation-only. It has zero authority for selection, admission, pricing, ranking, entitlement, qualification, enablement, or dispatch.
5. The registry returns canonical original aliases, collision-checked normalized lookup keys, state, provider, canonical model ID or null, evidence reference/digest/date, `qualification: false`, `enabled: false`, and unknown entitlement/price/capabilities as deeply frozen host-owned data.
6. Lookup is exact-case and exact-text only. Ambiguous normalized keys, duplicates, proxies, getters, custom prototypes, oversized values, mutation attempts, and extra arguments are rejected or unavailable without invoking caller code. Every unresolved alias lookup is unavailable.
7. The module remains disconnected from policy, engine, selection, admission, pricing, ranking, entitlement, dispatch, Electron, provider, network, model, and native execution graphs.
8. Focused tests, TypeScript compilation/build, documentation-link checks, source hashes, and whitespace checks pass. The maker records whether checklist line 31 appears closable but does not edit the checklist; independent review remains required.

## Verifier loop

- Attempt cap: 2.
- Every pass: focused alias-registry test, TypeScript compilation/build, documentation-link checks, source hashes, and `git diff --check` for owned files.
- No network call, model call, provider call, native helper, or Electron execution is permitted by the implementation or verification loop.
- Failure response: retry once only with a new hypothesis and rerun the complete pass. If the measured gate does not improve, preserve the evidence and hand the failure to a human reviewer.
- Keep criterion: retain a change only when the measured gate passes or improves. This maker contract does not issue the independent verdict.
