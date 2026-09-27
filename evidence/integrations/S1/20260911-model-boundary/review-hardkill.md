# Launcher hard-kill guardian — independent review

2026-09-11. Maker `reuse_cli`; independent source inspection and execution `cue_fit`. Parent `/root` transcribed the reviewer's terminal report; this is not a parent self-review.

From `daemon`:

```text
npx --no-install vitest run test/integration-model-boundary-hardkill.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
1 passed, 3.73 s
```

| Source | SHA-256 |
| --- | --- |
| model-only-launch.ps1 | bfe55b5aaa970a1390203822a4185d95ce58c6983266d58e269969fcb76b3bdc |
| model-only-profile-cleanup.ps1 | 2d2e60085fa79b98ee1d3149fba0673ea62288a1c60dc5661e227b0545988a69 |
| integration-model-boundary-hardkill.test.ts | ce59c5c117e8afc40cb6582228d2448fb8eea0caa432b185566ce7e9f5d3d365 |

Reviewer confirmed the guardian is armed before profile/root/client side effects; it validates launcher PID and creation time plus generated job/event names. The child is assigned to the owned Job while suspended, before resume. The guardian terminates the Job after launcher death and verifies no active processes remain before deleting constrained private paths. Reparse roots/children are rejected. ACL operations remain within the generated task root/AppContainer profile. The hard-kill fixture actually terminates the launcher and observes client exit, both paths removed and guardian exit. No blocking finding in this scope.

The guardian source hash above was also checked by the parent. Maker daemon build passed. The separately recorded full native test remains 3 PASS/1 FAIL (child UNKNOWN/network ETIMEDOUT), so no M1/M3 or overall qualification is issued. This is a hard-kill cleanup result, not proof of shutdown under machine power loss, server isolation or successful model execution.
