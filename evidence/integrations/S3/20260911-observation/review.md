# S3 ledger observation — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; implementation by `admission_impl` and parent.
Verdict: **PASS for the read-only ledger projection and renderer component**. Two identified correctness issues were corrected. Native Electron visual QA is performed separately by parent and is not claimed by this review.

## Independent verification

Working directory `C:/Users/User/cue/daemon`:

```text
npm run build
exit 0
npx vitest run test/integration-observation.test.ts test/p9.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
20 pass (7 observation + 13 P9), exit 0
```

After the subsequent renderer-only completion-title qualifier and its test assertion:

```text
npx vitest run test/integration-observation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
7 pass, exit 0
```

The later edit does not change compiled TypeScript projection/core behavior. P9 tests verify existing app setup/IPC/approval/status/stop/ledger behavior. A subsequent dedicated parent-authored core test was independently inspected and executed:

```text
npx vitest run test/integration-observation-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
1 pass, exit 0
```

This uses real `createCueCore`, `prepareGoal` and `completion`: a legacy card returns orchestration null, then a deliberately seeded ledger plan appears in the core completion projection with unknown acceptance/cost and the parent still awaiting approval. It proves new-field plumbing, not actual plan execution or admission. Workspace and app state use sibling temporary directories, and teardown awaits core.close. The native-window path remains separate QA evidence.

## Reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `daemon/src/ui/orchestration.ts` | `AA7616435CECEC34FD18B0F976D37CEBB5771D00DDE9803FF062BB6C98C6545C` |
| `daemon/test/integration-observation.test.ts` | `1BE90D7C29BEAB77BA2BD139935E191D398A1FF33E4CB4417FD45164A6DA78BE` |
| `daemon/test/integration-observation-core.test.ts` | `817CEE36530A73F3B97C0D33C7A5B833EC0DA557DF24C542DD69F6CDC8FF14F7` |
| `app/renderer/index.html` | `931A109C680833F8A25475FC750BCCE34DA47BDDF9ADCE92C1488DE7A2128531` |
| `app/renderer/renderer.js` | `EAEF4A6F2DEB188FAC98670E3F6DF00917A25705918574C87F4220A655E04E3C` |
| `app/renderer/styles.css` | `EE896F2DAB37CEAE853DA4A15D8566634AB31AD1B9721688F5A45BF70C7A94EC` |
| `app/core.mjs` | `EC094242E28CAAF9DBFEF2FB06396F8E6080703C35AD50F17BC87A7770893F02` |

## Findings and resolution

1. Initial final-cost logic covered only existing attempts. It could report a final run cost while an unattempted verifier remained, or with unrelated final reservations and zero attempts. Current logic requires nonempty exact planned-stage coverage, all stages completed, matching completed/clean attempts, exact attached reservation coverage and actual final receipts. Regression cases cover pending verifier, unknown cleanup, unmatched reservation and zero attempts. Final cost remains unknown when those conditions do not hold.
2. A completed parent card with unverified orchestration acceptance could display an unqualified `완료` title. Current rendering shows `실행 완료 · 인수 미확인` for that case and preserves `완료` for legacy completed cards. Both cases are asserted in the DOM test. Ledger state is not mutated.

## Inspected invariants

- Snapshot queries run in a read transaction. Budget manager use is restricted to its read-only summary; no mutation or tool launch occurs in this projection.
- Legacy/no-plan lookup returns null and hides the panel. Existing running stop control remains enabled. The renderer updates text nodes rather than parsing ledger strings as HTML.
- Policy display comes from the immutable run-policy binding, not plan metadata. Missing/invalid policy remains unverified. Candidate IDs are shown without guessing model or tool identity.
- Requirement acceptance is always unverified in this observation feature. Completed execution and clean teardown do not manufacture requirement evidence.
- Raw plan/activity/claim data, worktree paths and free-form activity details are not projected. Explicit identifier/hash filters and whitelisted enum fields restrict output. Tests verify secret fixture fields and invented model metadata are omitted.
- Stage and activity arrays are bounded at 256 and 20, with explicit truncation flags. Budget amounts serialize as exact decimal strings from BigInt, preventing JSON overflow or precision loss. Missing final billing stays null/unknown rather than zero.
- New HTML/CSS is an observation panel; it introduces no action authority, credential access or new IPC capability. Core adds the projection to a ledger-derived card using its run ID.

## Limits

This is historical ledger observation, not a new scheduler or evidence verifier. The data must already have been written by trusted host admission, execution and billing paths. Fixtures seed ledger rows directly and do not certify a real provider, model, full orchestration run or accepted user result. Failed or unfinished stages conservatively retain unknown final cost. Native layout, scrolling and visual usability remain the separately recorded Electron QA responsibility.

No implementation file was modified by this reviewer. Only this artifact was written.
