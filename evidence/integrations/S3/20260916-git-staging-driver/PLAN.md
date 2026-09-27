# Git staging driver integration plan

## Completion contract

Done means the new `daemon/test/integration-git-staging-driver.test.ts` drives the public `createOrchestrationDriver` prepare, approval, activate, and start sequence against `createGitStagingHost({storageRoot, gitExecutable})` in a real temporary Git repository. The positive case must prove the execution cwd differs from the publication root, the implementation mutates the tracked target only in the execution worktree until final publication, and the existing compare/write publication writes exactly the staged bytes to the original root. The dirty-worktree case must prove cleanup remains unknown/blocked, retains the write lease, emits no finished receipt, and leaves the owned temporary root available for guarded teardown.

This does not claim S3-01 or S3-03 complete. Synthetic admission, receipt, and artifact data are explicitly fixture-labeled.

## Attempt cap and per-pass gate

- Attempt cap: 3 test revisions.
- Every pass: `npm --prefix daemon exec vitest run test/integration-git-staging-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Once the parallel factory module is build-ready: `npm --prefix daemon run build` before the focused test.
- Failure: inspect the specific assertion/ledger/native Git state, retry only with a new hypothesis, and preserve the failing output. After three failed revisions, stop and report the evidence.
- Keep a change only when the focused gate advances toward exit 0 and all containment/cleanup assertions remain intact.

## Scope and preimages

- New test path was absent before editing: `daemon/test/integration-git-staging-driver.test.ts`.
- Optional fixture prefix was absent before editing: `daemon/test/fixtures/git-staging-driver-*`.
- This plan path was absent before editing: `evidence/integrations/S3/20260916-git-staging-driver/PLAN.md`.
- No existing file is authorized for modification, so there is no existing-file byte preimage to capture.
- Reference-only existing fixture SHA-256: `daemon/test/integration-driver-publication.test.ts` = `44D70DD15436855B8D0E8BD8C888C9D8EAC8CE2A89E82717F1B97BCA3B203EC5`; its bytes will not be changed.

## Native temporary-root safety

Each test creates one unique owner root with `mkdtempSync(join(tmpdir(), 'cue-git-staging-driver-'))`. Cleanup resolves every candidate to an absolute path, verifies it is strictly contained by that exact owner root (or is the owner root itself), verifies the owner basename starts with `cue-git-staging-driver-`, closes SQLite first, and only then removes the owner root recursively. No repository path, user repository, provider, port 8085, or unknown Codex process is touched.

After the focused native run, write `cleanup.json` in this evidence directory with the test command, exit status, owner-prefix contract, and the observed count of surviving `cue-git-staging-driver-*` directories before and after. A nonzero survivor count is a failed gate.

## Raw commands

```powershell
git --version
(Get-Command git.exe).Source
npm --prefix daemon run build
npm --prefix daemon exec vitest run test/integration-git-staging-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Directory -Filter 'cue-git-staging-driver-*'
git diff --no-index -- NUL daemon/test/integration-git-staging-driver.test.ts
git status --short -- daemon/test/integration-git-staging-driver.test.ts evidence/integrations/S3/20260916-git-staging-driver
```

## Checker separation

The maker authors the test and records raw command output. The root agent or an independent reviewer evaluates the focused output, byte-level publication assertions, ledger rows, and cleanup artifact; this file does not self-certify S3 completion.
