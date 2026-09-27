# Subject manifest v2 — independent narrow review

2026-09-11. Reviewer contracts_review. PASS for required footprint integration. No product edits, current actual-manifest measurement, Qwen or eligibility issuance.

Done: verify mandatory owned fixed paths, source/test/compiled omissions and drift, preserved historical v1 evidence; focused test/typecheck exit0; hash current unit. Correction cap2, used0. One evidence write then read/hash check.

Independent cwd daemon:

- npx --no-install vitest run test/integration-model-measurement-subject.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 — exit0,4PASS,20:23:35,5.63s.
- npx --no-install tsc -p tsconfig.json --noEmit — exit0 (774934), after collector maker confirmed source landed and build-compatible. Collector implementation itself remains under separate review.

Both entries in maker source-hashes.json match current source/test. Manifest version is cue-model-subject-files-v2. Fixed model-boundary-probe.cjs and model-qualification.ts are mandatory source paths; their actual tests are mandatory common probe paths. The two source files participate in probeSuiteSha256 and enforcementSha256. Existing source-to-compiled closure requires the installed CJS/JS counterparts, with no missing-collector fallback. Tests independently changed/deleted each new source/test and deleted each compiled counterpart, verifying drift or refusal.

Enumeration/OS/loader behavior from v1 is not redesigned in this bounded delta. Existing fixture tests for closure, additions, out-root dependencies and path escape remain green. Probe file hashes identify bytes, not semantic correctness or approval of the collector. Changing those bytes still requires fresh subject-matched evidence.

The previous273-file actual manifest remains historical and was not regenerated or promoted. This review used fixture manifest roots and existing OS/runtime identity observations in their tests; it did not measure/publish the current complete installation subject. External TCB and installation-trust limits remain unchanged.

Current SHA256:
- daemon/src/model-measurement-subject.ts : AFA0D1DA65CF9E4C2B50D3396B13BA8AA21E0547E9CBD48C02D3947893B13C51
- daemon/test/integration-model-measurement-subject.test.ts : BDCBBF57CA5F111964C9C54916E54D5DD7F1E8AB3663F2DAAC577DC7A43F49E4
- evidence/integrations/S1/20260911-model-subject-v2/result.md : 413B52825C88895E6D4A1EF4967580C179B126D62E361B18DA49C1D6E77768EA
- evidence/integrations/S1/20260911-model-subject-v2/source-hashes.json : 8E9E3C2F9F5D9CF50C027B0E3DBCC4390CB9214C4B74D2FFCF155451A03102A1
