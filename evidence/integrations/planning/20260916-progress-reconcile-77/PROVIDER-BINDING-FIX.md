# Provider-binding regression correction

Observed failure: the adjacent provider-installation binding suite rejects its positive host fixture before the subject collector is called. The host now requires an implementation executor `resolveBinding` function, but this older composition-only fixture supplies only `binary`.

Done: retain the current host guard; provide a non-launching fixture resolver and explicitly test that a missing resolver is refused. `npx --no-install vitest run test/integration-provider-installation-binding.test.ts` must exit 0. No provider, account, model, or network call is made. Root owns only this test correction; an independent reviewer checks it before acceptance.

Cap: two passes. Every pass reads the named test result and checks the exact source diff. A failure requires a new diagnosis, not a repeated command. Preserve the original test bytes and failing adjacent log. This test-only fix does not qualify a provider or close an original checklist item.
