# S4 native journal packaging independent review

Verdict: **PASS for the packaging and installation-generation subunit**.

The reviewed helper has a fixed execution digest in both the source host and build copy step. The checked manifest binds that artifact to its protocol/platform/architecture, reviewed source hashes, license notice, and prior independent review. Compiled code resolves only its copied `dist/native/change-snapshot` closure; missing, mismatched, or malformed copied trust inputs leave the helper unavailable. This review does not claim publisher authentication or atomic hash-to-execute protection.

## Verified behavior

- `change-snapshot-host.ts` hardcodes helper SHA-256 `cdc021fc3b912c771c54efa9ecd5c2ab6874a7d7d02bb15c2882cafb34f38555`. It accepts metadata only when the local manifest names that same digest and the actual executable bytes match it.
- The compiled module path resolves from `daemon/dist/src` to `daemon/dist/native/change-snapshot`; there is no source-tree fallback. An isolated compiled-host fixture succeeds with only copied dist assets and fails closed when its helper is absent/changed or its manifest artifact binding changes.
- `copy-assets.mjs` validates the artifact and all five manifest source entries before copying, copies the helper and manifest to their fixed dist directory, then rehashes both copied assets. It also copies migrations 037 and 038.
- Installation generation inventories both source and compiled helper/manifest pairs. The canonical guarded entry captures generation before invoking the protected application loader, and existing issuance/dispatch boundaries call `assertCurrent`. Independent fixtures show drift in each native asset rejects without executing loader/native bytes.
- Source and compiled native assets match exactly after the reported build. Migration 037 remains byte-identical to its previously reviewed immutable source and copied asset; migration 038 is also byte-identical to its copied asset.
- The prior native seam remains green on actual benign Windows files. No journal-wiring regression is attributed to this packaging review.

## Independent gates

- Focused packaging, installation-identity, and real native snapshot suite: **32/32 PASS**, exit 0.
- Scoped `git diff --check`: exit 0, with only Git's existing LF-to-CRLF notice for `copy-assets.mjs`.
- Maker build result was inspected: TypeScript plus checked asset copy passed. This checker did not repeat the global build because another worker owns the concurrent global build boundary; exact post-build source/dist hashes were independently recomputed.

## Exact hashes

- Source and compiled helper: `CDC021FC3B912C771C54EFA9ECD5C2AB6874A7D7D02BB15C2882CAFB34F38555`
- Source and compiled manifest: `7036911619F81A85D0850CA361FF883E8430AFA079F46DBE24A9C264140920FB`
- Source and compiled migration 037: `40DB0AF5DB2AAD8BCE52A4DFED1219A2A1EC68BA4A11D8E447237044D10C927A`
- Source and compiled migration 038: `F62CC48C2C721C10F25C64B464DEEBA228BFB52B99AE7CE3114F57A66FB11491`
- `change-snapshot-host.ts`: `2BA258D3D2D52F740F1A5649CF427094D7B6D8B56F080202712D1B78B471A100`
- `copy-assets.mjs`: `A128041458BB24B4ED542EA1418947F36C06FC774E86591B9B872ABA8E166BBC`
- `installation-identity.mjs`: `2C8CA7A183594FF25251591C9FDCCBE0FEC13122E16AE8FC9209FDA422711608`
- Packaging test: `8E6A160BA34202057D9DF30F9DE62A146BA4124F2200F47C6D8EA934701C5AAB`
- Installation-identity test: `8AC16479DFAA286B1175D52AD97D70DEE52DC7E0945C9297D4A92324EEACE16C`
- Native snapshot test: `F253E20DA66716FD48C765C9F1DB926D5DA383B3688E6310AACB8A0DC53737A9`

## Boundary and prerequisites

The manifest's whole-file digest is recorded and generation-checked rather than independently publisher-signed or hardcoded. Its source provenance therefore depends on the trusted repository/build and guarded installation-generation boundary. The executable digest is the fixed runtime authority. The pre/post execution hash checks remain tamper detection under exclusive installation ownership; they do not make hash-to-spawn atomic against a writer that can replace and restore the executable inside that interval.

Journal wiring may consume the frozen helper metadata next only if it persists the exact protocol/digest/root identity with the approved target contract, treats unavailable/unknown as held, binds results to the exact ordered targets, and does not add a source fallback. Restore/CAS and publication remain separate unapproved capabilities.

