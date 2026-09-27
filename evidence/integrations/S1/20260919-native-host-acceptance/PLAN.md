# Native host acceptance composition

Goal: the explicitly selected native existing-file workflow binds its checker and acceptance host from an immutable expected-artifact contract. A real SQLite Core/driver acceptance path must pass only after bound implementation and read-only verifier receipts, and fail closed for wrong bytes, missing verifier receipt, or changed contract. This is offline evidence, not live provider qualification.

Owned edits: `app/native-implementation-host.mjs`, its `.d.mts`, and new `daemon/test/integration-native-host-acceptance-wiring.test.ts` and `daemon/test/integration-native-host-core-positive.test.ts`. Preserve the legacy caller-supplied acceptance path. Reject caller acceptance/checker overrides when `workflow.expectedArtifacts` selects the built-in path. The contract must exactly match workflow target IDs, paths and byte caps, checker ID/revision and parameters digest. The producer principal derives from persisted account identity and an issued migration-050 receipt with matching attempt, launch subject and stage lineage; it does not claim current service authentication.

Attempt cap: two diagnosed production correction passes. Run focused native host, acceptance, new negative and positive tests, then the coordinated `npm run build` (which runs `tsc` and restores compiled asset specifiers). Only keep changes if the positive contract-bound acceptance and denial tests pass without regressing old-host tests; otherwise revert this unit or hand off with distinct hypothesis. An independent checker reviews final sources and evidence. The positive test uses real SQLite/Core preparation and acceptance, with manually persisted attempt completion and a mocked receipt issuer. It does not prove real driver launch, provider execution, or publication.

Pre-edit hashes were captured before mutation, but byte copies were not. `recovered-preimages/` contains reverse-patch reconstructions from the final owned files. Their SHA-256 values exactly match the captured pre-edit hashes; provenance is reconstructed, not a contemporaneous byte copy.

No model, provider, Qwen, service or network calls. Existing shared files and evidence remain untouched.
