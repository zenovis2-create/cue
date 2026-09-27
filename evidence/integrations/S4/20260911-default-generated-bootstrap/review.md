# Independent default generated JSON bootstrap review

Verdict: PASS for the protected read-only bootstrap composition. No blocking defect found. The mandatory loaded-installation guard is an authority seam, not a supplied implementation or live identity proof. Main startup is not wired by this unit.

Completion gate: read-only review of the three maker files, focused composition/core tests, typecheck and source hashes. Review cap 1; any diagnosed correction goes to the maker. Reviewer wrote only this artifact. The settings-v2 store was authored by this reviewer previously and separately reviewed by another agent; this verdict covers its consumption by this different maker's bootstrap, not self-approval of the store.

Independent validation, 2026-09-11:
- cwd daemon: `npx --no-install vitest run test/integration-default-generated-json-bootstrap.test.ts test/integration-driver-core.test.ts test/integration-selection-preference-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 20 passed, started 21:39:55, duration 2.18 s.
- cwd daemon: `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Bootstrap SHA256 C7F60CAACDD8CC0044680FBDF39B931E93BFE6B556834C16B0B032F41B54876C.
- Declaration SHA256 A06E68B6147F1A7D2FC786D49C99B46DF01E83FD3192CDEAAD73128A958DD0CC.
- Test SHA256 24F9C983405F7E2B8E7F2E948F29787AF402A219A19AB0F5FC9D669040A909D9.
All three match maker final hashes.

Confirmed contracts:
- Fixed settings identity, V2 only, enabled intent, four exact persisted local policy references, same producer/checker pair, exact settings-versus-policy count and duration. A narrower requested limit is rejected, not silently increased. No monetary estimates or quality scores are fabricated.
- Uses the actual context DB for settings, local policies, evidence references and evidence resolution. Startup and host input preparation are proven write-free by total_changes checks, with no attempts or budgets created. Host success is unwrapped correctly; unavailable remains the core's explicit DTO, with no legacy fallback.
- Discovery paths and loaded runtime identity are validated. A missing or asynchronous loaded guard never grants readiness. Current subject construction and evidence resolution remain the production functions; no public fixture/factory/measurement override is exposed.
- The loaded guard runs before and after each current-subject scan. Current digest drift rejects, and a later guard failure makes catalog lookup unavailable. Snapshot context now includes frozen discovery path descriptors so the protected validator can explicitly bind actual loaded roots to the measured installation.
- Settings revision/digest is retained in the accounting source, approved input is bounded through the generated host template, and output caps are passed from settings. Existing immutable revision behavior is preserved; this bootstrap is a startup snapshot, not a hot settings-reload mechanism.
- No collector import/call, model request, network request, qualification publication, main activation or IPC extension is added by this file. Protected readiness callbacks remain responsible for genuine authentication/resource/quota observations.

Limits: test measurement and bundle modules are mocked; synthetic live-shaped evidence exercises admission rejection/composition, not actual M qualification. The test's true loaded guard is not evidence of loaded-code identity. A production entry point must implement the frozen-installation/process-start guard, including the actual control root, Electron/runtime identity and SQLite ABI, before passing it here. Full disk measurements alone cannot validate stale already-imported modules. Fresh-process setup/qualification and a real approved workflow remain separate unfinished gates. No compiled source was manually inspected as part of this bounded review.

