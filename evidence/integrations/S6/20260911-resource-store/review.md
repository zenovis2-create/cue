# Independent durable resource store review

Verdict: PASS for the bounded durable resource store and migration registration. No implementation edits or model/network calls by this reviewer.

Independent gates:
- 2026-09-11 21:08:05 KST: `npx --no-install vitest run test/integration-resource-store.test.ts test/integration-resources.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 12 passed, 1.18 seconds (tool f0d064).
- `npm run build` in daemon: exit 0 (tool 6feac1).
- Actual Node ESM import of compiled ledger and openLedger(), without manually applying migrations, verified all four tables: resource_snapshot, resource_active, resource_run_pin, local_host_settings_snapshot. Database closed in finally; exit 0 (tool d43ee6). This verifies parent registration of 019/020 and build asset copying, not full app consumption.

Import exclusively calls the existing guarded loader. Its own-data input, pinned manifest/content, bounded strict UTF-8, path and actual symlink/junction refusal tests pass. Durable snapshots contain complete decoded text and provenance; read paths never reopen stored package paths. A BOM-stripped text snapshot is accepted only after reconstructing the exact hash-proven BOM bytes. Versions cannot be silently replaced after restart. Returned snapshots and nested entries are frozen.

Activation/removal append immutable events with previous event digest; removal is a tombstone and performs no source file deletion. Existing run pins remain immutable across version activation, removal, source deletion and database reopen. Missing runs, running tasks, approval events, sessions and orchestration attempts reject first-time pinning; existing exact pins may be replayed later without adopting new active state. Empty run pins are also persistent. Payloads, package counts and total run content are bounded.

SQLite UPDATE/DELETE/REPLACE/UPSERT protections are exercised for snapshots/events/pins. Nested transactions preserve caller rollback and no in-memory cache survives it. Persisted snapshot, latest active-event and pin corruption tests fail closed. Canonical snapshot and pin hashes are rechecked on reads. Import, activation and pinning have transactional read/write behavior; concurrent worker contention was not separately stress-tested.

Trust and scope limits: these remain declarative references, not execution policy, admission, hooks or knowledge retrieval. No endpoint, policy or secret writes occur. Protected database ownership is assumed. Latest activation reads validate that event and its immediate predecessor digest link; they do not recursively revalidate every older historical event after privileged trigger removal. This is not an arbitrary privileged-DB rewrite defense. Source metadata is imported through the strict loader; historical data is verified as the pinned canonical snapshot rather than re-fetching upstream provenance. The 32 active-package and aggregate run-byte limits reject listing/pinning when exceeded; importing many packages does not itself promise a usable active configuration. Root/driver integration must choose resources before approval; no actual resource injection into model context is claimed by these tests.

Source hashes:
- daemon/src/resources/store.ts SHA256 1F974E29544A1E9EB1CB6B1DD4CCC6CE6D623CA65EF3C4443427E827C28CAAD1
- daemon/migrations/019_resource_store.sql SHA256 264079BA8A5042EBE205BB063E72B8C783BC9B9326CA5B15B639467B3072608E
- daemon/test/integration-resource-store.test.ts SHA256 1349889C652D53B35DD15AA94C5A9A12854A4E2B98FBA1EB29D2076B63E38E96
- daemon/src/resources/packages.ts SHA256 E58BB3015FCB134DB84A88B9FA049DD4F7CB2FC2509719509D9531A3C5E3924A
- daemon/test/integration-resources.test.ts SHA256 3EDD465FC028BE94C6B66F9597B3412F1F391DA9057EC2B177D717F3EB9BA02D
- daemon/src/ledger.ts SHA256 D70316645107A3195AFE4D59FA9B7742591D1C2B48A59E8AE977AF2FAD8FF581
- daemon/scripts/copy-assets.mjs SHA256 2D9ECD368F235D6153ECD9EA1B6D8F808C5D33844871CCFF3209FC7E77A23666

## Parent registration follow-up and search interoperability

Additional requested gate: `npx --no-install vitest run test/p5.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, 17 passed, exit 0, 684 ms at 21:09:04 KST (tool 3ace5a). Actual compiled openLedger against a temporary disk database, close and reopen succeeded and contained all four 019/020 tables. SQL source/copy bytes matched: 019 SHA256 264079ba8a5042ebe205bb063e72b8c783bc9b9326ca5b15b639467b3072608e; 020 SHA256 3db8ff78f291aa9868edd5c886f6f2cd490b3bc91862c146deeefca8afa39195 (tool c80779).

Confirmed integration defect outside the reviewed store: real loader/store import of UTF-8 BOM + `reference` yields the preserved original byteLength 12 and BOM-stripped text length 9 bytes. Passing that valid persisted snapshot to createKnowledgeIndex currently throws knowledge_content_integrity at lexical.ts:64-65 (actual compiled Node reproduction, tool 9418eb). Thus store PASS does not establish BOM-compatible search. Parent and maker were notified to reconstruct only a hash-proven original BOM and preserve original byte offsets, with a connected regression. No lexical/source edit was made by this reviewer.
