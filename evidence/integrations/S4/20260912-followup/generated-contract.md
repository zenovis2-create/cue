# S4 generated revision follow-up done contract

Date: 2026-09-12

Done means the immutable generated target continues to bind the original approved producer/checker/parameters contract, while each generated observation binds the exact plan revision of its owning attempt through the recovery revision tables. Revision zero remains accepted. Wrong, stale, forked, cross-run, and target/producer mutations remain rejected.

Maximum: four distinct diagnosed correction passes.

Independent-gate continuation: root chunk `7f5952` exposed that using only current tips weakens same-revision producer/verifier independence. Up to four new diagnosed correction passes are authorized for this narrow regression. Done additionally requires every failed and successful maker principal in the selected revision to participate in independence checks, while attempts from other revisions cannot poison or satisfy that revision.

Every pass runs:

```powershell
cd daemon
npx --no-install vitest run test/integration-generated-output.test.ts test/integration-generated-acceptance-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install vitest run test/integration-acceptance.test.ts test/integration-generated-acceptance-host.test.ts test/integration-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

When an interface changes, also run:

```powershell
cd daemon
npm run build
npx --no-install tsc -p tsconfig.json --noEmit
```

A failing pass is followed only by a new diagnosis and changed hypothesis. Keep a change only when the measured gate improves; otherwise revert that pass. After four diagnosed correction passes, record the remaining failure for human review. The root agent owns the independent final checker.
