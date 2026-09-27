# Repair known regression failures and rerun root suite

## Scope

Preserve the prior complete grouped baseline (308 files, 2241 passed / 6 failed / 10 skipped), its corrections, all dirty/untracked work and logs. Resolve the remaining Codex manifest prerequisite without changing the audited hash, skipping the proof, downloading software, or changing the global CLI installation.

Read-only inspection located exact `be96b992...` bytes at `%LOCALAPPDATA%/Programs/OpenAI/Codex/bin/codex.exe`; the path resolves into the existing standalone 0.154.0 package. A previously documented side-by-side cue-toolchain path instead has the older `cf682658...` hash and is not selected.

## Bounded corrections

1. Resolve only the existing fixed npm-global/standalone locations against the same audited SHA. Honor an explicit override strictly, with no fallback on override errors. Record the chosen source/path in the manifest proof. Unit resolver fixtures do not claim authentic binary measurements.
2. Direct standalone launch initially failed the existing vendor-path guard. Preserve that guard: copy the approved bytes into an owned temporary vendor directory and rehash the copy before launching. No profile credentials are copied. Stage-drift and explicit-override negative tests refuse before proof publication.
3. Do not publish a PASS receipt before ordered local teardown has succeeded. A hostile cleanup fixture must first prove the real loopback request was captured and then verify no proof is published after forced cleanup failure. The initial version of that fixture lacked the capture marker; that limitation was corrected before final validation.

## Full validation

After focused build/tests, run unfiltered root `npm test`, including its daemon build/pretest, with the package's existing single-worker settings and unchanged test/hook timeouts. Use a 60-minute outer run budget rather than the prior incomplete 30-minute budget. Capture actual exit, full logs and source byte hashes before/after. Disable inherited live-provider/Orca/restart opt-ins. No provider inference, paid request, checkpoint download, commit, push or publication.

Do not claim all product bugs/gates are resolved merely from a green regression. Acceptance, provider qualification and actual consumed-input/accounting evidence remain separate.
