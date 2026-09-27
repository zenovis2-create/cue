# Independent A03 attempt-2 preflight review

Verdict: **CLEAR for the final actual OS attempt.**

Attempt 1 failed after both runtime launches because the test indexed `executions` with workflow IDs, while the runtime deliberately stores entries under the orchestration attempt/owner run ID. The correction now reads the persisted `orchestration_attempt.attempt_id` for each distinct workflow and `task_id='make'`, then uses that exact ID to retrieve the runtime execution. In this fresh fixture each workflow has one producer attempt and `executions.size === 2` is already required, so the mapping reaches the two actual adapter launches without changing Stop routing or identity assertions.

The only other changes are a 30-second bound on the test-owned `afterEach` cleanup and a 60-second bound on this actual-OS test. They accommodate verified termination of both owned trees after a failing assertion and do not assert or imply a product Stop-latency guarantee.

The complete diff from the attempt-1 preimage contains only those three changes. PID/creation-time capture and revalidation, target death, sibling exact-identity survival and heartbeat, second Stop, failure cleanup, and canonical root guards are unchanged.

Reviewed test SHA-256: `09e7e5be38cf0f82b83a098618d500d9a5b45a52aa7565d45746c6e0468c5080`.

No actual OS test, build, provider, or model call was performed during this review.
