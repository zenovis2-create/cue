# Independent A03 targeted-Stop closure review

Verdict: **NOT CLOSABLE. Both authorized actual OS attempts are consumed without a passing targeted-isolation receipt.**

Attempt 1 proves that two injected runtime executions launched through the approved public driver path, because the fixture reached `executions.size === 2`. It then used workflow IDs against a map keyed by orchestration attempt/owner IDs and failed before the process-identity and Stop assertions. Its cleanup hook also exceeded the original timeout. It supplies no targeted-Stop result.

Attempt 2 corrected that lookup and reached `driver.stop(firstRunId)`. The cancellation callback increments `truth.cancels` before it calls `terminateVerifiedTree` and awaits child close. The test waited only for `truth.cancels === 1`, then immediately checked the target OS identities. At least one original PID/creation pair was still present, so the test failed at line 106. This is a test synchronization defect: the counter proves cancellation entered, not that cancellation completed. It is not evidence that the product terminator failed, but it also cannot be counted as evidence that the selected tree was dead.

The attempt-2 cleanup completed without a hook failure, and later name-filtered inspection found no matching fixture root or process. That observation is useful cleanup evidence but cannot replace the missing in-test exact PID/creation receipt. The logs contain no durable raw per-run identity frame, so the selected identities, sibling identities, and their before/after creation timestamps cannot be reconstructed independently. The run also failed before proving sibling heartbeat advancement and exact sibling identity survival during selected-run termination.

Source pins remained unchanged across both attempts. No provider or model was invoked, and no provider billing or cancellation consequence was measured. The public per-run Stop route and entry into the selected adapter's cancel callback are supported; actual selected-tree death plus concurrent sibling isolation across that boundary remain unproven.

No further OS attempt is authorized under the two-attempt cap. A future separately authorized gate would need a completion signal resolved only after `terminateVerifiedTree` and child close finish, or a bounded exact-identity poll independent of the early cancel counter, plus durable before/after identity and sibling-heartbeat receipts.

## Evidence pins

- attempt 1 result: `fc0465b0cdbc84e3395c43c10080f9a32a392c222898d46d6b58b2b28fa71ebf`
- attempt 1 log: `b1914092392a61467d9c7f6a89649d7cad8c0adfb838cc60165e5017c45e2338`
- attempt 2 result: `48c35b9c321afd0a2a60b728313362a7a2d297ab3f8106280709351d7ee90a3b`
- attempt 2 log: `07aab4eacafc559b860d4d09eadbda26f5bde7ab0ab87eb5ccd6b60a6029b3b7`
- executed attempt-2 test: `09e7e5be38cf0f82b83a098618d500d9a5b45a52aa7565d45746c6e0468c5080`
- executed driver: `2ed110d994e22910cd9b95deaf5d7a0167c033165c6a41cd7512221277a050f0`
