# Independent final S4-06 review

Verdict: **CLOSABLE for the original S4-06 contract.**

The preserved actual Windows run passed the five named files and all 10 tests against unchanged source/dist pins. Its console capture contains one exact parent-death identity record: parent PID `84100`, wrapper PID `131696`, and worker PID `15356`; wrapper and worker have nonempty creation records with their expected parent identities. Both after-identity records are `null`, and both current and original-instance alive flags are false. These observations were captured before the test's fallback cleanup branches.

The `6932 ms` value measures from before the synchronous `taskkill` call through the end of the subsequent bounded poll. The source test starts its five-second polling deadline only after `taskkill` returns. S4-06 defines no five-second total kill-and-poll SLA. The capture runner's `<=5000` total-latency assertion was therefore an extra, mismatched oracle; its `createdAt` expectation also mismatched the raw test DTO's `created` field. The original failed `result.json` remains preserved as `passed:false` and is not reclassified.

The runner compared all frozen source/dist hashes and the AppContainer profile count before reaching that later identity-extraction failure. The maker records profile count 6 before and after; the failed JSON did not preserve those fields, so this review does not claim a raw `profileAfter` field in that file. The passing parent-sentinel test itself requires the created worker profile to be absent before fallback. A later read-only cleanup observation found profile count 6 again and all three captured PIDs absent.

The retained root was independently checked as the exact canonical path `D:\Temp\User\cue-parent-watchdog-capture-v2-gN4iBr`, under canonical parent `D:\Temp\User`, empty and not a reparse point. It was then removed without a recursive sweep, and absence was verified. No OS test was rerun.

Together with the separately reviewed targeted-stop isolation receipt, the run supplies current-test exit 0 plus actual owned-process stop/parent-death evidence. The named verification and enforcement-seal tests passed their refusal cases, including post-seal tool-call refusal and acceptance-authority restrictions. This satisfies the stated S4-06 gate.

## Limits

The processes are real local Windows fixture processes exercising the current launcher/controller/worker path. The controller and parent are test fixtures. This does not prove provider-side cancellation, billing cessation, production parent death under every timing race, AppContainer behavior on another machine, or non-Windows behavior. The initial console-capture attempt remains `unknown_fail_closed`; its malformed preflight is a harness failure, not a product failure.

## Evidence pins

- gate log: `068b0eab200f7430921a73396451d0a9b17b3b3805e1d52bd60ce2a204105f87`
- preserved failed runner result: `786d7288a42228a04a318eefe3c9548a26fec3aedd107b198a73ed4a142bbf30`
- postcheck cleanup: `de86c5f6e05e66b0263661f75e451d00f3124c316f39f6b4c4926784ef753176`
- postcheck disposition: `61a3e3fa3a88e2664170687e765fc056cee88de0eb2c78ad628cee58d9efca8b`
- postcheck plan: `5abfe5bf598ccfbc06825a1e613199e00d95a420a2c23ac6a5827e1eeaa4d9fb`
