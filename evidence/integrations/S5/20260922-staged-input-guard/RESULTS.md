# Batch98 — frozen workload prelaunch staged-seed guard

2026-09-23. Direct implementation, self-review, no delegation or independent review.

## Change

- `daemon/src/evaluation/staged-input-guard.ts` validates an enrolled frozen workload against the pinned packaged suite, exact saved goal, full native checker contract, active staging setup/launch/attempt/envelope/plan/policy lineage and every expected initial file's bytes using the Windows native snapshot helper bound to the execution root identity. It rejects mismatch, absent/unknown helper results, outer transactions and observed DB epoch changes.
- `app/native-existing-file-authorities.mjs` calls this read-only check at `runtime.authorizeRun` for implementation attempts after the existing bound-attempt and candidate/service gates. Failure is caught by the existing native authorization path and returns false before runtime start. Non-enrolled runs and other dataset IDs do not acquire a frozen-workload claim. The verifier is not seed-checked after writer changes.
- The returned value explicitly says `point-in-time-staged-seed-check-only`, `executedInputVerified:false`, `executionAuthorized:false`, `promotionEligible:false`. Nothing is persisted as a measured fact, trial, approval or billing result. A check-to-launch TOCTOU remains; this is a protective prelaunch gate, not actual process-consumed input proof.

## Verification

Final from daemon/: `npm run build`, then `npx vitest run <41 paths in test-files.txt> --fileParallelism=false --maxWorkers=1 --reporter=verbose`.

- `build-final2.log`: exit0.
- `regression-final2.log`: **41 files /344 passed /0 failed /0 skipped /0 unhandled errors**, exit0. Start07:19:46 +09:00;144.62s. The earlier41/344 run predates final lineage hardening and is not additive.
- **7 new tests**: actual pinned release and native Windows helper against real temporary seed bytes/root identity; no enrollment, correct seed, wrong goal/contract, same-length changed/absent bytes, wrong stage/path/plan, lookalike dataset revision, outer transaction/duplicate goal. Test-only synthetic staging/launch rows reach the helper; they do not demonstrate real provider launch or staging issuer validation. Existing native-authority runtime and staging migration tests were included.
- Requested/executed test-file reconciliation, source/build/test/doc/preimage/log SHA pins are recorded separately. No real provider/model/account/service calls.

## Preserved failures and replan

- `focused1.log`:5fail/2pass. The new test fixture dropped a guessed launch-intent guard name, leaving the actual immutable hash trigger in place; synthetic `{}` payload failed before the staged input check. `lineage-fixture-failed.ts` preserves that source. Corrected the exact trigger name in test-only synthetic fixture.
- `focused2.log`:1fail/6pass. The test then attempted to mutate a running attempt to failed, which the terminal handoff integrity guard correctly refused. `terminal-fixture-failed.ts` preserves the source. After two bounded fixture hypotheses, removed that out-of-scope state-mutation assertion rather than weakening production DB guards; state is still checked in source and native runtime protections remain. `focused3.log`:7pass, then coupled final41/344pass.
- Self-review added cross-table candidate/run/task/plan/policy and stage/launch hash checks. A second final coupled run after this hardening is the authoritative result.

## Limits

No durable observation or actual consumed-input receipt is produced. Only frozen dataset ID/revision with its packaged release receives this additional native implementation gate; unrelated datasets continue under existing protected authorization without a new verification claim. Files outside the declared seed list and arbitrary later mutation are not covered. Failed authorization does not settle cleanup or billing. Current local environment remains incomplete and default measuredFactHost remains absent. Whole-suite regression after batch89, real native Electron acceptance, independent review, provider qualification and paired representative outcomes are still open. Checklist remains33/44 closed,11 open; Qwen OFF and subscription4/4 exhausted. No commit/push/publication, user-home/credential changes or unrelated cleanup.
