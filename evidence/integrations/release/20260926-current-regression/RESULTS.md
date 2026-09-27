# Current-source regression — 2026-09-26

## Verdict: full regression incomplete; one stale fixture corrected

The unfiltered root `npm test` was run from 18:27:04 to 18:57:08 KST. It did **not** complete within the declared 1,800-second outer limit. The owned npm process tree was terminated (`taskkill` status 0); runner exit was 124 and the terminated child exit was 1. No Vitest final suite summary exists. The test runner was still producing results near termination; this is not evidence of a deadlock.

`partial-counts.json` records only printed results: **375 passed, 2 failed, 1 skipped**, across **39 files with reported tests**, from an inventory of **308 test files**. These are partial counts, not a completed-suite denominator or a pass rate. The rest remain unverified by this invocation.

## Source and authorization

- Base HEAD: `8e2afa6366e3af62f7115b2c67be799130f8dfdf`, with extensive preexisting tracked/untracked changes preserved.
- `source-before.json` and `source-after.json` are identical byte-hash inventories during the root invocation. `source-final.json` differs only in `daemon/test/p10c-core.test.ts` after the fixture correction.
- Standard root scripts ran daemon build and single-worker Vitest without source/test exclusion overrides or timeout changes.
- Inherited live/Orca/restart opt-ins were cleared. Native/model-boundary tests use synthetic fixtures. The pinned Codex manifest path is configured to a local loopback fake HTTP service, not an external provider.
- No new provider/model request, checkpoint download, inference, commit or publication. No blanket process-name cleanup: the outer timer targeted only its own live child tree. This does not establish absence of all escaped native processes, profiles or temporary resources.

## Failures and bounded investigation

### 1. Duplicate approval fixture — corrected, production checks unchanged

Root failure: `p10c-core.test.ts` expected `/already consumed/`, but current `claimApproval` rejects the second execute earlier with `approval_session_unavailable`. The assertion happened before cleanup and the fixture's deletion then also reported EPERM.

Source trace confirmed the exact single-use transition in `app/core.mjs`: `approved` → `executing`. Existing workspace-management/driver tests already require the new refusal code.

- Correction 1 aligned the expected refusal, added an approval-state assertion, and guaranteed awaited `core.close()` in `finally` even if an assertion fails.
- Its first focused run caught an error in the newly added assertion: it incorrectly expected `consumed`, not the actual `executing` value. This failed log is retained in `focused-correction.log` (1 failed, 2 passed, 16 filtered/skipped).
- Correction 2 fixed that literal to `executing`; no production authorization, locking, termination, or timeout code was changed. No further correction hypotheses were used.
- Final test still verifies exactly one execution event, waits for the owned worker, stops it, verifies owned PID absence and checks release of the write flag.

### 2. Native process identity timeout — not reproduced in isolation; root cause unresolved

The root run's exact FILETIME/owned-tree test exceeded the existing 30-second timeout (reported 35,054 ms). No production or test timeout was increased and no identity validation was relaxed.

The unchanged two-test file passed in the first focused run (native case 10,079 ms) and in the final selected run (10,648 ms). This supports context-dependent timing variation, not a proven explanation or full-suite resolution. Do not label it fixed or promote the isolated passes to a root pass.

The previously troublesome `p11-writer-lifecycle` tests all printed passes in the partial root run; this too is only evidence for those cases, not the whole suite.

## Final selected verification

`build-final.log`: build exit 0.

`focused-final.log` / `.exit`: **4 files, 37 tests passed, 0 skipped, exit 0**, 215.07 seconds:

- `p10c-core.test.ts` — 17 tests
- `host-runtime-native-identity.test.ts` — 2 tests
- `integration-workspace-management.test.ts` — 14 tests
- `integration-driver-core.test.ts` — 4 tests

`git diff --check -- daemon/test/p10c-core.test.ts`: exit 0. Preimages and `change.patch` retain the precise correction. Overlapping runs are not added together.

## Next step / limits

A complete current-source regression is still required. Rather than silently extending timeouts or repeatedly restarting the slowest native cases, freeze the source manifest and partition all discovered files into explicit serial groups with per-group results and a coverage reconciliation that proves no file was omitted. That would be grouped coverage, not an unfiltered root invocation; an eventual root pass must be identified separately. Investigate native identity timing under suite load without weakening freshness/ownership checks.

This slice closes no live-provider, measured-performance, consumption, final-billing, accessibility or user-acceptance gate. Historical successful root runs remain historical.
