# Independent correction-4 preflight — exact publication-intent binding

Verdict: **CLEAR for inclusion in the later combined source freeze. No actual run is authorized by this review alone.**

Reviewed 2026-09-15 (Asia/Seoul). This was a source and supplied offline-evidence review only. No actual/OS termination, build, provider, Electron, local-8085, or network operation was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `0fbba6f74353d6bac91a6ea29f0136ca07b1a703da8514a55c1a23aa827ee879` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `a2c5ccd9d4dfdb76e98f4d6a49daeb08228aa11fa4bcdc983fe53f693eb41677` |

## Binding audit

- `resolvePublicationIntent` is exported as a pure binder and the executable fixture body is protected by the `import.meta.url` entry check. Importing it in the focused test does not open the ledger, acquire ownership, launch a provider, or execute the fixture scenario.
- The durable lookup binds the captured attempt ID to all native callback facts available before the write: worktree/root identity, relative target, maximum bytes, preimage identity/length/hash, and replacement length/hash.
- The binder requires exactly one matching row. Zero and multiple rows fail with `public_driver_restart_intent_binding` before `writes++` and before `compareWriteExistingNative`.
- It requires a Buffer payload whose SHA-256 equals the stored `payload_sha256`, parses the JSON, and revalidates publication ID, attempt ID, root/path/limit, root and preimage identities, preimage length/hash, and replacement length/hash. A bad stored hash and malformed or mismatched lineage therefore fail closed before the native write.
- The effect response is built from the exact resolved object and contains `publicationId`, `payloadSha256`, and the payload bytes decoded as UTF-8. The response also queries intent/result counts with the resolved publication ID. This directly corrects actual 1's undefined callback-field query.
- The focused binder test checks the exact SQL argument sequence, successful returned ID/hash/payload, duplicate refusal, missing refusal, and corrupt-hash refusal. Static payload checks cover wrong attempt and native lineage values.

## Offline evidence

The maker's frozen evidence records:

- Fixture `node --check`: exit 0.
- TypeScript `--noEmit`: exit 0.
- Focused Vitest: exit 0; 4 passed and 1 actual-gated skipped.

These commands were not repeated during this review. Root build 2 was reported separately and is outside this fixture-only preflight verdict.

## Evidence limitation

`correction4/preimages.json` honestly records metadata-only source preimages. Complete pre-correction source bytes were not copied before mutation, so no byte-for-byte source preimage or reconstruction is claimed. The full actual-1 log, observation, and cleanup artifacts remain preserved in place with hashes matching the prior independent review. This limitation does not invalidate the pinned current-source review, but it must remain visible in the final evidence chain.

Correction 4 is **CLEAR** at these two pins. Actual 2 must still wait for the root's combined final source freeze and all other active product gates/reviews.
