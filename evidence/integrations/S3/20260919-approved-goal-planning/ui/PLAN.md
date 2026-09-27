# UI/IPC two-approval implementation plan

Done means: planning is an explicit selectable goal flow; unavailable planning is disabled; first approval starts planning only; a completed planning card with backend `planning.readyForExecution` and released ownership enables preparation of a distinct execution run; second approval is a separate click. General and JSON flows retain their existing behavior. IPC accepts only exact bounded plain commands and trusted senders. The renderer passes only `planningRunId`, autonomy, and selection mode to Core for conversion.

Attempt cap: two implementation passes. Every pass runs focused IPC/renderer tests and the existing electron-surface and JSON UI tests. Failure changes the hypothesis before retry; regressions are removed. Root owns the broader build. Independent reviewer checks the diff.

Owned source: `app/ipc.mjs`, `app/ipc.d.mts`, `app/preload.cjs`, `app/renderer/index.html`, `app/renderer/renderer.js`, optional styles, dedicated tests, and the exact IPC-channel expectation in `daemon/test/p11-electron-surface.test.ts`. Exact preimages are preserved in `preimages/` before edits.
