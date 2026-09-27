# Recovery host/Core — maker evidence

Final maker gate: **host 8 PASS + observer 14 PASS = 22 PASS**, final TypeScript noEmit exit 0. Root coordinated combined build exited 0 before the frozen-source gate; product source was not edited afterward. `hashes.json` records all eight owned source/type/test files. Independent broker review pending. No maker native/helper/model call or historical DB modification.

## Executed checks

- `npx vitest run test/integration-native-recovery-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 8 PASS, 00:49:38, 17.19 seconds.
- `npx vitest run test/integration-native-recovery-observer.test.ts --reporter=dot`: 14 PASS, 00:49:09.
- `npx tsc --noEmit -p tsconfig.json`: final exit 0.

The host suite captures a genuine current installed generation using bounded file hashing, after module import. This validates authentic object/root/dependency binding and current checks, **not fresh-entry pre-import ordering**. Actual SQLite is reopened from owned temporary fixtures; all observer process/stat operations are explicit doubles. SourceKind remains fixture. Native observation is not claimed.

The positive Core test verifies an old, missing stage directory remains queryable, no local execution settings or provider health call is needed, results are frozen and omit PID/FileTime/absolute paths, and serialized DB bytes plus total_changes remain identical. Negative gates cover foreign run/attempt/reference, workspace mismatch, tampered stage, fake generation/proxy/getter, genuine foreign installation/dependency roots, abort and in-flight session drift. The resolver also enforces role/clientKind binding in source, without a standalone negative fixture for that branch in this maker gate. A controlled restored process.versions.node change confirms the actual generation check rejects before publication; source-drift callback behavior is independently covered by the observer suite. No product file is modified to manufacture that test.

Full guard cadence is explicitly two calls, before observation and publication, irrespective of ancestor count. An artificial eight-second guard in each phase proves those costs are outside the five-second OS-observation deadline; timing metadata explicitly reports totalResponseBounded=false. Query hangs still abort at five seconds. Lightweight helper hash/DB/identity/abort checks remain around each await.

## Failure and correction history

1. First combined gate: **19 PASS / 3 FAIL**. Test fixture put ledger.sqlite directly under the parent of workspace, correctly triggering existing Core protected-path overlap validation. Corrected only fixture layout to sibling data/ledger.sqlite and workspace. Product validation remained unchanged.
2. Next host gate: **7 PASS / 1 FAIL**. Dotted-run test performed four full installed-closure hashes (list+observe) and took 5.160 seconds, exceeding Vitest's default total five-second test limit. Corrected only this suite's finite test/hook timeout to 30 seconds, consistent with the explicit no-total-five-second-SLA contract. The product OS deadline stayed five seconds. Final host 8 PASS supersedes both checkpoints.

An earlier drafting typecheck reported another owner's attempt-decision-store nullability error; no ownership-crossing source change was made. Final coordinated build and final noEmit are clean.

## Remaining boundary

No IPC/UI, restart/resume, ownership release, cleanup receipt, acceptance, database repair or automatic process action was added. The previous successful actual observer proof belongs to the old per-ancestor guard cadence; it is not relabeled as proof of this new Core integration. Independent review and any authorized actual native/Core QA are separate gates.
