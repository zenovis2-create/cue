# Integration-driver fixture correction review

## Verdict

**CLEAR within the tested fixture scope.** The correction separates target-free synthetic orchestration cases from the three cases that actually exercise writable staging and journaling. Production source is unchanged, existing assertions are retained, the negative journal behavior remains explicit, and the final focused and supporting gates pass.

## Scope reviewed

- `daemon/test/integration-driver.test.ts` against the whole-file preimage under `preimage/`.
- The writable-stage admission, change-target, staging, and lease paths in `app/orchestration-driver.mjs` as context only.
- `driver-fixture-correction/PLAN.md` for the completion gate and attempt cap.

## Source assessment

The common fixture no longer declares a default change target or grants `file_change` merely because a planned task has the `implementation` role. Its stage grant now includes `file_change` only when the configuration contains a change target bound to that task. This matches production admission, where a writable stage must have bound change targets and attempt-owned staging. The target-free cases still exercise their original roles, session handles, lifecycle behavior, reservations, and lease assertions; their assertions were not removed or relaxed.

The correction adds a real staging fixture for writable cases:

- it derives a publication-root identity from the fixture worktree;
- creates an attempt-owned execution root;
- copies declared existing-file targets into that root;
- identifies and later removes the execution root;
- enables the staged-existing-file publication host; and
- advertises the candidate's required staged-publication protocol.

`enableWritableTarget` writes an existing top-level target and enables the matching change-target, staged-publication, and execution-staging contracts. It is used only by the three tests whose behavior depends on writes:

1. writer serialization after a parallel read wave;
2. refusal to retry after real file-identity replacement; and
3. propagation of a real modified-file observation to the evidence gate.

Those tests retain their prior ordering, journal, lease, and blocked-state assertions. The identity-replacement negative still removes and recreates the publication target, while the modified observation still changes its contents in place. No negative assertion was deleted or converted to a weaker outcome.

The real-restart child had the same handle-only mismatch. Its implementation-role task now receives an empty action set and no synthetic change target; its parent restart and wait-delivery assertions remain unchanged. The final 77-test gate includes this real child-process restart case.

## Evidence limits

- Final corrected `integration-driver.test.ts` SHA-256: `00e53341e6f27a58967a2d586d1a190c98d525b197e495ebbf88de42451ff821`.
- Final corrected real-restart child SHA-256: `a2e015538eacff84771a4fa3ca927c2615e065540c17a9cc972ceedc2e15846`.
- The plan records pre-edit SHA-256 `d5dbe8445b045416fd8004f4c0e68ddb2f7f8a0cc0c91b1fa9a98c9a882a8623` and Git object `36a1e7906f2ac9b73bdd7da400e6972483beb223`. The stored preimage copy hashes differently (`b3f3c613d5b8595e8c0e6390095bc38b4ba339e56f264edb62a3e459f2260c53`), so this review does not claim it is byte-identical; its content diff identifies the intended fixture-only edits.
- This is a source review, not a broader S3 closure claim.

## Verification

The retained first pass reported 76 passed and 1 failed. That failure identified a local scope-isolation fixture override that still granted `file_change` despite exercising only digest and envelope-path isolation. The correction changed that local override to an empty action set; it did not remove the test or any assertion.

Final evidence:

- driver plus real restart: 77/77 passed (`pass2.raw.log`, SHA-256 `016d9941fdff96224dbca6c5885891ba17ed13da9611c841ae8aaca058c7ff45`);
- publication plus named orchestration: 26/26 passed (`supporting.raw.log`, SHA-256 `380fc8d9c1903a0cc48140c7cbecc156141cbea535de14ad6837c1c83b64fb99`);
- TypeScript `--noEmit`: exit 0, no diagnostics (`tsc.raw.log`, SHA-256 `8680e3c78d218d4897e6053b6240e71a78c97855b21fef4b24675ea03e5ba6b0`); and
- the first-pass 76/77 log is retained as `pass1.raw.log`, SHA-256 `e119e7434ccead6ff969e414d572a8f32d489fa2a321ed6ac5ad0161b6100fde`.

The production limits already recorded in `RESULTS.md` remain: command-capable writes outside declared `file_change` are unclassified, and failed-but-clean staged execution lifecycle needs separate design and tests. These fixture gates do not close those gaps.
