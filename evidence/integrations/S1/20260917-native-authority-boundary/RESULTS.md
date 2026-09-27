# Increment 1 result — native existing-file AcceptanceHost

Hypothesis 1 of the [third-attempt plan](PLAN.md), passed on pass 1 of 2.

## Owned files and pins

| path | sha256 | bytes | state |
|---|---|---|---|
| `daemon/src/verification/native-existing-file-acceptance-host.ts` | `48df00cf4b6344dad78b360657f4aae5640731b3553fec3f62200d44b584ba1b` | | current — through increment 2 |
| `daemon/test/integration-native-existing-file-acceptance-host.test.ts` | `db64b747f7222309d5e39d0dedb5242107c18945a0246cca3d384ed551a7b371` | | current — through increment 2 |
| `daemon/src/verification/native-existing-file-acceptance-host.ts` | `5c46834a…a98460` | 17357 | increment 1, as audited by `REVIEW.md` |
| `daemon/test/integration-native-existing-file-acceptance-host.test.ts` | `9d8a6a48…63ef17` | 15992 | increment 1, as audited by `REVIEW.md` |

The first two rows are current. The last two are the exact bytes `REVIEW.md` audited for increment 1.

The host pin above supersedes the reviewed pin `176df7744fa1aefd7ffbf79bef763e84c842915d7884b4cab51ee81e5c6136b1`
(16674 bytes). The only change after review was comment text recording the two findings below;
both gates were re-run unchanged afterwards.

No other production module, migration, build asset, `app/` wiring, provider, model, or network
endpoint was created, edited, or invoked.

## Done-definition gates

```text
npx --no-install vitest run test/integration-native-existing-file-acceptance-host.test.ts \
  test/integration-native-existing-file-runtime.test.ts test/integration-native-existing-file-checker.test.ts \
  test/integration-acceptance.test.ts test/integration-evidence-policy.test.ts
  -> Test Files  5 passed (5)
     Tests  46 passed | 1 skipped (47)
     exit 0

npx --no-install tsc -p tsconfig.json --noEmit
  -> exit 0
```

The owned suite alone is 11 tests: 10 pass and 1 skipped. The single skip is the
non-Windows-only assertion (`skipIf(win32)`), which cannot run on this host; the equivalent
Windows refusal path is asserted separately by the unprovable-target test.

Manifest/source-listing sensitivity after adding two files:

```text
npx --no-install vitest run test/integration-release-readiness.test.ts test/current-source-report.test.ts \
  test/p12-source-manifest.test.ts test/integration-reuse-manifest.test.ts test/release.test.ts
  -> Test Files  5 passed (5)   Tests  35 passed (35)   exit 0
```

## What the increment establishes

`createNativeExistingFileAcceptanceHost` satisfies the real `AcceptanceHost` interface and is
driven end to end by the real `createAcceptanceVerifier` over a real SQLite lineage
(run/envelope/policy/plan/requirement contract/stage envelope/attempt selection/handoff
identity/orchestration attempt), with real on-disk bytes read through the protected
`snapshotRelativeNative` helper. Verified behaviours:

- real bytes matching the approved contract reach `pass` and `finalize` returns `accepted`
- bytes that do not match reach `fail` and `finalize` returns `blocked`
- an unprovable target (approved path removed) is never `pass`, and `isManifestCurrent` is false
- an approved contract whose `parametersDigest` is not pinned by the persisted requirement
  check is never `pass` — a contract cannot be smuggled in through construction
- a tampered contract is refused at construction, and by the policy factory
- the checker principal is this module's own code digest bound to the approved contract; a
  different contract yields a different principal, and the string contains no role, task or
  candidate name
- a producer principal equal to the checker principal can never be accepted, so independence
  is enforced by the evidence policy rather than asserted
- the `code` evidence policy fixes empty sections/claims/hostile checks and `requiresRender`
  false, and is frozen
- an observation this host did not issue evaluates to `unknown`

## Seams deliberately absent

The option set is `{ db, now, contract, producerTaskId, producerPrincipalForAttempt,
timeoutMs?, maxObservationAgeMs? }`. There is no authentication flag, no transport, no
authorization callback, no checker callback, no injected verdict, no caller-issued success
receipt, and no `authorizePublication`. `producerPrincipalForAttempt` resolves only the
producer task's principal — the same delegation `createGeneratedAcceptanceHost` uses — and it
cannot influence the checker principal, which is derived from code bytes.

## Independent review

[REVIEW.md](REVIEW.md) — `REVIEW_PASS`. The reviewer reproduced both gates and the owned-file
pins, enumerated the full option set and confirmed no authentication flag, transport,
authorization callback, checker callback, injected verdict/receipt or `authorizePublication`
exists, and confirmed the construction-time contract cannot be smuggled past the persisted
requirement binding. Mutation sensitivity was executed, not reasoned: forcing `evaluate` to
fall back to `pass` and making `collect` ignore the artifact verification were BOTH detected by
the owned suite, and the file was restored to its exact pin afterwards. The increment was
judged NOT scaffolding: the consumer is the real pre-existing `createAcceptanceVerifier`, and
the test drives it end to end.

Two non-blocking findings, now recorded in the code as well:

1. Removing the redundant post-observation manifest re-read does NOT fail the owned suite. The
   exploitable between-capture-and-collect case is caught by the load-bearing `captured` guard,
   so the re-read is defence in depth for a narrower time-of-check window that the suite does
   not isolate. It is kept and labelled as such rather than claimed as test-covered.
2. `ownCodeDigest()` reads this module through `import.meta.url`, so the compiled `dist` bytes
   and the vitest-transformed source bytes produce different principals. This is not a
   false-pass seam. The consequence is intended and now documented: receipts are not portable
   between builds, and a run whose host build changes mid-flight fails closed instead of
   accepting across two implementations.

## Increment 2 — read-only verifier receipt gate: SHIPPED after the lineage decision

Capability (g): expose the independent principal only behind an exact successful read-only
verifier runtime receipt (migration 050).

Pass 1 was restored on a wrong diagnosis. Pass 2 made the gate work but only by hand-inserting a
session handle the launcher never emits, and [independent review](REVIEW-INCREMENT-2.md) returned
**REVIEW_BLOCKED** for exactly that reason. It also confirmed the gate itself was sound: mutations
proved it load-bearing, forged rows are rejected, a cross-attempt receipt does not unlock it, and a
missing table fails closed.

The block was a real wiring defect, not a flaw in the gate. It is now fixed and recorded in
[DECISION-050-LINEAGE.md](DECISION-050-LINEAGE.md): migrations 039 and 050 demanded a session
handle carrying the **plan** task id, while the stage binder only ever emits the **stage** task id,
so no launcher-produced receipt could satisfy either trigger. Both clauses now join through
`orchestration_stage_envelope` on `stage_task_id`, existing ledgers upgrade in place on open, and
the "same-name weakened trigger refuses startup" property still holds.

With that corrected, the gate ships using the launcher-produced handle and **no hand-made row**.
Shipped pins:

| path | sha256 |
|---|---|
| `daemon/src/verification/native-existing-file-acceptance-host.ts` | `48df00cf4b6344dad78b360657f4aae5640731b3553fec3f62200d44b584ba1b` |
| `daemon/test/integration-native-existing-file-acceptance-host.test.ts` | `db64b747f7222309d5e39d0dedb5242107c18945a0246cca3d384ed551a7b371` |

Gates: focused set 11 files / 66 passed / 1 skipped / exit 0; `tsc --noEmit` exit 0; and the full
daemon suite **270/270 files, 1788 passed, 10 skipped, exit 0**.

Guard necessity, which the earlier attempt could not measure: removing both guards at once (Node
edit, exact restore afterwards) fails the owned suite — **1 failed, exit 1**. The gate is
load-bearing. Each guard individually is still covered by the other, which is defence in depth
rather than an isolated assertion, and that remains recorded rather than claimed.

## Not claimed

S4-01 itself, the full authority composer, setup/startup wiring, real external
authentication, model entitlement, actual billing, and general natural-language goal
verification. The remaining eight composer capabilities are unimplemented; `BOUNDARY.md`
records that they have existing APIs or are thin glue. Independent review is required before
this increment is treated as complete.

