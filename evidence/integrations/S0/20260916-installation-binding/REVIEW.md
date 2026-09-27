# Independent final review — provider installation binding

## Result

**Status:** CLEAR  
**Recommendation:** APPROVE  
**Reviewed gate:** `npm --prefix daemon exec -- vitest run --reporter=verbose test/integration-provider-installation-binding.test.ts test/integration-native-implementation-host.test.ts` — 4 tests passed across 2 files (independently rerun at 10:15:52).

No CRITICAL, HIGH, MEDIUM, or LOW findings remain in the bounded change.

## Verified invariants

- `app/provider-installation-binding.mjs` reasserts that the descriptor was issued and remains current before exposing the subject or evidence references; it requires matching source version and measurement-subject executable SHA-256.
- The corrected binding also requires the descriptor provider to be `codex` and its canonical executable path to equal `implementation.executor.binary`.
- `app/native-implementation-host.mjs` only applies a descriptor to the implementation candidate. It rejects `verifier.installation`, because that opaque candidate interface has no launch path to bind.
- A missing implementation descriptor preserves the prior candidate-composition path.
- The descriptor continues to state `unqualified`, `authenticated: false`, `entitled: false`, and `qualified: false`; the binding does not grant authentication, entitlement, qualification, or launch authority.
- The test covers profile-metadata drift invalidating catalog lookup, current-subject construction, and evidence references; it also covers copied descriptors, subject/version mismatch, wrong executable path, wrong provider, and rejected verifier descriptors.

## Final source SHA-256 pins

- `app/provider-installation-binding.mjs`: `04F76B444FCB2200083421D08FE2DF933EA0F59A096B1F473F1100A4FB2E689D`
- `app/provider-installation-binding.d.mts`: `CBA2F08F40B72F96A3BCD56A4A5612AE689CBA7FA407A4C893369BA9E4470D6D`
- `app/native-implementation-host.mjs`: `5348014E014AFAFEDE64AAFA250A95FFAC1CA5E05BCA063146CE63685E054D06`
- `app/native-implementation-host.d.mts`: `7A0B0FD501A8D567C578CD790D4FE75A7BBCBAE09DE51C7E966AF4E98606AE9C`
- `daemon/test/integration-provider-installation-binding.test.ts`: `90E4EC6A821A5F5025C7E0B3C51BCCA31E5B1F9448CC8D6862C24AD998E75AB3`

## Limits

The focused tests deterministically mock signature observation and candidate construction. They perform no live provider, network, model, or credential-content access. Consequently, the evidence proves composition-time identity binding and freshness behavior, not a live provider launch or atomic protection against filesystem changes after a pre-use freshness check. This matches the documented bounded scope.

The requested `remove-ai-slops` and `programming` skills were unavailable in the listed skill roots. A manual review found no deletion-only, tautological, or implementation-constant-only test; the corrected path/provider mismatch cases exercise the production composition boundary.
