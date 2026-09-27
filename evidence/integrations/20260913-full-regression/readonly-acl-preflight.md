## Readonly ACL preflight gate

- Done: mocked-spawn tests prove a 5-second ACL deadline, pre-abort before spawn, abort/overflow termination of the owned ACL child, a combined 64 KiB output cap, bounded settlement without `close`, and fail-closed behavior for spawn error, nonzero exit, and empty output. No failure path launches the verifier or produces clean receipts. Existing positive ACL-to-failed-launcher transport coverage remains green.
- Attempt cap: 2 focused test runs.
- Every pass: `npx vitest run test/integration-readonly-verifier-bootstrap.test.ts test/integration-readonly-verifier-acl.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`, followed by one `npm run build` after green.
- Failure handling: retry only with a new implementation or fixture hypothesis; after two focused passes, return evidence to the root agent.

## Result

- Attempt 1: all 13 assertions passed, but Vitest rejected the run for a late-attached fake-timer rejection handler.
- Attempt 2: PASS, exit 0; 2 files and 13 tests passed with no unhandled errors.
- Build: `npm run build -- --pretty false` PASS, exit 0.
- The five seconds is the observation deadline trigger. `terminateVerifiedTree` remains a separate synchronously bounded verification operation.
- Frozen SHA-256: worker `F1E3371CBF5FA444756526E0401724BADD17997B99D9E8DE43F9F2A4E9E20CD4`; ACL test `5F685C517622C1D1DBEC9211DB4D5A4A6810DBE6E21454FDF52823906B74565A`; bootstrap test `88EC1DA32E28917AC13C021760E577F80B860A5B44F74DAB3FCB277F27B06A18`.
