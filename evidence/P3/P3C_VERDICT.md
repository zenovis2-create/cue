# Phase 3C 판정

전체 검증은 `npm test`로 실행했으며 4개 테스트 파일, 65개 테스트가 모두 통과했다. Phase 3B의 두 실패 테스트는 삭제하거나 약화하지 않았고, 같은 이름과 assertion을 유지한 상태로 통과했다. 전체 원문 출력은 `p3c_test_output.log`에 보존했다.

| 항목 | 판정 | 도달 단계 | 근거 |
|---|---|---:|---|
| P3-9 파일시스템 | PASS | 1단계 AppContainer | PowerShell이 런타임에 계산한 worktree 밖 경로의 쓰기가 실패했고 파일이 생기지 않았다. worktree 안 쓰기 양성 대조군은 성공했다. 실행 뒤 AppContainer ACE와 프로필이 제거됐다. |
| P3-16 네트워크 | PARTIAL | 3단계 탐지·즉시 중단 | empty-egress에서 알려진 native 네트워크 호출을 실행 전에 탐지해 종료 코드 77과 `network_gate`로 중단한다. AppContainer capability 미부여만으로는 이 머신의 loopback 연결이 차단되지 않았다. |
| P3-15 완료 카드 | PASS | 프로덕션 배선 | 실제 완료 함수 `completeTaskCard`가 `completionApprovalLabel`을 호출하고, 통합 테스트가 원장 기반 문구와 완료 상태를 함께 확인한다. |
| P3-17 실행 원장 | PASS | 프로덕션 배선 | `runWorkerLifecycle`가 실제 PowerShell 워커 실행 지점에서 `recordExecution`을 호출하고 실행 행을 적재한다. |

## 정리와 잔여 한계

AppContainer 프로필, SID ACE, 프로세스 핸들은 PowerShell `finally`와 C# `finally`에서 제거한다. 전체 테스트 뒤 레지스트리 AppContainer mapping을 확인한 결과 Cue 프로필 잔존 수는 0이었다. Cue 데몬 DB는 worktree ACE 봉쇄 대상이 아니므로 원장 쓰기 권한을 줄이지 않는다.

도달한 최고 사다리는 파일시스템의 **1단계 AppContainer 강제**다. 네트워크는 AppContainer에 `internetClient` capability를 주지 않아도 이 환경에서 실제 loopback 연결이 허용됐으므로 **3단계 PARTIAL**로 판정한다. 현재 탐지는 `TcpClient`, socket API, WebClient, Invoke-WebRequest, curl/wget처럼 호출 표면에서 식별되는 경우를 즉시 중단하지만, 런타임에 문자열을 은닉하거나 알려지지 않은 native 클라이언트를 사용하는 네트워크 시도까지 syscall 수준으로 막거나 모두 탐지하지는 못한다.
