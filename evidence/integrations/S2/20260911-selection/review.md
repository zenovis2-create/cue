# S2 selection foundation — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; implementation owner is `reuse_pure`.
Verdict: **PASS for the pure host-owned policy foundation**. This does not complete S2 or authorize live execution.

## Reviewed scope and evidence

Reviewed `daemon/src/selection/policy.ts` and `daemon/test/integration-selection.test.ts` against integration spec sections 2, 3 and S2. No application source edits were made by the reviewer.

Independent commands, cwd `C:/Users/User/cue/daemon`:

```text
npm run build
exit 0
npx vitest run test/integration-selection.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
10 tests pass; 1 test file pass; exit 0
```

An initial metadata inspection used paths relative to the repository while running in daemon and failed to locate the files; the separate build and focused tests succeeded. Metadata inspection was corrected from the repository root before recording the hashes below. No full-suite result is claimed.

| Source | SHA-256 |
| --- | --- |
| `daemon/src/selection/policy.ts` | `351EE9D401859CEEBA004AC9DFDD47B30E2F8B31573395F8965E94739DFF3355` |
| `daemon/test/integration-selection.test.ts` | `E5274C2F96E6EAEAC8DCB5F3C09F3FF6981115E89FA33E2DEF3EB42E43980E25` |

## Findings and disposition

The initial implementation lacked a deadline filter. The worker added `remainingTimeMs` and `conservativeMaxTimeMs`, validates their numeric values and bound ordering, and excludes unknown/excessive time bounds before scoring or applying a manual pin. The new regression covers all four modes, refusal to fall back from an unavailable pin, and acceptance at the exact time boundary. This finding is resolved in the hashes above.

No remaining blocking defect was found within the pure function's declared contract:

- All modes share allowed-ID, host eligibility/auth/compatibility/data/resource/quota predicates, quality floor, freshness, currency, and enabled cost/time limits before ranking.
- Missing estimates are excluded. Strict cost limits require a conservative upper bound; strict time limits require a conservative duration bound. Stale and future observations are excluded. Unknown bounds are not implicitly converted to zero.
- Efficiency uses policy-fixed cost/time bases and fixed 0.5/0.5 weights; adding candidates does not rescale existing scores.
- Performance ranks supplied quality, value supplied total expected cost, and speed supplied total expected time. Names do not encode model performance priors.
- The estimate scope explicitly denotes verified completion totals including retries, verification and handoffs. This is a host input contract, not an implemented estimator.
- Candidate ID order produces deterministic ties and assessments. A manual pin cannot bypass constraints or silently fall back.
- Malformed record shapes, accessors on record fields, nonfinite/negative values, inconsistent bounds and duplicate IDs are rejected. Returned decisions and nested assessments are frozen and do not retain mutable input records.
- Decisions explicitly require separate execution admission and budget reservation.

## Limits and remaining S2 work

Candidate check booleans are host-supplied assumptions, not measured eligibility evidence. Model-generated configuration must never self-certify these inputs. Live identity, required capabilities, authorization and current availability must be independently rechecked at dispatch.

This function does not reserve funds, coordinate concurrency, persist policy/run revisions, collect price or quality evidence, calculate retry/verification costs, normalize currencies, update remaining deadlines, choose an exploration fallback, or implement mode UI. Freshness and source labels do not prove input reliability; a trusted estimator and observation pipeline remain necessary. Account quota and local memory are represented by predicates, not measured here.

The caller must snapshot policy and trusted estimates per run, pass current remaining budget/time, and atomically reserve before execution. Selection cannot guarantee a remote model stops or settles billing within an estimate. No real model calls, empirical optimization claims, or production release approval are included.
