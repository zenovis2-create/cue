# Independent actual v2 evidence review

Date: 2026-09-12

## Verdict

The single authorized v2 execution **completed the production workflow successfully but the gate reported FAIL because its final row auditor used the wrong SQLite row shape**. No retry is authorized or needed to establish this retained run's production result. The two intended producer legs are consumed.

Both spawned Electron children exited `0`, closed normally, and did not time out. The qualification summary reports eligible with confirmed cleanup. The fresh normal application observer reports `completed` under Electron 44.2.0 / Node 24.20.0 / ABI 149 with the exact owned user-data and session-data paths. The final installation generation equals the approved digest, with no source-drift flag.

The result's `checker_revision_qualification_mismatch` is a false mismatch. The executed auditor accesses `generated_output_target.checker_revision`, `input_sha256`, `producer_task_id`, `checker_id`, and `parameters_digest` as columns. The actual table has only `run_id`, `target_id`, canonical `payload`, `digest`, and `input_bytes`. The decoded target payload, qualification production-pass boundary, requirement policy, and checker snapshot all contain the same revision:

```text
v1:34ab9e98f097710643694446e8dee97d5fb2f2be437d0206f734148a443cfbdc
```

That digest also equals the frozen source and compiled `json-format-checker.cjs` bytes. The row auditor therefore compared the independently derived expected revision with `undefined`; it did not detect a production mismatch.

## Retained ledger result

The backed-up SQLite ledger passes `integrity_check` and has no foreign-key violations. Strict production readers reopened it read-only and established:

- one workflow run with exactly two attempts;
- `produce-json` used `cue.local.qwen38-27b-unc`, completed, and has `cleanup_verified=1`;
- `verify-json` used `cue.checker.json-format`, completed, and has `cleanup_verified=1`;
- the generated output is exactly the approved formatted JSON, bound to the producer attempt and `formatted-json` target;
- the requirement contract has one required document check, one checker snapshot, and one matching evidence policy;
- the policy binds the exact input SHA-256, target, producer task, checker revision, parameters digest, and source revision;
- strict acceptance verdict `pass`, final status `accepted`, and the one required outcome is `pass`;
- two workflow receipts resolve through canonical cleanup-store reads to `verified-clean` observations;
- both workflow attempts have durable native identities; identity, attempt, cleanup candidate, subject and all six session fields agree;
- no workspace writer lease remains.

There are six native identity rows in the final database: four belong to qualification executions and two belong to the workflow. The earlier intermediate count of five was not the final retained state and must not be used as the workflow identity count.

The producer receipt was observed at `1789218430190`; the checker receipt at `1789218467893`. The native checker cleanup records the installed checker-core SHA above. Provider stop and monetary billing remain `unknown`, as designed.

## Request-count boundary

The ledger has one successful `production-model` qualification artifact and one completed workflow producer attempt. These are the two intended Qwen-producing legs. It also has two local invocation reservations for the workflow because the native checker is separately dispatched. There is no provider-side HTTP counter, so this review cannot prove transport-level request cardinality or exclude an invisible provider retry. The gate contract and source have no application retry path. The authorized two-leg allowance is treated as consumed; this review does not authorize another request.

## Preserved execution identity

```text
E34418BA6397F2403540D1C291EB1A1A043EBA358F77EB6CB5E3F1F2A6B2241C  executed-local-json-electron-gate-v2.mjs
BED50E0D5556EFF6901B81911015AC753D4A5D3A7F8B79B4198169C43AFBD25E  executed-integration-local-json-electron-gate-v2.test.ts
68CF925EBDEAE47B42DB491ED6D0918A8ECAD56FD71D4B8A0146D1E799850A9F  approved and final installation generation
```

The exact executed runner and its then-current test are archived beside this review. The v1 runner and its exhausted evidence remain unchanged.

## Raw evidence hashes

```text
639582CBCE1FD1715CDEDD2B17DC59BDF890F1726FC27E722FAE69571E68C1C4  result.json
188A878460B279EA6865F55D337DBCC33ED07ED0AB18CE2267481F8C3249862A  ledger.sqlite
392836D96AE3644C773056026138C3A6BC1E68BB21C5E7B870D8D4EABF418AFA  observer.json
3D3C43804FF4A4B4D0763C50B32D4A8ECBE977246C1122B60343897C4BAB5770  workflow.png
FD1DB4E373DA3784F2006503CD4B4A4A86707AFB31994EE7F05175B09E235A11  qualification-raw-ledger.json
6E7122EF02C61C203C4D87C7EACDCBDC6542E5DD2DEBF65707A5BCFCA83DFD5A  workflow-raw-ledger.json
```

Raw files remain at `D:/Temp/User/Cue.ElectronGateV2.unHYVI/evidence`. This review performed read-only database and file inspection only. It did not start a model, Electron, native helper, cleanup process, or retry.
