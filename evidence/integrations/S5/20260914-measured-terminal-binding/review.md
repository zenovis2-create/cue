# Independent review — measured-fact terminal response binding

Status: **PASS** — no blocking findings in the bounded terminal-response binding change.

## Review contract

Done means the measured-fact stored-execution validator accepts terminal integrity only from a synchronous exact plain object with enumerable own data properties `{status, attemptId}`, requires `status === 'verified'`, and binds `attemptId` to the currently validated stored attempt. Wrong, missing, extra, proxy, getter, custom-prototype, and promise responses must reject without accessor execution, fact writes, recapture, or trial/promotion authority. Existing valid facts must preserve exact value/digest behavior across read, capture replay, evidence projection, and reopen.

Independent attempt cap: two focused passes. Every independent pass runs the three focused measured-fact suites from `daemon` with one worker and file parallelism disabled. A failure would require a new concrete hypothesis before the second pass. The reviewer owns no product or test edits and does not duplicate the maker-owned daemon build.

## Static review

The new `terminal` validator rejects null and non-object values, proxies before any proxy trap can run, and non-plain prototypes before descriptor inspection. It then inspects own property descriptors, requires exactly two own keys, requires enumerable data descriptors for both fields, validates the literal status, validates the attempt identifier syntax, and compares the returned attempt ID with the stored `orchestration_attempt.attempt_id`. No response property is accessed through ordinary property lookup.

`validateStoredExecution` calls the host once for the current stored attempt and validates that returned value before continuing to stored launch/identity/handoff lineage. The fact schema, canonical payload construction, digest calculation, producer classes, default-disabled host wiring, and fixed `trialReady:false` behavior are unchanged.

The regression uses the established real disk-backed SQLite/Core fixture with one populated persisted attempt. Eight hostile response shapes cover wrong attempt, wrong status, missing field, extra field, custom prototype, getter, proxy, and promise. Initial capture rejects with zero fact rows and unchanged `total_changes()`. After a valid capture, stored read, capture replay, and Core evidence projection all reject every hostile response without recapture or writes; getter and proxy counters remain zero. Restoring the exact valid response reproduces the original fact and view, preserves capture count, and reopens deterministically.

## Verification

Maker pass 1 preserved in `maker/pass-1.txt`: daemon build exit 0; focused gate failed with 15 passed and 1 failed because the test reopened while the original Core retained live ownership. The maker corrected only fixture lifecycle by closing/removing the original Core before reopen.

Maker pass 2 preserved in `maker/pass-2.txt`: daemon build exit 0; focused gate passed 3 files, 16 tests, 0 failures. This exhausted the maker's two-pass cap with a stable successful result.

Independent pass 1 command:

`npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: **PASS** — 3 files, 16 tests passed, 0 failed in 4.54 seconds. No second independent pass was needed. The reviewer did not rerun the unchanged daemon build.

Descriptor-based diff inspection found only the intended terminal validator/call-site change and the focused fixture/regression addition. `git diff --no-index --check` emitted no whitespace-error diagnostics for either changed file; its exit 1 is the expected content-difference status. The existing LF-to-CRLF notices are non-diagnostic.

## Identity and limits

Final pins match 2/2:

- `daemon/src/evaluation/measured-facts.ts` — `03CA353494677F8336CC762F7AB0DA50BF9A04693FECBE81B92D34CB19C2CD91`
- `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts` — `3CC5FCC6F6B4903D26F78736771AC708AFA5111D89A94C1D858E4A02CA021CE2`

Original preimages match 2/2 recorded entries:

- `daemon/src/evaluation/measured-facts.ts` — `072072079F1F6B571DD77727BD8BA9AA3EC9FB98D5C097DDB1FAD1CF0107FA57`
- `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts` — `2C5297F14074E1B870C233062522D18B118180BE467C7A51C562E0F64B2638D9`

The fixture injects terminal-integrity authority and disables lineage triggers and foreign keys only while seeding the required persisted lineage. This verifies the measured-fact validation boundary and deterministic storage behavior; it does not qualify runtime execution, provider/model behavior, measurement accuracy, native/network/Electron behavior, actual trials, promotion, or broad S5 completion. Default host activation remains absent and trial/promotion flags remain false. No model, server, native, network, live Electron, commit, or push operation occurred.
