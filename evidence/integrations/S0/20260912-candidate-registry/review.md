# S0 inactive candidate registry — independent review

Review date: 2026-09-12 (Asia/Seoul)

## Verdict

**PASS.** The candidate documentation matches the independent S0 identity consolidation. This verdict covers inactive identity registration only; it does not qualify, enable, install, admit, authenticate, or make any candidate executable.

## Identity and status findings

- `agy`, `grok build`, `openclaw`, `paseo`, established local `orca`, `herdr`, and `pi / PI-Desktop` are recorded as inactive `resolved-unqualified` candidates in both target documents.
- `nlm mcp cli` and `hermesagent` remain `inactive-unresolved`, explicitly unregistered/unactivated, and do not occur in the runtime catalog, runtime, executor, or dependency manifests.
- The local Orca product identity is kept separate from public provenance. `stablyai/orca` is comparison evidence, `xiws/orca` is a distinct project, and neither is attributed to the local installation.
- The composite `pi / PI-Desktop` row was read directly. It ends in `inactive / resolved-unqualified`; the author's reported `PI-Desktop` checker miss was a pattern false negative, not a document mismatch.
- The candidate preamble and S0 backlog section expressly deny installed, authenticated, protocol-tested, qualified, enabled, admitted, and executable implications. Existing Codex, Claude, and Qwen rows are outside that new candidate-status assertion.
- `docs/INTEGRATION_CHECKLIST.md` lines 28, 30, 31, and 32 were each still `[ ]` at final readback.

## Source, dependency, provenance, and link checks

No candidate identity occurs in `daemon/src/integration-catalog.ts`, `daemon/test/integration-catalog.test.ts`, `daemon/src/integration-runtime.ts`, `daemon/src/adapters/integration-executors.ts`, or the root/daemon package manifests and locks. The catalog source, catalog test, and dependency-manifest hashes were unchanged between this review's initial and final reads. Their modification times also predate the 2026-09-12 candidate-document edits. The shared tree is dirty and these catalog files are untracked, so Git history alone cannot attribute their earlier changes; this review establishes only that the candidate registry pass did not change them during the observed review window.

All 11 relative Markdown targets in the reviewed candidate files exist. Both local anchors in `INTEGRATION_SPEC.md` match headings 4 and 8. All 18 distinct external links returned HTTP 200, including every candidate commit/tree pin.

Direct pinned-license reads matched the consolidation: Antigravity and `xiws/orca` had no root `LICENSE` at the cited commits (HTTP 404); Grok Build, Paseo, and Herdr provided Apache-2.0 text; both NLM candidates, Nous Hermes, OpenClaw, public Stably Orca, and Pi Harness provided MIT text; PI-Desktop provided LGPL-3.0 text; OpenClaw's pinned third-party notice was present.

`git ls-remote ... HEAD` independently matched the pinned current revisions for Antigravity, Grok Build, both NLM candidates, HermesForge, Paseo, public Stably Orca, `xiws/orca`, Herdr, and PI-Desktop. During this later check, Nous Hermes HEAD had moved from the consolidation pin `2f21d29...` to `9c9e7ab...`, and OpenClaw HEAD had moved from `a0148f9...` to `9000b42...`. Pi Harness HEAD was `71dca87...` while the document deliberately pins stable `v0.85.1` at `d981de1...`. The cited historical/stable commits remain reachable (HTTP 200); this ordinary upstream drift does not change the inactive identity verdict.

## Independent commands

- `Push-Location daemon; npx --no-install vitest run test/integration-catalog.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1; Pop-Location` — exit 0; 1 file, 9 tests passed.
- `npm --prefix daemon exec -- tsc -p daemon/tsconfig.json --noEmit` — final exit 0.
- `npm --prefix daemon run build` — final exit 0; TypeScript and asset copy completed.
- Relative-link existence checker over the four candidate-registry files — exit 0; 11 valid, 0 broken.
- `curl.exe -sS -L -o NUL -w '%{http_code}' ...` over 18 distinct external links — exit 0; every link returned 200.
- Pinned raw-license reads with `Invoke-WebRequest` — exit 0; expected license text or expected 404 observed for all reviewed candidates.
- `git ls-remote https://github.com/<owner>/<repo>.git HEAD` over 13 candidate repositories — exit 0; current-ref results and upstream drift recorded above.
- Candidate-name search across catalog/runtime/executor/package manifests and locks — exit 0 with `NO_CANDIDATE_IDENTITIES_IN_RUNTIME_OR_DEPENDENCIES`.
- Final direct checklist read — lines 28, 30, 31, and 32 all open.
- Path whitespace scan — `CANDIDATE_INVENTORY.md`, `done-contract.md`, and `implementation.md` clean; the inserted S0 section of `INTEGRATION_BACKLOG.md` clean.
- `git diff --check` — exit 1 only for unrelated `README.md` Markdown hard-break spaces at lines 51–56, 79–80, 117–124, and 132–135. A whole-file scan also finds preserved Markdown hard-break spaces in `docs/INTEGRATION_BACKLOG.md` lines 3–4; the added S0 section has no trailing whitespace.

The first independent TypeScript/build attempt occurred while an unrelated S3 correction was in progress and failed on seven test type mismatches involving `ActivityFact.detail` and missing `TerminalHandoffInput.receiptRevision`. After that correction's gate completed, the single final reproduction above passed without any S0 reviewer edit to product or test files.

## SHA-256 readback

| File | SHA-256 |
|---|---|
| `docs/reuse-decisions/CANDIDATE_INVENTORY.md` | `9864bec3f0690b3dd700fb99e9ddb4c184d53bf4952b49e26dae91a97af78b37` |
| `docs/INTEGRATION_BACKLOG.md` | `46ef883992c165dbf5187ae8a2296a3e65e3ddfed4d60a388dede740787624b9` |
| `done-contract.md` | `8b73002b1e4657089d36e44f74b14cf0f01b5c3b1ce6384304df053fc8bd84ad` |
| `implementation.md` | `393e234fe139b600ffe43e42ba0cdcf9a7d4a63d94e3ec3fb927d03e55c99b14` |
| `daemon/src/integration-catalog.ts` | `04ebca37b010aa0c89df0f848533abaaf8685f6eb9dee18e75b38810f0963a14` |
| `daemon/test/integration-catalog.test.ts` | `94407842f85c9e8623cc2246d3d7000ef2ed6122de2469c5c77f18403872ed6a` |
| `daemon/package.json` | `4516cf078a61db713dc24d7a865e6b7d6298873c60d329a9d863822e065b82a8` |
| `daemon/package-lock.json` | `2b8d453e438b0c5680e23578b9b16c9ceab7d32467900790733704ac15c08122` |
| `package.json` | `3fb3e209ef1494c6ba3e75ee78887fe23cba3d7d305700945fc62bf05e444123` |
| `package-lock.json` | `3ad923fcbef8140bbbfb58d02650b98c03d7931f064e8963970dcbdbfc76d577` |

## Limits

- The repository-root `AGENTS.md` requested for inspection is absent from this checkout. The session-injected root `AGENTS.md` instructions were applied instead.
- This is a documentation and source-boundary review. It did not install, authenticate, execute, or qualify any candidate and did not prove an installed artifact hash, live protocol, cleanup behavior, model mapping, or redistribution-complete dependency inventory.
- Because the target documents and catalog files are untracked in the shared worktree, ordinary `git diff --check` cannot inspect them as a normal tracked patch. Direct whole-file/range whitespace scans and content hashes provide the scoped evidence instead.
