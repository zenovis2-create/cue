# Independent resource/core integration review

Result: no actionable blocker found in the bounded core integration. Independent checks: **4 resource-core tests PASS** at 2026-09-11 21:15:13 local time, plus **13 existing core/selection/report tests PASS** at 21:15:41. No product edits or model calls.

Reviewed SHA-256:

- `app/core.mjs`: `2CC282BE861E3A302598651E73DB37CA538FF9FDA1E3A1ED84330B9E81DF55B0`
- `app/core.d.mts`: `BFE38C38DFE48BA0245DF3776AFBE171D1D44E17B249C3D1BE4D4AB004672BFD`
- `daemon/test/integration-resource-core.test.ts`: `951BC5A6C3A0C9BED8833A9AA7B0B8DF2BA697E897BD63F8673C37FE1F19E383`

Import/remove/list delegates to the same core ledger's resource store and exposes frozen package metadata, not content-derived execution authority. Import/search object arguments reject proxies, non-plain objects, extra keys and accessors without invoking getters. Run pin/read/search require a known run and an existing immutable pin; missing or unpinned runs do not fall back to active packages.

Preparation always creates a pin, including an empty pin, inside the existing outer preparation transaction. Failure after pin insertion rolls back the task, run, pin and approval state together. The internal orchestration run object retains its existing shape; only returned approval metadata gains a resourcePin when packages are nonempty. The original execution envelope and orchestration authority are not expanded by resource content.

Runtime tests confirm old pinned bytes survive package update, removal, deletion of source files and reopening the actual SQLite database. BOM-containing Korean text preserves original source-byte SHA and byte-range quotation identity. Search hits remain reference-only with explicitly unverified remote-source claims. New runs observe the updated active version while prior pins stay fixed.

Focused commands from daemon:

- `npx vitest run test/integration-resource-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 4 PASS.
- `npx vitest run test/integration-report-app.test.ts test/integration-driver-core.test.ts test/integration-selection-preference-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 13 PASS.

Existing report export/junction protection, report IPC/window restrictions, generated and legacy host composition, unavailable-host behavior, policy preferences and approval snapshots all passed the relevant regression checks.

Build limitation: this reviewer intentionally did not run the shared build, per root coordination. Another worker is correcting migration 022 before the coordinated build; these tests used the already-built resource dependencies. Maker separately reported its earlier build and 12-test gate. No active prompt insertion, resource-driven tool permission or remote source authenticity is claimed by this integration.

Coordination update: transport_review subsequently reported the shared build completed with exit 0 after migration 022 and unrelated engine/settings type corrections. This is the build owner's result, not a repeated independent build. The reviewed resource-core source hashes remain the scope of the test results above.
