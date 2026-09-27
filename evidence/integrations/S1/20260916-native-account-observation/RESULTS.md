# Maker results — correction complete, independent review required

The bounded module launches the ledger-owned sealed Codex executable with fixed app-server arguments, calls only initialization plus the requested account observation methods, rechecks installation and subject identity, verifies successful-path process cleanup, and issues a WeakMap-backed receipt. It reports account presence while authentication, capability, and entitlement remain unknown.

## Gates

- Attempt 1 focused tests: 3/3 passed.
- Attempt 1 TypeScript: failed on literal narrowing in the new module.
- Attempt 2 focused tests: 3/3 passed.
- Attempt 2 TypeScript: exit 0.

## Superseded maker-discovered blockers

The original source was frozen **not CLEAR** at its two-pass cap.

1. The documented API-key account shape contains no stable account identifier beyond `type:'apiKey'`. The current implementation hashes that shape, which would collide across API-key accounts. It must instead report presence with `accountRef:null` and `accountIdentityDigest:null` unless the protocol supplies a stable opaque identity.
2. On exceptions after launch, `finally` requests verified termination but does not await child close and prove absence before cleaning the ephemeral home. The success path does verify absence. The error path must receive the same bounded close/absence verification without hiding the primary failure.

## Correction

A separately authorized correction pass resolved both findings:

- API-key account presence now carries `accountRef:null` and `accountIdentityDigest:null`; it does not synthesize a cross-account identity.
- All post-launch paths await exact child closure and verify process absence before deleting the owned home. If termination cannot be verified, the home is retained and the cleanup error is surfaced.

Correction attempt 1 passed 5/5 focused tests and TypeScript no-emit. Hostile cases cover two distinct API-key profiles, timeout cleanup, and unverifiable termination retention.

The exported `observeNativeProviderAccount` function is the explicit production owned-probe API. A future preflight caller can use its advisory account presence and opaque ChatGPT account reference before launch, but the receipt cannot grant authentication or selection eligibility. No current Core consumer is wired in this unit, so authenticated preflight remains unresolved rather than being relabeled complete.

Independent review is required before production consumer integration.

## Pins

- `native-account-observation.ts`: `1a0efa2db870d2d8dbe98ea9e3a8ec46c1013d3796d9004c4ae05394437a8f46`
- `integration-native-account-observation.test.ts`: `fca50f4709812611b3da45d9b93807e03c4f431a1c8e1a4b43733b0158b81ba4`
- Attempt 2 log: `175aa2ec11fddc562f35a7336dbba1f6dbeda05fc1ac11fabc77bcbb1bfeef23`
- TypeScript attempt 2 log: `5913c4acfaced3b4ce71164e1ec2e8a6ba3e6a5a545d8676aa07e7d17b9c8cb8`

## Corrected pins

- `native-account-observation.ts`: `d827c915e733f13532ddfaaf00fdcfba7dff13ca0d3e1c93bac3d83c9d3d124b`
- `integration-native-account-observation.test.ts`: `1f5b55fc92b1997555d52637e1ec750f4224be4e9e220d5e8b05bb4a78af50ea`
- Correction attempt 1: `4a55d1a7aba9f55ad98aa5e3ee4a7c5127be75cd3534a4b406fdd27a5511e552`
- Correction TypeScript: `5913c4acfaced3b4ce71164e1ec2e8a6ba3e6a5a545d8676aa07e7d17b9c8cb8`

No provider, model, or network call was made. Tests used synthetic module mocks and no real auth profile.
