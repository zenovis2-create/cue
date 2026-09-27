# S4 native journal helper packaging

The reviewed Windows helper is pinned to SHA-256 `CDC021FC3B912C771C54EFA9ECD5C2AB6874A7D7D02BB15C2882CAFB34F38555`. `daemon/native/change-snapshot/manifest.json` records that artifact, its protocol, platform/architecture, all reviewed Go and notice source hashes, the independent review receipt, and the rule forbidding downloads or startup compilation.

The daemon build validates every manifest hash before copying the helper and manifest to `daemon/dist/native/change-snapshot/`. The source host resolves `daemon/native/change-snapshot/`; the compiled host resolves only `daemon/dist/native/change-snapshot/`. Missing or altered copied assets leave the native seam unavailable. Migration 038 is copied with the other ledger migrations.

`getChangeSnapshotHelperMetadata()` publishes one import-time frozen host-owned object containing protocol, reviewed digest, and resolved helper path, or `null` when trust inputs are unavailable. Callers cannot supply an executable path. Journal persistence uses protocol and digest; the path remains diagnostic host metadata.

Installation generation now hashes the source and compiled helper/manifest pairs before protected application imports and rechecks them at issuance/dispatch boundaries through the existing guard. This binds the expected installed closure and detects later drift under the existing host-exclusive-root assumption.

This is integrity binding and tamper detection, not atomic hash-to-execute pinning. The host hashes immediately before spawn and immediately after completion, but another writer able to replace and restore the executable between those operations can race execution. The reviewed helper itself does not provide an OS handle-based execute primitive, and this change does not claim to close that race.

## Final gates

- `npm run build`: PASS (TypeScript plus checked asset copy).
- Focused Vitest (`integration-journal-packaging`, `integration-installation-identity`, `integration-change-records-native`): 32/32 PASS after the final build.
- Scoped `git diff --check`: PASS (Git emitted only its existing LF-to-CRLF notice for `copy-assets.mjs`).
- Source and compiled helper: `cdc021fc3b912c771c54efa9ecd5c2ab6874a7d7d02bb15c2882cafb34f38555`.
- Source and compiled manifest: `7036911619f81a85d0850ca361ff883e8430afa079f46dbe24a9c264140920fb`.
- Host source: `2ba258d3d2d52f740f1a5649cf427094d7b6d8b56f080202712d1b78b471a100`.
- Copy script: `a128041458bb24b4ed542ea1418947f36c06fc774e86591b9b872aba8e166bbc`.
- Installation identity source: `2c8ca7a183594ff25251591c9fdccbe0fec13122e16ae8fc9209fda422711608`.
- Packaging test: `8e6a160ba34202057d9df30f9de62a146ba4124f2200f47c6d8ea934701c5aab`.
