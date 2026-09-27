# Process-limit cause observation — independent review

2026-09-11. Maker `reuse_cli`; independent source review/execution `cue_fit`. Parent transcribed the terminal review.

```text
cwd: daemon
npx --no-install vitest run test/integration-model-boundary-process-limit.test.ts test/integration-model-boundary-hardkill.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
2 passed, 9.50 s
```

| Source | SHA-256 |
| --- | --- |
| model-only-launch.ps1 | 80bae8656bdf39d8123b941dd30b65b795d3271f82dc4bef706926fc039c5f4e |
| integration-model-boundary-process-limit.test.ts | dc1668503413148b408b407a0b3177c3c0a914c3a24104460806de66392d6882 |
| preserved observation test | 4d96cb15f07205d3bfbf0d41f0cb0ca7e6fbdef50ad8c22280b1f084018f58fe |
| preserved hard-kill test | ce59c5c117e8afc40cb6582228d2448fb8eea0caa432b185566ce7e9f5d3d365 |

The private IO completion port/key is attached to the empty owned Job before assignment. A controlled single child-spawn attempt is correlated with the retained worker handle/creation time, actual active limit 1 and a matching-key message 3 with NULL overlapped. The child success marker is absent. This is a Job-scoped process-limit cause observation; no nonexistent causal child PID is invented. The event drain is bounded, and missing delivery stays unknown. The completion-port association is detached before the port/key are freed. Guardian cleanup remains passing. No blocking finding in this scope.

Microsoft describes this message as active-process limit exceeded and does not guarantee delivery for this class of ordinary Job notification. [Completion-port contract](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port). Missing messages cannot prove the event did not occur.

The original generic Node error remains UNKNOWN and is not relabeled. This adds positive native cause evidence for the controlled probe; it is not a full M1/M3/provider eligibility receipt. Network ETIMEDOUT remains unresolved. Maker also reported observer regression/build pass separately; they are not added to the independent two-test command above.
