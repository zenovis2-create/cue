# Independent actual-startup evidence review

Reviewer: broker_review, 2026-09-11. Read-only audit of the existing compositor1 attempt; no new Electron execution, build, model call, or original evidence edits. Completion criterion: correlate script, actual receipts, source hashes and separate functional/visual outcomes. Correction cap 2; used 0.

## Outcome

Functional settings-absent startup gate: supported by the recorded actual execution. Visual gate: FAILED. Overall result remains **passed: false**. No complete startup QA or release approval is granted.

[Window receipt](compositor1/window.json) records the actual project renderer URL and preload IPC reads: settings unconfigured/revision null/disabled, selection unavailable, general template, hidden inactive Stop, disabled Approve, and renderer process undefined. Observed preferences are nodeIntegration false, contextIsolation true, sandbox true. before-quit and will-quit were observed. [Process receipt](compositor1/process.json) records PID 41956 closed with Electron exit 0. Its assertion failure is consistent with the missing screenshotPassed field, not evidence that Electron itself exited unsuccessfully.

[Result](compositor1/result.json) records the post-exit SQLite gate and zero rows for task, session_handle, orchestration_attempt, local_host_settings_snapshot and local_invocation_budget. The reviewed harness performs a read-only SQLite open, requires integrity_check=ok, requires those counts to be zero, and checks before/after hashes before writing this result. The temporary database was subsequently removed by the harness; this audit corroborates the receipt and source control flow, not a new independent database query.

All 14 recorded source hashes matched current files during this audit, including package main/start/main/preload/renderer and the harness. Harness SHA-256: `4E696A62ACEB4C32E5E754EAE405FC273211E2CC5AE09FD393C2D5C4AE54D3BE`.

The actual BrowserWindow observation is visible=false. The harness throws before requesting CDP capture, so no screenshot exists and screenshotSha256 is null. windowsHide:true or display/compositor behavior is only a hypothesis; no causal conclusion follows from this run.

## Evidence hashes

| Artifact | SHA-256 |
| --- | --- |
| compositor1/result.json | BA30B9B80B6C7A911C5A842066886807D334CF664D210A7946ACABAE9734126B |
| compositor1/window.json | 91B66A058CB3EF3B40FF5B1226C065FE9868AC98E3DEC2DA2EDDFDDE22B675AB |
| compositor1/process.json | F9E2FDA29568ED8616CDDE3E232A44B651CC918DF8FFB233BE5FFB46CB849150 |
| compositor1/process.log | 7EB70257593DA06F682A3DDDA54A9D260D4FC514F645237F5CA74B08F8DA61A6 |

## Preserved failures and limits

The [first attempt](process.json) failed observer loading before startup observation; the [second attempt](attempt2/summary.json) observed preload/renderer state but failed its hidden-window screenshot and did not establish normal shutdown/SQLite gates. Their [historical partial review](partial-review.md) remains intact. The later compositor1 evidence does not retroactively change either failure.

The observer uses NODE_OPTIONS preload injection and disables hardware acceleration; this is an instrumented actual package startup, not an unmodified production launch or fresh qualified module closure. InferenceCalls=0 denotes the scripted scenario, not measured provider/network telemetry. Zero ledger execution rows and settings absence support the no-task scenario. Active Stop behavior, qualification, model execution, native-cache closure identity, acceptance and visual rendering correctness remain unproven by this evidence. Closed child process is not an exhaustive machine-wide process census.
