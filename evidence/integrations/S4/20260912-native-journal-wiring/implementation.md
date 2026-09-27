# Native journal wiring implementation evidence

Date: 2026-09-12 KST

The trusted host preparation path now registers exact per-task target declarations and a native root identity before approval. Migration 038 seals the target inventory into the immutable root payload, binds each change set to that root/helper identity, marks pre-migration attempts legacy-unavailable, and rejects mutation or observation after a final held seal.

Writable stages are detected from the persisted stage envelope's `file_change` authority. Their launch-intent transaction requires the preapproved journal and captures the native preimage before the runtime launch callback. Missing targets, root replacement, helper drift, native uncertainty, or malformed replay throws through the engine transaction, so claim, reservation, stage binding, launch intent, and journal rows roll back together. Read-only/model/checker stages do not journal.

Terminal reconciliation performs a fresh complete native observation before retry or completion advancement. Unknown facts block the run. Observation batches use monotonically increasing timestamps for repeated host times, reject partial insertion transactionally, and never use pathname fallback. Exact replay verifies hashes and scalar bindings for the change set, native binding, every entry and preimage, and the recomputed manifest.

## Gates

- Required focused Vitest gate: PASS, 52/52 tests across 5 files.
- `npm run build` in `daemon`: PASS after final source edits.
- Scoped `git diff --check`: PASS; Git emitted only the existing LF-to-CRLF checkout warning for `daemon/scripts/copy-assets.mjs`.

## SHA-256

- `038_s4_native_change_journal.sql`: `3C7EB9A2887D950DE8E9D130B451F136B1C1D9808438DD87E1CD7EC69A25828E`
- `change-records.ts`: `2643A84C96144B9174CD39DA4562AC2F932C667F22C1F10DA5A23E89F0D31240`
- `ledger.ts`: `827EAC9D7D39D8FA34784C1DB64169E362126EDEE51F8232D22607A83A7FE008`
- `orchestration-driver.mjs`: `7E616E4474FF57A33C14608BD1C97D680A4BEA62BE65C92B9CF61E435D156A3B`
- `orchestration-driver.d.mts`: `A2E6FF7094E81CC7F90B1EC43B38F02BAC11AED2031750B204F6BD2AD4A3088F`
- `integration-change-records.test.ts`: `B76CB89CF8BC6246782449CEC52F115F0CECE5C22F35BC8EC354F08E777D35B6`
- `integration-driver.test.ts`: `F6CAA48286795BECA457711CFF454FDB840BD12D70F27866D757D479BC1945B7`
- `integration-driver-core.test.ts`: `A290B5BF5201646BF3EA4F99F9BF22E885AC072E3C3040CB2A79B1CBA7ACD165`

## Limits

This is a Windows read-only snapshot journal. It does not supply restore/delete/replace CAS, automatic recovery, or verification-pass authority. Native capture is one database transaction but is not an OS-atomic snapshot across multiple target files. Every task uses one common native read cap and `targetCount * cap` cannot exceed 16 MiB; different tasks may have different caps. The helper digest is installation-bound drift detection, not publisher provenance or atomic hash-to-execute pinning.
