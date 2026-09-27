Observed prior full-suite failure: afterEach rmSync(root) EPERM for named test after 20.125s; preserved in evidence/integrations/planning/20260919-progress-reconcile-85/full-bail1.log.
Baseline isolated named test passed once in 20.234s, confirming timing sensitivity rather than a deterministic assertion failure.
Diagnosis: test stopped immediately after execute while longRunningController could still be launching its tool worker; close could finish near the teardown deadline while Windows handles linger. The test now waits for the owned tool-worker session and started.txt before stop, then awaits close and verifies captured owned PIDs exited. Strict rmSync remains unchanged.
Done gate: named test passed twice, 13.401s and 13.340s; full test/p10c-core.test.ts --reporter=verbose passed 17/17 in 85.30s.
No production files changed.
Final SHA256: daemon/test/p10c-core.test.ts 
5579DEE297F861FC5DD42BB40C0C9F0DBFE7AE4BE162F6A908E59F2DC5516ACF
Prior failed-run temp root D:\Temp\User\cue-p10c-core-pWWpiu remains (vendor/worktree); read-only Win32_Process scan found no process whose ExecutablePath is under it.
I verified the exact absolute target, but automatic command policy rejected recursive Remove-Item against that external temp path. No alternate deletion was attempted. New gate temp roots were removed by strict afterEach.
