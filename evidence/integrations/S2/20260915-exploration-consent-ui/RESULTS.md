# Explicit paid-exploration consent results

Status: implementation gate passed on revision 2.

- Fresh daemon build: `npm run build` from `daemon/`, exit 0. Raw output: `logs/build-pass1.log`.
- Focused gate: `npm exec -- vitest run test/integration-driver-core.test.ts test/p10c-renderer.test.ts test/p11-electron-surface.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, 3 files and 11 tests passed, exit 0. Raw output: `logs/focused-pass2.log`.
- Revision 1 focused gate had one assertion mismatch: the configured driver correctly returned `exploration_consent_required` before approval rather than the legacy approval text. The test expectation was narrowed to the configured case and rerun; no production change followed that failure. Raw output: `logs/focused-pass1.log`.
- `git diff --check` reported no whitespace errors (only existing Windows LF/CRLF conversion notices).

Measured behavior covers strict descriptor-safe Core options, zero-write missing consent, consent-plus-normal-approval atomic rollback and success in the actual injected driver/Core composition, ordinary local compatibility, exact IPC/preload forwarding with malformed inputs making zero Core calls, Korean subcap disclosure without internal digests, unchecked default, stale response containment, and reset on new preparation, error, ordinary preparation, and stop.

No live provider, model, native helper, Electron, browser, or network call was made.
