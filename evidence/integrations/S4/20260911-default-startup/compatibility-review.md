# Independent startup compatibility delta

Verdict: PASS for the reviewed delta; actual fresh Electron startup remains separate QA. The earlier review.md and its historical hashes are preserved.

Independent gate: `npx --no-install vitest run test/integration-start-entry.test.ts test/integration-default-startup.test.ts test/integration-protected-installation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 13 passed, 2.49 seconds at 2026-09-11 22:28:22 KST (tool b0448a).

main.mjs restores host-owned CUE_USER_DATA and CUE_WORKTREE_ROOT through initializeFirstRunConfig, preserving its existing persisted-config validation and workspace selection behavior. These process environment paths are host configuration, not renderer payloads. start.mjs rejects exactly CUE_LIVE_RUN=1 before invoking runGuardedEntry or the dynamic application import, reports a bounded error and exits 1; no automatic inference path is re-enabled. The VM-source test verifies the rejected branch without real Electron/model activity.

Parent package.json now names app/start.mjs, resolving the prior review's source-level activation gap. The guarded dynamic import followed by explicit startCueApplication remains intact. Tests still mock startup/discovery dependencies; this does not prove the actual project's SQLite addon ABI or fresh app window.

Follow-up regression noted to parent: p9.test.ts:20 still demands BrowserWindow text in the package main entry. That obsolete assumption should become a meaningful assertion of guarded start -> main initializer structure. It was identified by source read, not a newly executed P9 failure; no test was edited by this reviewer. Legacy live npm script remains configured but its CUE_LIVE_RUN flag intentionally rejects at the new entry; it must not be described as a successful current canary.

Hashes:
- app/main.mjs SHA256 D9CFA36A805DD99894AA5062728CD8F7777DB29448AE63CAFE34955F99D5CB4C
- app/start.mjs SHA256 DC44783D270EE849AF38C37D2944B992FD11E8151072715ACAB0D2B6CE323E94
- package.json SHA256 E31543E329CDC883BDD270B969F41E8C41D9F8A4FD1F397B0AF0D9B8FFC5FB42
- daemon/test/integration-default-startup.test.ts SHA256 3B35AF75FE12FEDD3C840295094BD85FCF6F22F48F25724C3F907785E4DADD2C
- daemon/test/integration-start-entry.test.ts SHA256 4D35E7EF04840D71FC55C391250EF057196B45A13533BA897B5592B4FA284A17
- app/protected-installation.mjs SHA256 482B241A542C8E4659512391328F9395534C0BC11F9E085A3CE1CAE6FCDC57AB
