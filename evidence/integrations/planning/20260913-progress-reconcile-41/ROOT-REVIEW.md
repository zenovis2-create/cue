# Reconciliation 41 root audit

PASS for historical saved comparison lookup at the IPC/DOM/Core component level.

- [Independent review](../../S5/20260913-comparison-read-ui/review.md): main focused gate 9/9 across two files. Post-copy UI gate 8/8 overlaps that gate and is not added. Actual SQLite Core snapshot reaches registered IPC before preparation; a foreign workspace receives generic denial. Strict DTO, current-run gating, stale/error clearing and truthful Korean comparison counts/status/limits are verified.
- [Maker evidence](../../S5/20260913-comparison-read-ui/maker.md): build passed; syntax/focused checks passed again after the copy-only refinement. Initial foreign-workspace fixture failures remain preserved. Actual Electron visual QA was not run.
- Root verification `de79ab`, exit 0: six final source/test pins, six full preimages, review hash and four document hashes verified. All 409 local Markdown links resolve.
- Scoped diff check `0c8b02`, exit 0; Git reported line-ending conversion warnings only. [RESULTS.json](RESULTS.json) contains final exact hashes and scope.

User steering is persisted: local model is temporarily off, local-model work deferred, with no endpoint probe or restart. This unit adds manual lookup by a known saved comparison ID only. Listing, creation, measured improvement, policy promotion and broad S5/S0-S7 completion remain open. No model/native/network/live Electron call, consumed gate retry, commit or push occurred.
