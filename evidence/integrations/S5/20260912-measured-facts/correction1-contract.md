# Unit 1 correction 1 contract

Independent review mapped each required fact to a proof source before persistence:

- subject role/retry/order: orchestration plan plus attempt and retry-link rows; reject 033 legacy membership; hostile arbitrary-role/retry tests.
- activity cutoff: ordered `orchestration_activity` rows, contiguous ordinals, terminal cutoff, required tool/usage/output/terminal support; hostile gap/post-terminal/missing-support tests.
- accounting: same-attempt receipt/provider lifecycle rows and price registry vintage; exact one-class coverage for base/retry/handoff/verification, or explicit unknown; duplicate/cross-attempt/missing-class tests.
- timing/contracts: host clock evidence bytes, registry registration no later than enrollment/capture, enrollment digest match, latest observation only; stale/future/drift tests.
- transaction: synchronous descriptor-checked host reads before one immediate compare-and-insert transaction, then immutable read revalidation; callback mutation/two-connection tests.
- quality: registered metric authority and algorithm revision, independent verifier identity, and evaluated artifact membership equal to verified handoff artifact bytes; self-verifier/wrong-output tests.

Correction cap remains 2. The initial 21 passing tests are insufficient until these proofs and tests pass.

