# Independent Node CJS interop correction review

Result: no blocker found in this bounded correction. Independent focused suite: **11 PASS**, 2026-09-11 20:53:26 local time, including the actual Node subprocess import regression. No model/provider calls or canary invocation.

Reviewed hashes:

- `app/generated-json-host.mjs`: `203391DB2265D1850717A98EDF32D98925DFB33461110A36535FD9731F0A7630`
- `daemon/test/integration-generated-json-host.test.ts`: `C108D3588E06389C60FDB154C6C45576D5A05B824AD687FA2D251E0140425CDF`

The fixed checker exports a frozen CommonJS object via `module.exports = Object.freeze(...)`. The host now imports that default object and destructures `checkJsonFormat`, avoiding reliance on Node's inferred named CJS exports. The new regression spawns the actual current Node executable with ESM mode and dynamically imports the real host plus compiled dependency graph; it requires no child error/signal/stderr, exit 0 and the expected factory export marker. This exercises the module linker that the prior test-runner interop had masked. The remaining ten host tests also pass.

Command: `npx vitest run test/integration-generated-json-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`. An unrelated preceding read used the wrong working-directory-relative path and failed; the corrected root-relative source read succeeded. The test command itself completed with exit 0. Maker separately reports build exit 0.

History retained: the original live canary failed during module linking before model calls; prior static preflight did not execute that graph and missed this runtime import condition. This correction changes subject-bound host source and tests, so previous subject digests must be freshly measured in a new process before any live qualification. This review proves import compatibility and fixture host regression coverage, not a live workflow, new M evidence or Qwen output quality.
