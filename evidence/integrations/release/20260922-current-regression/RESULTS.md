# Batch89 — current whole-suite regression

Date: 2026-09-22. Executed directly by the current assistant. **Self-review, not independent review.**

## Result

The root **`npm test` passed on its first invocation**, with no product/test edits or corrections:

| Check | Observed result |
| --- | --- |
| npm / daemon pretest build | exit 0 |
| Whole test command | exit 0 |
| Test files | 296 passed / 296 discovered |
| Test cases | 2,055 passed, 0 failed, 10 existing skipped (2,065 total) |
| `release.test.ts` | 14 passed, included in the 2,055 above |
| Elapsed | 1,505.24 seconds (~25 min) |
| Start | 2026-09-22 16:28:15 local host time |
| Implementation/test/build input pins | all 710 unchanged after the run |
| Test-file coverage reconciliation | missing 0, unexpected 0 |

This is one complete invocation, not the union of selective reruns. Do not add the release test count or earlier batches' counts to this total. No assertion relaxation, added skip, timeout increase, correction hypothesis or blind rerun was required.

## Reproduction and evidence

Windows host, Node `v24.18.0`, npm `12.0.1`. From repository root:

```bash
unset CUE_PROVIDER_INSTALLATION_LIVE_TEST CUE_VENDOR_CODEX CUE_RUN_ORCA_READONLY CUE_ACTUAL_PUBLICATION_RESTART CUE_ACTUAL_PUBLIC_DRIVER_RESTART CUE_LIVE_RUN
npm test
```

The root command forwards to the daemon pretest build and `vitest run --reporter=verbose --fileParallelism=false --maxWorkers=1`.

- `npm-test-pass1.log`: complete stdout/stderr; `npm-test-pass1.exit`: actual exit status.
- `summary.json`: counts, executed coverage, all skipped test names and explicit nonqualification flags.
- `executed-test-files.txt`: actual verbose-output file set, compared with recursive discovery of `daemon/test/**/*.test.ts`.
- `source-before.sha256` / `source-verification.log`: byte equality for all 710 files under app, daemon source/tests/scripts/migrations/evaluation, root scripts and build/package configuration.
- `status-before.txt` / `status-after-tests.txt`: no status-line additions/removals from the test run. This alone is not a byte-diff claim for previously dirty evidence; the stronger source-byte check is separate.
- `notable-lines.txt`: release/manifest/denial test observations and skip locations.
- `preimages/`: exact checklist/progress documents before the new overlay.

## Existing skips (unchanged)

1. Windows OS cwd observability (`p45`).
2. Non-Windows missing-snapshot-helper branch, inapplicable on this host.
3–4. Explicit opt-in public-driver restart and publication restart actual gates.
5–6. External Buzz delivery and artifact sharing/Orca capture.
7. Explicit opt-in installed Orca readonly operation.
8. Explicit opt-in vendor Codex AppContainer launch.
9–10. Explicit opt-in installed Claude/Codex installation probes.

No skip was introduced or removed. All test bytes match the pre-run snapshot.

## Scope and limitations

The suite includes real temporary SQLite/Git state, owned Windows processes, native filesystem/containment/termination checks, and synthetic RPC/loopback transports. The manifest test launches the pinned installed Codex CLI against a fresh **unauthenticated local fake provider**, not a real service/model/account; its two tests passed. Existing denied outbound-access tests also ran; this is not a claim of zero socket activity. Test teardown assertions passed, but there was no machine-wide orphan scan or cleanup of historical retained roots.

Qwen was not probed/restarted, production Claude was not launched, real model/account service calls were not authorized, and the subscription allowance remains 4/4 spent. No credentials were copied from a real user profile, no independent agent was delegated, no commit/push/publication occurred, and historical blocked cleanup was not retried.

This closes the **current whole-suite regression prerequisite**, not the original combined release acceptance item. Current provider/account/runtime qualification, real manual-baseline and four-mode paired holdout trials, authoritative remote cleanup/final billing, and independent review of recent changes are still missing. Earlier source-scoped independent reviews are historical, not an independent review of this run. The exact-edit mini-workload is still a pipeline fixture, not representative evidence of optimization.

Original parent status remains **44 total, 33 closed, 11 open**. No new parent checkbox is checked. No product change was necessary in this batch because the current suite was green. The next live qualification step needs an explicit renewed scope and call budget; this run does not grant it.
