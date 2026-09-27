# Maker result

Pass 1: 19/19, exit 0. Fresh-database cases cover foreign/absent receipt lineage, duplicate attempt overlap, unsafe integers, unequal partition sums, wrong cost class, zero attribution/projection writes on refusal, and atomic rollback when the second attribution becomes stale after prepare.

Only `daemon/test/integration-evaluation-measured-facts.test.ts` changed in this unit. Final test pin: `00DBD304BBE2FD127FA67C6F6C04C4330778A7BBB6600568136C9DDBBC64E793`.
