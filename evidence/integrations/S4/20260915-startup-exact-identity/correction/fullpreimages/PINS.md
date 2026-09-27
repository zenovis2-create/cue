# Full-preimage pins

The correction begins from these complete byte-level source preimages, pinned by SHA-256:

- `daemon/src/recovery.ts`: `FCA73ACE0058476C103CEA6F06F03ABC032F2255E732CE95F43A302B0F556FDA`
- `daemon/src/process-termination.ts`: `D4ABCF16496838E8D2D279CC9D9C2E1DECB0063AA7C433BE98E2499020987F6C`
- `daemon/test/integration-startup-exact-identity.test.ts`: `7C77020E55BD03B9A3060FECC9F0AED7E906ACA94DD451357282CAE8B86D7739`

The prior complete `recovery.ts` preimage is retained at `../../fullpreimages/recovery.ts`; the hashes above uniquely pin the correction inputs without rewriting them during source edits.
