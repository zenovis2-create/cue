# S7 current-revision structure and comparison plan

Status: read-only gap analysis. This plan does not run Electron, models, native helpers, or external repositories, and does not reopen any exhausted live/UI gate.

## Exact remaining gate

`docs/INTEGRATION_CHECKLIST.md:253` is the only unchecked S7-specific implementation row: extract and verify the structure of the **current Cue code revision**, then deliver its structure and comparison artifacts. AR-02/AR-03 therefore remain incomplete.

Already complete and not to be repeated:

- Cue-owned IR/HTML, bounded delivery, last-good preservation, app report isolation, hashes, and visual-review separation.
- The 104-file/212-edge historical AST inventory and its browser review; that review explicitly found the 13,287px flat list insufficient as an architecture diagram.
- The later 109-file/224-edge grouped 8x8 source matrix and independent visual review.
- The comparison between those two pinned historical snapshots.
- Archify CLI/upstream checks remain `N/A (not incorporated)` under R-08, not PASS; the local Cue path is the settled decision.

The existing matrix and comparison are historical. They explicitly disclaim current-worktree coverage. The current dirty tree contains many later app/daemon files, so neither artifact can close the current-revision row.

## Smallest implementation

Add one fixed, offline generator, `scripts/reuse/cue-current-source-report.mjs`, and its focused tests. The bounded ownership also includes the minimal current-context API in `daemon/src/reports/comparison.ts` and its direct comparison test; the default historical renderer contract remains unchanged. Reuse rather than replace:

- `captureSource`, `verifySource`, and `extractGraph` from `scripts/reuse/cue-source-structure-report.mjs`;
- `sourceReport` plus `renderReportHtml`/`sourceArchitecture` for the grouped SVG matrix;
- `restoreArchivedSource` and `renderSourceComparison` from `daemon/src/reports/comparison.ts`;
- `createReportDelivery` for atomic delivery and last-good behavior.

The generator accepts no paths or network input and writes only a new fixed folder, `evidence/integrations/S7/20260912-current-source/`. It must preserve `20260911-*` evidence byte-for-byte. Outputs:

- `source.json`: current bounded `app` + `daemon/src` file hashes, stable nodes/edges, and content snapshot digest;
- `result.json`: counts, every parsed import observation (kind/specifier/offset/resolution), parser identity, limits, skipped links, receipt, and explicit scope;
- `cue-current-source.html`: current grouped SVG matrix plus complete collapsed inventory;
- `cue-current-comparison.html` and comparison receipt: pinned 20260911 109-file snapshot versus the new current snapshot, including file-content, node, and edge changes;
- `source-basis.json`: Git base commit read independently before capture plus `git status --porcelain=v1 -z --untracked-files=all -- app daemon/src` hash/count and the content snapshot digest. Evidence, scripts, tests, and output writes are outside this scoped status, so generation cannot invalidate its own basis. Label the digest as the current worktree revision; never label dirty bytes as the Git commit.

Do not add runtime resolution. Keep exact source-path matches and `.js/.mjs/.cjs` source counterparts distinct; retain external, nonliteral, outside-root, and unresolved observations. An AST declaration is evidence that syntax exists at a byte offset, not evidence that the module loaded, a call ran, or an edge caused impact. No source file is imported or executed during extraction; only parser output and hashes are consumed. Importing the extraction module must remain side-effect free.

## Done gate and attempt cap

Attempt cap: 2 implementation passes. Before each pass run the same focused gate. On failure, retry only with a new hypothesis; after two failures hand back the preserved evidence and blocker.

Run before the final capture (source may still change):

```powershell
Set-Location C:\Users\User\cue\daemon
npm run build
npx --no-install vitest run test/integration-reports.test.ts test/integration-report-comparison.test.ts test/current-source-report.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
Set-Location ..
node scripts/reuse/cue-source-structure-report.mjs --self-test
```

Then begin the short source freeze and run exactly one generation pass:

```powershell
node scripts/reuse/cue-current-source-report.mjs
```

The generator captures inventory/bytes, builds both artifacts, then recaptures and must fail on any digest change. It records base commit/status before and after; either status change fails. Freeze stays active only until the final HTML/JSON bytes and hashes are captured, then releases. Build output is excluded and must be produced before this freeze.

## Independent checks

Source checker (read-only, no regeneration): independently import the extraction exports, recapture current bytes, recompute the graph from AST records, compare every file/hash/import/edge/count/digest with saved JSON, verify the pinned prior source/result/receipt bytes, comparison set arithmetic, artifact hashes, fixed paths, parser binary hashes, and source-basis before/after equality. Spot-checking is insufficient.

Visual checker (separate evidence): open the exact saved HTML bytes through the already reviewed unprivileged report-window path; check grouped SVG and legend, current digest/limits/warnings, complete collapsed inventories, default and narrow overflow, text alternative, comparison summaries/details, CSP, scripts/links/assets 0, external requests 0, and unchanged artifact hashes. Maximum 2 visual attempts; a QA-harness defect may be corrected with a new hypothesis, but historical Electron attempts and caps stay closed.

Completion wording must say “current bounded static source snapshot and declared-import diagram/comparison.” It must not say runtime architecture, execution dependency, safety, performance, clean Git revision, model qualification, or S0-S7 completion. Only after both independent checks PASS may checklist row 253 and AR-02/AR-03 be marked complete for this bounded static-source meaning.

## Source-backed rationale

- `docs/INTEGRATION_SPEC.md` requires code-revision grounding, planned/observed separation, hashes, browser evidence, and independent visual review.
- `docs/INTEGRATION_CHECKLIST.md:253-254` distinguishes the missing current structure/diagram gate from the completed historical import list.
- `docs/reuse-decisions/R-08-archify.md` selects Cue IR/renderer/delivery and keeps upstream CLI not-run.
- The 20260911 structure, matrix, and comparison reviews explicitly limit their claims to static syntax and historical snapshots; the matrix renderer already supplies the smallest accessible diagram primitive needed here.
