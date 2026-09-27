# Provider installation binding results

## Outcome

`createNativeImplementationHost` now accepts an optional `installation` descriptor on the Codex implementation candidate. When present, its provider must be `codex`, its canonical executable path must equal the executor binary, and the production candidate's `currentSubject`, runtime `buildCurrentSubject`, catalog freshness check, and `evidenceReferences` all reassert the exact issued signed installation descriptor. The candidate subject must contain the descriptor's executable SHA-256 and its catalog source version must equal the descriptor version. A verifier descriptor is refused because the opaque verifier candidate interface exposes no launch path that this seam can bind.

This binding remains installation identity only. The descriptor retains `status: unqualified`, `authenticated: false`, `entitled: false`, and `qualified: false`; candidate authentication and capability admission remain separate host inputs and gates.

After opaque auth-profile metadata drift, the production catalog reports `subject-unavailable`, and both runtime subject construction and evidence lookup refuse. A copied/unissued descriptor, wrong provider, mismatched executor path, mismatched subject hash, or mismatched source version refuses composition.

## Verification

- Focused final: `npm --prefix daemon exec -- vitest run --reporter=verbose test/integration-provider-installation-binding.test.ts` — 1 file, 2 tests passed.
- Compatibility: `npm --prefix daemon exec -- vitest run --reporter=verbose test/integration-provider-installation-binding.test.ts test/integration-native-implementation-host.test.ts` — 2 files, 4 tests passed.
- No model/provider/network execution and no credential-content reads occurred. Provider signature observation was a deterministic process mock; auth-profile files were checked only through the existing metadata identity implementation.
- Shared build was intentionally not run; root owns the single build gate.

## Final SHA-256

- `app/provider-installation-binding.mjs`: `04F76B444FCB2200083421D08FE2DF933EA0F59A096B1F473F1100A4FB2E689D`
- `app/provider-installation-binding.d.mts`: `CBA2F08F40B72F96A3BCD56A4A5612AE689CBA7FA407A4C893369BA9E4470D6D`
- `app/native-implementation-host.mjs`: `5348014E014AFAFEDE64AAFA250A95FFAC1CA5E05BCA063146CE63685E054D06`
- `app/native-implementation-host.d.mts`: `7A0B0FD501A8D567C578CD790D4FE75A7BBCBAE09DE51C7E966AF4E98606AE9C`
- `daemon/test/integration-provider-installation-binding.test.ts`: `90E4EC6A821A5F5025C7E0B3C51BCCA31E5B1F9448CC8D6862C24AD998E75AB3`

## Limits

- This does not authenticate an account, establish entitlement, qualify provider behavior, or grant launch authority.
- A drifted issued descriptor cannot be refreshed in place. Revalidation requires a newly identified descriptor and new host composition.
- No live provider installation was measured in this bounded test.
