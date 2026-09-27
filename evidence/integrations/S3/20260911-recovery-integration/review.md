# S3 startup recovery integration — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`, source implementation by parent.
Verdict: **PASS for this startup recovery change**. No blocking defect found in the reviewed diff. This resolves the generic-recovery/startup conflict identified in the earlier orchestration review for the paths described here; it does not complete live orchestration integration.

## Source inspection

Reviewed the diffs to `daemon/src/recovery.ts` and `app/core.mjs`, the new `daemon/test/integration-recovery.test.ts`, and surrounding ownership-acquisition and close paths.

- Recovery now includes running orchestration attempts even if no writer flag exists, covering interrupted model-only/planner tasks.
- The transaction still blocks the parent task and records git status and `blocked_no_auto_resume`. Unresolved attempts and their running steps become blocked. Their writer flag and lease remain intact pending separate cleanup verification.
- Runs without unresolved orchestration attempts retain the existing legacy cleanup behavior: write flag cleared and lease removed.
- Desktop stale-lease cleanup excludes a matching unresolved orchestration attempt using run, worktree and acquisition timestamp. It can therefore open the reconciled database without triggering the protective lease-delete guard.
- Neither change launches tasks, marks interrupted steps completed, invents cleanup proof or removes an unresolved lease. Existing process fencing is unchanged.

## Independent tests

Working directory: `C:/Users/User/cue/daemon`.

```text
npm run build
exit 0
npx vitest run test/integration-recovery.test.ts test/p2.test.ts test/release.test.ts --testNamePattern 'recovery|interruption|startup|P2-8|R-4' --reporter=verbose --fileParallelism=false --maxWorkers=1
6 pass, 30 intentionally skipped, 3 files pass, exit 0
```

Executed all 3 new cases: writer recovery retains quarantine, model-only interruption blocks without a writer lease, and desktop startup opens while retaining unresolved ownership. Also executed legacy P2-8 crash reconciliation, release R4 real daemon kill/restart, and release I3 recovery artifact behavior. R4 reported `state=blocked/crash` and captured `?? work.txt` after a real process restart. No model call or full-suite claim is included.

An ancillary read used a repository-relative `app/core.mjs` path while cwd was daemon and failed; it did not affect build/tests. That inspection was subsequently completed from the repository root before this verdict.

## Reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `daemon/src/recovery.ts` | `6A33CE8277B852BDD9154AA611253506C7969A92B609D94B1DDB9848538CD86D` |
| `app/core.mjs` | `F6377D379356D9FEE711AA8D00C286DD27D71B02CDFA780CC66F506EA9D21D6E` |
| `daemon/test/integration-recovery.test.ts` | `DA4C39A17AB0F15EFCA94C3A33A8C823F9235EC39F632385E3E7CEC51C7560CE` |

## Remaining boundaries

Retained ownership is quarantine, not proof the provider stopped. Clearing it still requires the orchestration store's independently verified cleanup path. Repeated startup can record another recovery observation while an unresolved writer flag remains; no work is resumed by those records. This review does not certify provider receipt authenticity, full runtime handle recovery, live model cancellation, budget settlement, or UI treatment of all orchestration states.

No application source was changed by the reviewer. Only this artifact was written.
