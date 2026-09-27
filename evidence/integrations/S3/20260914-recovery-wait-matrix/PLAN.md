# Recovery wait matrix plan

## Completion contract

- DONE: `npm run build` from `daemon` exits 0.
- DONE: `npx vitest run test/integration-driver.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon` exits 0.
- Checklist: retry, switch, and replan each transition blocked to running; the held replacement receives exactly one response with exact attempt identity, durableRef, content ref/hash/bytes; the failed attempt stays clean and cannot create a wait; switch selects agent-b; replan persists revision 1 and matching plan digest; replay and reopened-driver resend do not redeliver.
- Attempt cap: two implementation revisions total, including fixture corrections.
- Every pass runs the full build and four-file Vitest gate above; preserve raw logs and exit codes from the first call.
- On failure, revision 2 requires a new evidence-based hypothesis. If revision 2 fails, stop and hand off.

## Baseline and source pins

- Reported baseline: 76 tests.
- Owned test preimage SHA-256: CDB2DC7B868332917336E0769B5AE0333AFECF2093F722FFF7ADB181C97B6156.
- `app/orchestration-driver.mjs`: 79D44E00EF70E9D28ACFE54A71FBCEE5EBC2BDD39198141D65BF35B511076CDF.
- `daemon/src/request-queue.ts`: D6694CA7344CEDAD43E36E88054873C3F4995B2B3F214107F9F31A5CCE0D322F.
- `daemon/src/orchestration/store.ts`: 267B755F0C6CE4EC4267B522686878D77305FA19AD12354A72B0045FDEAA5E02.
- `daemon/src/orchestration/recovery-policy.ts`: 06EB66D823B26648CE471F2B5E23A2B95942CF859BD4B36772FFB5855E8EA5CB.

## Scope limits

- No queued-old carry-over behavior and no live-process reconnect.
- Preserve the existing absolute retry deadline at `time + 1000`.
- No model, server, network, native, live Electron, commit, or push operations.
