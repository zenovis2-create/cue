# Independent S4 follow-up review

Verdict: PASS for the repaired generated-revision, legacy-read and concurrent retry-claim paths and the defined follow-up regression gate. This is not whole S4 or S0-S7 completion.

Root reviewed the source and ran the integrated tests independently of the Sol implementers. Earlier blocked results remain preserved under `20260912-recovery-policy/`.

## Measured final gate

From `daemon`:

```powershell
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-evidence-policy.test.ts test/integration-retry-backend.test.ts test/integration-requirements.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-generated-output.test.ts test/integration-generated-acceptance-host.test.ts test/integration-driver.test.ts test/integration-handoff-activity.test.ts test/integration-handoff-integrity.test.ts test/integration-request-queue.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts test/integration-reports.test.ts test/integration-report-comparison.test.ts test/current-source-report.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npm run build
```

Final result: **16 files, 143/143 tests PASS**, exit 0, 33.54 seconds (`7b8549`); independent current build including TypeScript PASS, exit 0 (`b8505f`). Scoped diff checking passed (`7a86fb`). The existing README has unrelated trailing whitespace; the broad repository diff check is not credited as green. Migration 036 remains unchanged and source/deployed SHA-256 is `82ffca12c48c65d17d5a48deab7a7377a2877a868f147817cc021af6d8809826`.

The final gate includes generated revision-one producer/checker/final acceptance, the failed-maker identity collision negative case, historical receipt tampering, exact terminal artifacts, concurrent consume-once retry, missing-artifact rejection, S3 checkpoint/handoff regressions and S5 Core containment. The two report suites and generator suite are included in the 143 count and must not be added to it again.

## Repaired behavior and limits

- Generated target approval keeps its original plan, requirements, checker and parameter identity. An output observation binds its exact execution stage digest; nonzero revisions must link through attempt/revision/recovery scope to that original approval. Final acceptance compares the observation with its selected revision rather than incorrectly comparing it with the original target plan.
- Every failed and successful producer attempt in the selected revision remains in verifier independence checks. Historical output from another revision cannot satisfy that revision's acceptance. Legacy non-recovery runs retain all-history independence. Root found and rejected an intermediate current-tip-only relaxation; the existing driver collision assertion is now green without being weakened.
- Historical state reading checks schema availability before querying the later handoff table. Current-schema missing terminal artifacts still fail closed. Historical fixtures construct their actual schema, and current fixtures provide real selection, launch, identity, artifact and handoff records.
- The concurrent test opens both connections first, then releases retry claims together: one claim succeeds and the other reports `retry_previous_consumed`, with exactly one new attempt/link. SQLite busy is never translated into success. Concurrent migration initialization is outside this proof and remains unverified.

## Preserved failures during this follow-up

Root's first build failed on two test-helper argument types (`8fac37`); the fixture hash helper was corrected to match the crypto API. The first expanded gate was 135/143 with seven outdated history fixtures and the real failed-producer independence regression (`7f5952`). Both causes were corrected and the final gate above passed. No failed output was relabelled as success.

## Final source hashes

```text
188d663e41b21efd8255995a600e7f4c0311d60fd8d026f715cf8406a77ef77b  daemon/src/verification/generated-output.ts
9cbd97924ef26d7051e06616e69ea320cd34ffdb07025fbaa51ef1f393e05462  daemon/src/verification/generated-acceptance-host.ts
d7933952525e1b289eafdad38c507d8ae2a8c207704df6ddfd10efc15af65c74  daemon/src/verification/acceptance.ts
e891175af53ae244075c0d24697561a89495181f7d668617c91b11c704034a10  daemon/src/orchestration/store.ts
3de99561dbe6789f14cd381ae5d737f9393924b799a9fcae10961ecb8b3a57a1  daemon/test/integration-generated-output.test.ts
a01df300d2d0ca19594a7654427ebc9ec5eda2da67950c4572bb2a530d7b9a8c  daemon/test/integration-acceptance-history.test.ts
347e8ce6779ac0abd1b5c165ef91483ede6e26e40dbc776107ccf1fa55714227  daemon/test/integration-retry-backend.test.ts
```

S5 measured-fact capture remains quarantined; no performance or policy-promotion claim follows from these tests. The previously unmeasured reentrant-clock mutation case and broad S4 crash/change-journal/native/live gates are not newly certified here. No live model/provider/native-helper execution was performed in this S4 review. S7 current-source capture and Electron artifact checks have separate evidence.
