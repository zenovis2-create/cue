# S3 pre-approval plan UI — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; implementation by `admission_impl`.
Verdict: **PASS for the optional prepared-plan renderer**. Driver/core authority and actual dispatch are separately reviewed components. No implementation file was changed by this reviewer.

## Independent checks

Working directory `C:/Users/User/cue/daemon`:

```text
npx vitest run test/integration-approval-plan.test.ts test/integration-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
10 pass (3 approval-plan + 7 observation), exit 0
npm run build
exit 0
```

The first attempted build during concurrent core work failed because `integration-driver-core.test.ts` referenced orchestration fields before the core declarations had been updated. After `app/core.d.mts` gained those fields, an independent build rerun passed. No test was removed or weakened to obtain the pass.

## Reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `daemon/test/integration-approval-plan.test.ts` | `9F7FD07A17F7E02406BF7B9F53C1478DEFA569223412C9592038319BF8146E60` |
| `app/renderer/index.html` | `4977C4AB4682B7370B65A5AB2FB0A6C3C5782D8F925AF0F29EEE14926D7A8538` |
| `app/renderer/renderer.js` | `39E9ADF27316AB5CF0810237FE762F2D7C3FF2B422BBDFD0F2EA590E550D0E96` |
| `app/renderer/styles.css` | `670346D824D5EA82EB04BAF4D0C36AE7B5EAB1291C81414CDF74417944A67AE6` |

## Findings

No blocking defect found within the validated-host-summary contract:

- Preparation displays policy mode/revision, declared budget units/currency, stage count and full digest, followed by each stage's role, dependencies, requirements, scopes and candidate IDs before the approve button is enabled.
- DOM tests submit the actual renderer form handler using an injected prepare API, then inspect live DOM nodes. This is not screenshot matching or a static string-only assertion.
- All supplied identifiers and values enter textContent or text nodes. A hostile image-tag string remains literal and creates no image element.
- Display work is bounded to 256 stages, 256 entries per list and 128 characters per scalar. Validated plan IDs and stage/list counts already fit these limits. Out-of-contract oversized arrays disclose omission with explicit notices; there is no silent stage truncation in that case. This UI truncation is not a substitute for upstream plan validation.
- Starting a preparation clears old plan contents and disables approve. Legacy responses hide and clear the plan. Rejected preparation clears/hides it and leaves approve disabled, preventing stale plan presentation.
- New content is read-only. Existing approve/execute, status polling and stop handlers retain their roles; the observation regression still checks running stop availability and the qualified completion title.
- HTML uses an initially hidden, open details panel; CSS bounds scrolling without replacing existing controls. Native visual usability is separate QA.

## Scope limits

The tests inject a prepared summary and do not establish that displayed IDs correspond to an authorized immutable plan. Parent driver/core review must establish that binding and approval/launch behavior. Candidate IDs are opaque host references; this display does not certify model capability, choose accounts, relax scope, or replace post-run acceptance verification.

Malformed or over-limit host data is outside the validated preparation contract. Notice text exposes defensive truncation but does not authorize omitted work. No full-suite result or real model execution is claimed here.
