# S4 Unit 1 acceptance continuation — FINAL BLOCKED

Date: 2026-09-12  
Status: **FINAL BLOCKED at correction pass 2**

The Unit 1 implementation/correction allowance is exhausted. No further product or test correction is permitted in this unit.

## Final generated-host result

Command:

```powershell
cd daemon
npx --no-install vitest run test/integration-generated-acceptance-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: **7 passed / 1 failed**.

- The seven legacy revision-zero generated JSON cases remain green.
- The new explicit revision-one positive case passes the corrected `launchVerifier` revision/plan lookup, then fails with `generated_checker_response_missing`.
- The reproduced cause is `generated-output.ts` binding every target and recorded output to the original approved plan digest. A revision-one producer stage has the revised plan digest, so its output is rejected by the existing target/attempt lineage check and no revision-one response can be collected by the generated acceptance host.
- This is a product-contract gap, not missing user authority. `daemon/src/verification/generated-output.ts` was outside the authorized correction surface, and the final correction instruction allowed only the already-observed `launchVerifier` tuple propagation fix.

## Preserved earlier results

- Combined initial baseline: build PASS, TypeScript PASS, 81/90 focused tests PASS; nine stale retry fixtures failed mandatory evidence-policy registration.
- Correction pass 1: 98/103 focused tests PASS; five retry fixtures remained invalid under S3 terminal integrity / legacy schema handling.
- Acceptance/evidence-policy/requirements/generated-host focused set before the revision-one addition: 42/42 PASS.
- TypeScript and build passed after the frozen source-revision and exact-revision host changes.

## Frozen SHA-256

```text
f48341752511aa129963cc159143ce90eb5c161b96d6bef8d589c3137bc58767  daemon/src/verification/evidence-policy.ts
943ebf27801d27b5c2737b037f907e5cad25b7f9e497554816708f3a022dcd5d  daemon/src/verification/requirements.ts
ec5ca58e9249e332200665fc5fe5b3fbbb9ab2fce48b2728d785450b4304c614  daemon/src/verification/acceptance.ts
c9bd68ee47ec76c577635bfa2ffc0cbc99eef836625abd0403b0a272d9271633  daemon/src/verification/generated-acceptance-host.ts
0d8450d938dd26faed15df4e434564f606ebcc02198411cf4945ce72026cee69  daemon/test/integration-evidence-policy.test.ts
45b18d443479b83d751321ed6522cf6f705d3bc5c881ea66e1dc98c82e0cbf26  daemon/test/integration-requirements.test.ts
073020362c022a9c83854ccc3ba9e816bc122a9abb3b5581037fdf4a9be2acda  daemon/test/integration-acceptance.test.ts
b2e0f17d38569ffebdc382ebcfdb6381a309e200e4628ef1e5ceb6b5b575fd7b  daemon/test/integration-generated-acceptance-host.test.ts
82ffca12c48c65d17d5a48deab7a7377a2877a868f147817cc021af6d8809826  daemon/migrations/036_s4_recovery_revision.sql
```

Unit 1 must remain open. A separately authorized follow-up must define how immutable generated-output target approval binds carried or newly produced artifacts across plan revisions without weakening the exact revision lineage required by acceptance.
