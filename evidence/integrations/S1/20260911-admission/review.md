# Independent capability admission review

Reviewer: /root/contracts_review. Date: 2026-09-11.

Verdict: PASS for the host-owned pure admission foundation. No blocking finding in this scope. No real adapter/model receives qualification from this review, and no production dispatch/activation call site uses this gate yet.

Completion gate: focused test exit 0, strict input and evidence-trust review, exact source hashes, narrow live-evidence interpretation. Artifact write cap 1; read/hash verification after write. Reviewer made no source/test edits and no live model calls.

Command (cwd daemon): `npx --no-install vitest run test/capability-admission.test.ts --reporter=verbose`

Observed exit 0; 8/8 tests passed, duration 240 ms, Vitest 4.1.11. Build was reported passing by author, not independently rerun here.

## Assessed behavior

- P1-P5 and B1-B5, including normal/stop/crash cleanup, are required independently from M1-M3; failure does not improperly qualify the affected role.
- Missing, malformed, fixture, failed, unknown, future and expired evidence denies admission. Artifact bytes must hash to the candidate reference and the parsed record must bind the expected probe and current subject digest.
- All nine measurement subject fields participate in drift rejection. Extra fields, getters, proxies including revoked proxies, custom prototypes and symbols do not bypass validation; tested getters are not invoked.
- A candidate supplies opaque references only. The host-owned resolver, clock and expiry policy are trusted dependencies. Resolver failures and missing bytes deny admission. Output decisions/reasons are frozen snapshots.
- SHA-256 integrity is not proof that a live probe actually occurred or was semantically correct. The independently maintained evidence store is the root of trust; self-reported candidate evidence must never populate it.
- No activation import/call site exists outside the new module and focused tests. Therefore this is foundation code, not completed S1 adapter enforcement.

## Integration requirements still open

The execution caller must construct the current subject from host measurements (for example buildMeasurementSubject), rather than accept a model/manifest-supplied old subject, and re-evaluate at execution time. The resolver must return bounded, immutable trusted artifact bytes; the pure gate does not implement an evidence store, storage ACLs, artifact-size limits or measurement execution. Admission is not a durable permission or an OS security boundary. Actual P13 probe outcomes and M1-M3 qualification remain separate gates.

## Qwen live evidence consistency

Read `evidence/integrations/S1/20260911-qwen-live/result.json` without making any network/model request. Its scope is explicitly live connectivity only, not M1-M3 qualification. It records text OK, usage unknown, providerStopped unknown, and endpoint-reported model metadata n_ctx 147456 (n_ctx_train 262144). The reported model identifier is qwen38-27b-unc; this metadata is not independent weight/model identity verification. The recorded transport hash matches the current model-transport.mjs snapshot. `passed: true` is supported only for this recorded connectivity experiment, not local-only egress guarantees, OS isolation, full context performance, usage accounting or actual provider termination.

## Reviewed snapshot SHA-256

| Path | SHA-256 |
|---|---|
| daemon/src/capability-admission.ts | DA9073981F0EBC5FF1F0D1CCA2F81022D2163DA0524B521AA0C47D17D8BE8530 |
| daemon/test/capability-admission.test.ts | 544E2EFD07075F34756619ED0F56DDE463CCA557C5933EEF57EBE5F52CEA795C |
| daemon/src/measurement-subject.ts | 57566FBF0CE1554E196BAD6A77AAAAB698841029E9FC8B6FB959257A5760FDD1 |
| evidence/integrations/S1/20260911-qwen-live/result.json | 9C2F0BD6475E3890C5D5547173667D841325039013501D5A25E837EF8661AA40 |
| scripts/reuse/model-transport.mjs | 77D5835FEE99A96BAF87017D5EFAE99458D3B702E060453E9ECB62BB2CD42A28 |

