# 별도 진단 가설: suspended CreateProcess 이후 프로필 재고정

부모가 관측한 프로필 SID FullControl 복원을 근거로 승인된 별도 시점 가설이다. 소유 파일은 model-only-launch.ps1뿐이며 기존 테스트의 EPERM/EACCES 기준은 변경하지 않았다. 이 가설 최대 2회.

1. CreateProcess(SUSPENDED) → Job 할당 → 동기 호스트 Action으로 자체 root/profile ACL 재고정 및 읽기 검증 → ResumeThread 순서로 변경. 읽기 검증이 실패하면 finally에서 suspended child를 종료하고 user code는 실행하지 않는다.
2. 첫 검사에서 AC root의 AppContainer write grant가 남아 `client_write_grant_restored`로 거절했다. .NET inherited ACE가 protection 변경 후 메모리에 남는지 구분하기 위해 두 번째 가설에서 protection을 먼저 저장하고 재읽은 뒤 ACE 제거/RX 추가했다.
3. 두 번째 실제 검사도 `client_write_grant_restored:AC:<해당 package SID>:FullControl`로 실패했다. 따라서 단순 pre-CreateProcess 타이밍 또는 미저장 inherited flag 문제라는 가설은 입증되지 않았다. 두 번 모두 ResumeThread 전 fail-closed다.

2026-09-11 16:44:04 `npx vitest run test/integration-model-boundary.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` 결과 **1 PASS / 3 FAIL**. 네이티브 검사가 ACL 사전조건을 거절한다. 기존 ping/정리 PASS 기록은 현재 소스의 동작 증거를 대체하지 않는다. 현재 클라이언트 실행은 차단되며 qualification은 미완료다.

기존 정책보다 넓은 ACL 허용이나 공유 폴더 변경은 없었다. 추가 시점 재시도는 중단하고 부모/독립 검토자에게 전달했다. 프로필의 FullControl 유지 원인에 대한 별도 native ACL/OS 조사 또는 프로필 쓰기에 의존하지 않는 경계 설계가 필요하다. 시간 초과 네트워크를 성공으로 바꾸지 않았고 provider 경계는 여전히 unknown이다.
