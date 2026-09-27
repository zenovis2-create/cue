# Late regression execution plan — NOT STARTED

Authorization state: preparation only. No build, test, model canary or application startup has been executed for this gate. Wait for parent's explicit start signal after source freeze and UI/native QA completion. One full-run cap; no automatic broad retry. Preserve the historical 20260911-current-regression directory unchanged.

## Commands after start authorization

Working directory C:/Users/User/cue/daemon.

1. `npm.cmd run build`
2. Only if build exit 0:
   `npx.cmd --no-install vitest run --exclude **/p10c-manifest.test.ts --reporter=verbose --reporter=json --outputFile.json=../evidence/integrations/20260911-late-regression/vitest-results.json --fileParallelism=false --maxWorkers=1`

Pipe each command's complete stdout/stderr to separate build.log and vitest-full.log with Tee-Object; preserve LASTEXITCODE immediately, write build-result.json/run-result.json with exact command, UTC start/end and exit code. The single explicit exclusion is the user's pinned Codex manifest test; no other failing test will be omitted. Do not run npm test because its pretest would duplicate the build.

Poll owned exec sessions at most 30 seconds per wait and communicate at least every minute. Preserve existing per-test timeout definitions; do not widen them. Build observation deadline 5 minutes; full-suite observation deadline 30 minutes (prior full run 684.69 seconds). If a deadline is exceeded, preserve logs and report the exact owned session/current test as timed out or stalled for focused diagnosis. Do not globally kill Node/Electron/PowerShell or start a second full run; any termination must be scoped to verified owned process identity and retain uncertain cleanup status. An elapsed outer deadline is not a test PASS or proof of clean teardown.

## Source and environment evidence

Immediately before the build and after terminal tests, enumerate using rg --files: app, daemon/src, daemon/migrations, daemon/test, scripts, daemon/scripts; add root/daemon package.json and package-lock.json plus daemon/tsconfig.json. Normalize slash paths, sort/deduplicate, hash SHA256, save source-hashes-before.json and source-hashes-after.json plus added/changed/removed delta. These are source/test/config/script inventories, not a complete runtime qualification manifest. Do not read node_modules/dist/.git/dependency source. No filesystem source inventory is claimed current until execution begins.

At start, record names (not secret values) of relevant environment flags and refuse to proceed if CUE_RUN_ORCA_READONLY, CUE_VENDOR_CODEX, CUE_LIVE_RUN or other live opt-in flags are enabled without a new explicit decision. Preparation scan found no environment names matching ^(CUE|RUN_LIVE|LIVE_|TEST_LIVE|QWEN). Recheck because the environment may change before execution.

Expected normal Windows conditional skips, separate from explicit file exclusion:
- p4 installed Orca readonly probe: CUE_RUN_ORCA_READONLY absent.
- p4 real vendor Codex probe: CUE_VENDOR_CODEX absent.
- p45 OS cwd query: Win32_Process exposes no cwd.
- p6 external Buzz delivery/@cue registration: explicit external-mutation skip.
- p7 external artifacts share/real Orca capture: explicit external-system skip.

Windows-only native fixture tests should execute on this Windows host. Record actual JSON-reported skips; expected five is not permission to hide any additional skipped test.

## Live-call boundaries checked during preparation

Model qualification tests inject fixture subject/transport and issue fixture-only evidence. Generated JSON host/local-host tests inject synthetic executors/evidence; they do not call Qwen. Protected installation discovery tests mock fetch, filesystem/native cache and PowerShell. Explicit qualification operation tests use module mocks; collector native probes use controlled fixtures. Start-entry live flag case is a VM source rejection fixture. Native sandbox, process ownership, controlled TCP denial and actual fixture Electron windows do execute, so other canaries/profile-sensitive QA must be serialized. Do not invoke scripts/reuse live qualification/canary utilities or legacy live npm scripts as part of this suite.

## Completion receipt

Report original terminal counts, failed test names/assertions, skip list and exact exclusion; source drift; teardown inventory before/after (model/worker profile names and owned process identities, no global deletion). Categorize failures into product defects, fixture/environment regressions and stale expectation contracts only when evidence supports that diagnosis. Do not rewrite a failed broad gate as PASS after focused corrections. Preserve original logs/JSON, make any subsequent focused correction gate a separate receipt and obtain parent ownership for source changes.
