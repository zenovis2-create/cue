# Provider installation binding plan

- Done: `npm --prefix daemon exec -- vitest run test/integration-provider-installation-binding.test.ts` exits 0 and the production `createNativeImplementationHost` path proves current signed-installation identity gates catalog lookup, candidate subject construction, and evidence references; drift makes the candidate unavailable without treating installation identity as authentication or qualification.
- Attempt cap: 2 attempts per hypothesis.
- Every pass: run the focused test, inspect the scoped diff, hash owned implementation/test files, and record raw command output.
- Failure: retry only with a new hypothesis; otherwise hand the bounded failure to the root agent.
- Limits: no model/provider/network execution, no credential-content reads, no shared build, no authoritative documentation changes.

## Exact preimages

- `app/provider-installation.mjs`: `E850CE66DE8036CAC24A82F9C41914D94400526BF72CAC6CFD41E80DE6498D06`
- `app/provider-installation.d.mts`: `53546D7B408F3509313C3DD2D032F80EC79EEB9777F84E90A5686DC0BB5ACC84`
- `app/native-implementation-host.mjs`: `7B1889677FA70BDEFD90903FD40CFB0F1D16D8C9A2590A6A27553652D1513CFD`
- `app/native-implementation-host.d.mts`: `CA6483961F4AB3B3D8383BDE71396D34B69738E54A8C9D7611DE81FC16112017`
- `app/provider-installation-binding.mjs`: absent
- `app/provider-installation-binding.d.mts`: absent
- `daemon/test/integration-provider-installation-binding.test.ts`: absent
