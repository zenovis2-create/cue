# S4 generated revision follow-up results

Date: 2026-09-12

Status: generated revision defect corrected; broad S4 status intentionally unchanged.

The immutable target retains the original approved plan/checker/parameters contract. A generated observation now records the exact plan digest of its owning stage, and a nonzero revision is accepted only when `orchestration_attempt_revision`, `orchestration_plan_revision`, and `orchestration_recovery_scope.original_plan_digest` establish the exact link back to that original target. Acceptance compares the current context to the observation plan digest while continuing to validate the target's frozen contract. Recovery-scoped principal checks include every failed and successful maker attempt in the exact selected revision; legacy ledgers keep the all-history independence rule and guard absence of the recovery table. Attempts from another revision neither satisfy nor poison review of an artifact whose observation is linked to the selected revision.

Measured commands:

```powershell
cd daemon
npx --no-install vitest run test/integration-acceptance.test.ts test/integration-generated-acceptance-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
# PASS: 32/32

npx --no-install vitest run test/integration-generated-acceptance-host.test.ts --fileParallelism=false --maxWorkers=1
# PASS: 8/8, including the explicit revision-one producer/checker/acceptance path

npm run build
# PASS

npx --no-install tsc -p tsconfig.json --noEmit
# PASS

git diff --check -- src/verification/generated-output.ts src/verification/generated-acceptance-host.ts src/verification/acceptance.ts test/integration-generated-output.test.ts test/integration-generated-acceptance-host.test.ts
# PASS
```

The direct generated-output plus generated-host run passed 12/15. The revision-one host path and nine direct generated checks passed. Three pre-existing direct-storage retry assertions now fail after concurrent orchestration semantics changed (`task_not_ready`, expected failed but received blocked, and `retry_previous_not_clean_failed`). They do not reach or contradict the generated revision identity checks and were left for the retry/store owner.

Negative evidence remains green in `integration-acceptance.test.ts`: a prior failed producer response is rejected, all historical principals still count for legacy retry chains, stale retry receipts are rejected, and verifier identity shared with a past producer is rejected. Existing generated-output cases reject foreign runs, wrong producer tasks, changed target/checker/input contracts, corrupted stage lineage, and replay mutations. The explicit revision-one test proves the target retains revision zero's digest while its observation carries revision one's exact digest.

Final SHA-256:

```text
188d663e41b21efd8255995a600e7f4c0311d60fd8d026f715cf8406a77ef77b  daemon/src/verification/generated-output.ts
9cbd97924ef26d7051e06616e69ea320cd34ffdb07025fbaa51ef1f393e05462  daemon/src/verification/generated-acceptance-host.ts
d7933952525e1b289eafdad38c507d8ae2a8c207704df6ddfd10efc15af65c74  daemon/src/verification/acceptance.ts
3de99561dbe6789f14cd381ae5d737f9393924b799a9fcae10961ecb8b3a57a1  daemon/test/integration-generated-output.test.ts
9a62c7f9f6d30fd2c56b9bd5e4dec55b6fb27328435255db7b20818fa95c1a57  daemon/test/integration-generated-acceptance-host.test.ts
```

Root gate chunk `7f5952` exposed a regression where recovery-scoped checks used only current task tips, allowing a verifier identity shared with a failed maker in the same revision. The correction filters the complete immutable stage history by exact plan revision, retaining failed and successful maker principals from that revision.

```powershell
cd daemon
npm run build
npx --no-install vitest run test/integration-acceptance.test.ts test/integration-generated-acceptance-host.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
# PASS: 68/68
npx --no-install tsc -p tsconfig.json --noEmit
# PASS
```

The driver regression `requires independent verifier identity against failed makers as well as the latest successful maker` now blocks acceptance as required. The explicit generated revision-one case remains accepted when its failed producer belongs to revision zero because the reviewed observation is linked through migration 036 to the successful revision-one producer attempt.

Built SHA-256:

```text
7555e4d0f3d9461afe3fad37da34fa07b5389d22ce7120a7915dbc459dd11a67  daemon/dist/src/verification/generated-output.js
6b9da24ddb7d3d2c9f256e752d9cdd1771acd1df25eac19fa1e080e0c418e458  daemon/dist/src/verification/generated-acceptance-host.js
d39abbea60ab4594246a5914e069dbf6fea956f842621c2a0311d7204d85fbc8  daemon/dist/src/verification/acceptance.js
```

No model, native provider, Electron, network, or paid call was used.
