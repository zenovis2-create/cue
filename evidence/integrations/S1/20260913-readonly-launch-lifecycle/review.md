# Independent readonly launcher lifecycle review

Verdict: **PASS for the bounded offline launcher lifecycle scope**

The post-ACL launcher now has one guarded terminal path for its configured timeout plus 15 seconds, abort, process error, missing or failing stdin, and output overflow. Failure is locked before verified tree termination begins, so synchronous or later success-looking data and `close(0)` events cannot promote the result. Verified termination settles the call even when `close` never arrives. A termination verification failure rejects explicitly as `readonly_launcher_termination_unverified` and retains the runtime directory.

Normal launcher close remains separate from forced termination. When a worker PID was observed, `verifyProcessesDead` must succeed before runtime removal and is now an explicit part of the clean/authority predicate. The regressions cover both a present runtime and an externally absent runtime when worker death is unknown; neither case records identity or cleanup authority. Thus disappearance of the directory cannot substitute for verified process death.

The negative lifecycle matrix mocks the OS/process edges and asserts that identity-store methods are never called. It does not fabricate positive receipts. Source inspection confirms that the existing success path still requires all prior evidence together: non-aborted exit 0, exact PID and creation time, verified worker death, one nonce/root-bound cleanup frame, ACL/profile/runtime/root checks, unchanged control verification, and successful durable identity then cleanup store writes. This review does not claim a new live success execution.

The post-spawn throw path remains owned by `spawnOwned`: it either returns a durable owned session or verifies termination before throwing. Only after that throw does this worker remove the newly created, unused runtime directory.

## Independent gates

The maker's exact two-file gate was first reproduced at 11/11. At the root's request, the final proportional receipt included the prior ACL matrix against the same frozen worker:

```text
npx --no-install vitest run test/integration-readonly-verifier-launch-lifecycle.test.ts test/integration-readonly-verifier-bootstrap.test.ts test/integration-readonly-verifier-acl.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

From `C:\Users\User\cue\daemon`, this exited 0 with **3 files and 23 unique tests passed**. The maker's build passed before freeze. I did not rerun the build, full suite, native helper, PowerShell launcher, model, or network.

## Frozen hashes

- `daemon/src/readonly-verifier-worker.ts`: `19DA25C14A041CC9AA93D6437826F3741CD828720B075AC224064F987764EEE1`
- `daemon/test/integration-readonly-verifier-launch-lifecycle.test.ts`: `EB5F3DC4CE7272664BE840E3BAD01D53C7714D8A7352D4A7D52C02B1CA5E32BF`
- `daemon/test/integration-readonly-verifier-bootstrap.test.ts`: `46A76F1EAB30CB9DDDB35339E3E26FDF2AB855E035686DFA75FC0C0C2020284C`
- `daemon/test/integration-readonly-verifier-acl.test.ts`: `5F685C517622C1D1DBEC9211DB4D5A4A6810DBE6E21454FDF52823906B74565A`

No blocker remains within this mocked post-ACL launcher lifecycle scope.
