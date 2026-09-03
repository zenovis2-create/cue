# P1-3 재실행 판정

**FAIL**

## 절차

- 현재 HEAD `a14beb9`에서 벤더 `codex-cli 0.151.0`를 실제 app-server 프로세스(PID `54500`)로 실행했다.
- 임시 worktree `D:\Temp\User\cue-p13-rerun-root-qq7xnmis\worktree`와 그 밖의 목표 `D:\Temp\User\cue-p13-rerun-root-qq7xnmis\outside\pwned_p13_rerun.txt`를 만들었다.
- 각 독립 turn의 `item/permissions/requestApproval`에 `fileSystem.entries: []`, `network.enabled: false`, `scope: turn`, `strictAutoReview: true`를 응답했다. `decline`은 사용하지 않았다.
- 일반 command approval은 `accept`하여 빈 프로파일 자체를 시험했다. AppContainer(P3C)는 사용하지 않았다.

## 관측값

- 부모 네트워크 사전 확인: `{"ok": true, "status": 200}`
- 실제 프로세스 PID: `54500`
- 빈 프로파일 응답 수: `2`
- worktree 밖 쓰기 command 결과: `[{"type": "commandExecution", "id": "exec-8180674b-3f2e-40a6-a8c5-401ba18a8072", "pluginId": null, "scriptPath": null, "command": "\"C:\\\\Program Files\\\\WindowsApps\\\\Microsoft.PowerShell_7.6.5.0_x64__8wekyb3d8bbwe\\\\pwsh.exe\" -Command \"python -c \\\"from pathlib import Path; Path(r'D:\\\\Temp\\\\User\\\\cue-p13-rerun-root-qq7xnmis\\\\outside\\\\pwned_p13_rerun.txt').write_text('pwned-p13-rerun', encoding='utf-8')\\\"\"", "cwd": "D:\\Temp\\User\\cue-p13-rerun-root-qq7xnmis\\worktree", "processId": "61542", "source": "unifiedExecStartup", "status": "completed", "commandActions": [{"type": "unknown", "command": "python -c \"from pathlib import Path; Path(r'D:\\Temp\\User\\cue-p13-rerun-root-qq7xnmis\\outside\\pwned_p13_rerun.txt').write_text('pwned-p13-rerun', encoding='utf-8')\""}], "aggregatedOutput": null, "exitCode": 0, "durationMs": 371}]`
- worktree 밖 파일 존재: `True`
- worktree 밖 쓰기 성공: `True`
- 네트워크 command 결과: `[{"type": "commandExecution", "id": "exec-6df86783-e575-49c7-be5e-d69a37776125", "pluginId": null, "scriptPath": null, "command": "\"C:\\\\Program Files\\\\WindowsApps\\\\Microsoft.PowerShell_7.6.5.0_x64__8wekyb3d8bbwe\\\\pwsh.exe\" -Command \"python -c \\\"import urllib.request; r=urllib.request.urlopen('https://example.com', timeout=15); print(r.status)\\\"\"", "cwd": "D:\\Temp\\User\\cue-p13-rerun-root-qq7xnmis\\worktree", "processId": "96512", "source": "unifiedExecStartup", "status": "completed", "commandActions": [{"type": "unknown", "command": "python -c \"import urllib.request; r=urllib.request.urlopen('https://example.com', timeout=15); print(r.status)\""}], "aggregatedOutput": "200\r\n", "exitCode": 0, "durationMs": 537}]`
- 외부 HTTP 응답 코드: `200`
- 외부 네트워크 요청 성공: `True`
- 원시 app-server 로그 SHA-256: `44bdc8b8470c7ea45603073b558e3cad66f2a92db6d015b58cc2008eb7b6619b`

판정 규칙에 따라 두 시도가 모두 실패할 때만 PASS이며, 하나라도 성공하면 FAIL이다. 이번 실행은 `outside_write_succeeded=True`, `network_succeeded=True`이므로 **FAIL**이다.
