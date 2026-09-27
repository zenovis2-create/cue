# Readonly launcher lifecycle

Canonical copy of `evidence/S1/20260913-readonly-launch-lifecycle-discovery/PLAN.md`.

## Done contract

- Done: the real worker through mocked `spawnOwned` settles fail-closed when the post-ACL launcher never closes, errors, is aborted, or has absent/failing stdin; late events cannot create authority; termination failure stays explicitly unverified; the existing successful identity path remains covered.
- Attempt cap: 2 focused test runs, one RED against the current close-only lifecycle and one GREEN after the smallest production fix.
- Every pass: `npx vitest run test/integration-readonly-verifier-launch-lifecycle.test.ts test/integration-readonly-verifier-bootstrap.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.
- Failure handling: retry only with a new source or fixture hypothesis; after two passes, return evidence to the root agent.

## Source finding

`daemon/src/readonly-verifier-worker.ts` starts the verifier at line 46, arms an emergency kill at line 47, and awaits only `close` at line 50. A kill request does not guarantee `close`, so timeout, abort, post-spawn error, and stdin failure can leave `launch()` pending before runtime cleanup and its fail-closed authority result.

## Bounded implementation

Use one guarded finalization path for `close`, `error`, abort, output overflow, stdin absence/failure, and `command.timeoutMs + 15000`. Lock failure before requesting verified tree termination, settle after that bounded synchronous verification even without `close`, clear listeners/timer once, and ignore late events. Preserve the current zero-exit PID/cleanup/root/control checks for success.

The five-second ACL deadline remains separate. The launcher deadline is the existing configured timeout plus 15 seconds; verified termination has its own bounded observation time.

## RED test

The second mocked spawn has an owned PID and never emits `close`. Fake timers advance to the existing launcher deadline. Current source requests `kill()` but leaves the Promise pending; fixed source requests verified termination and returns failed with null identity/cleanup. Adjacent cases cover error, abort, stdin absence/error, synchronous late close during termination, late data/close after settlement, and termination verification failure.

No native helper, PowerShell launcher, model/provider, schema, acceptance, or public API work belongs to this unit.

## Result

- RED: the no-close deadline case failed because verified termination was never called.
- Final focused gate: PASS, exit 0; 2 files and 11 tests passed.
- Build: `npm run build -- --pretty false` PASS, exit 0.
- Authority requires verified worker death even when the runtime path is externally absent. Unverified launcher termination rejects explicitly and retains the owned runtime.
- Frozen SHA-256: worker `19DA25C14A041CC9AA93D6437826F3741CD828720B075AC224064F987764EEE1`; lifecycle test `EB5F3DC4CE7272664BE840E3BAD01D53C7714D8A7352D4A7D52C02B1CA5E32BF`; bootstrap test `46A76F1EAB30CB9DDDB35339E3E26FDF2AB855E035686DFA75FC0C0C2020284C`.
