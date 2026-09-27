# Known regression failures repaired — root suite PASS

## Current-source result

The **unfiltered root `npm test` passed** after the corrections:

- **309 / 309 files passed**.
- **2,261 tests passed, 0 failed, 10 existing conditional skips** (2,271 total).
- Exit **0**, no outer timeout, source bytes unchanged during the run.
- Vitest duration **1,717.58 seconds**.
- Wrapper interval: 2026-09-26 23:54:57 → 2026-09-27 00:23:39 KST, including daemon pretest/build.
- Evidence: `whole-suite.log`, `result.json`, `invocation.json`, `source-before.json`, `source-after.json`.

Unlike the previous completed grouped baseline and incomplete 30-minute root run, this is a successful single root invocation. No file/test-name filters or per-test timeout changes were used. The outer budget was 60 minutes; the run finished in about 29. The original grouped failures and earlier root timeout logs remain untouched.

## Known failures now covered by the root pass

`closed-failures.log` indexes the formerly failing tests:

1. Duplicate execution and unapproved execution expectations now match the earlier session-epoch guard, still proving no extra execution/session authority.
2. Three quarantined-writer cases now require refusal at approval as well as execution, no new events, and retention of the original writer lease.
3. The goal-proposal bug fixed in the preceding slice now passes in the full run: tamper rejection and approval claim share one transaction, so rejection preserves approval and creates no attempt or execution event. Cleanup assertions no longer mask the original error.
4. The Codex manifest proof now uses actual approved 0.154.0 bytes found in the already installed standalone package rather than assuming the globally installed CLI still has that version.

Prior native-identity timeout and writer-lifecycle cases also pass here. One successful regression does not prove all possible timing variability is eliminated.

## This slice's implementation

- `daemon/scripts/pinned-codex.mjs`: resolve the existing npm-global and standalone locations against the **unchanged** audited SHA-256. An explicit `CUE_VENDOR_CODEX` must be absolute and match the pin; missing/mismatched overrides never fall back. Caller-supplied hash values do not override the manifest pin. No download or installation mutation.
- `daemon/scripts/p10c-manifest-proof.mjs`: stage the approved executable in an owned temporary vendor directory, rehash the staged copy before launch, and record source path/type plus snapshot hash in the receipt. This preserves `assertVendorBinary`, including its protection against launching from a `.codex` path.
- Publish the proof only **after** local teardown succeeds. A successful capture followed by failed cleanup no longer leaves a new PASS receipt.
- Tests: 11 synthetic resolver-decision cases, plus real manifest capture and negative cases for explicit mismatch, modified staged bytes and post-capture cleanup failure. The existing two manifest tests remain; no genuine proof was replaced by a fixture or skip.
- `README.md`: document the manifest-only lookup, exact pin, explicit override refusal and credential-free loopback scope. The application's configured/default executable selection is unchanged.

The selected standalone binary hashes to `be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde`, matching the previously audited 0.154.0 artifact. The global 0.157.0 installation remains untouched and unqualified by this work. The legacy cue-toolchain candidate (`cf682658...`) was inspected and rejected, not used.

## Preserved implementation failures and validation

- First build succeeded; `focused.log` recorded **1 failed / 45 passed**: direct use of the standalone path violated the existing vendor-path guard. The second correction stages/rechecks owned bytes instead of relaxing the guard.
- The first cleanup-failure test could have failed before capture; its passing result was insufficient. The final fixture explicitly writes and verifies a capture marker before injecting the cleanup error, so it now proves the intended ordering.
- `focused-final.log`: **6 files / 46 passed** after staging and capture-marker corrections.
- `pin-final.log`: **2 files / 16 passed** after adding the staged-byte drift case.
- Final root pass above includes all final cases, so overlapping focused counts are not summed.
- Preimages and `change.patch` preserve local changes. The helper and resolver test are new files. Scoped README whitespace check passed; Git's broad dirty-tree check reports preexisting Markdown hard-break whitespace, which was not cleaned up as unrelated work.

## Limits

No external model/provider request, model inference, checkpoint download, real credential copy, new tool qualification, commit or publication. The real Codex process talks only to a fresh loopback fake API for this proof; it does not execute workspace tools. Default app provider setup may still require explicitly configuring its approved executable—this change does not silently reroute production dispatch.

This closes the **known regression failures**, not every possible product bug. Actual provider-consumed-input proof, complete measuredFactHost/accounting, remote cleanup/final billing, independent review and real-user/accessibility acceptance remain separate open gates. No original checklist item is closed merely by this green suite.
