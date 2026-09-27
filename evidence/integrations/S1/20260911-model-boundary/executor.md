# Windows 모델 전용 클라이언트 경계 — 부분 구현, qualification 보류

완료 기준은 daemon build와 실제 Windows IPC·파일/자식/네트워크 차단·정리 검사 및 독립 검토다. 최초 구현 뒤 수정 가설 최대 2회. 현재 통합 검사 실패가 남으므로 완료/qualification을 주장하지 않는다.

## 구현/API

`daemon/src/model-only-launch.ps1 -PayloadBase64 <JSON base64>` 호스트 전용 payload: `nodeExecutable`, `nodeSha256`, `parentPid`, `request` 문자열(최대 8192 UTF-8 bytes), `timeoutMs`(100–30000). 작업 루트와 AppContainer profile 이름은 실행기가 직접 생성한다. 실행기는 해시가 일치하는 node.exe와 고정 `model-only-client.cjs`를 자체 루트에 복사한다.

클라이언트는 고정 `cue-model-client-v1` ping 한 메시지를 받고 `client-boundary-ready` 또는 protocol_error만 반환한다. 모델 호출/임의 코드/tool/네트워크 로직은 없다. 프로덕션 payload는 probePath를 거절한다. 명시적 호스트 `-ProbeHarness` 플래그만 해시 고정 fixture를 허용한다.

capability 0 AppContainer, suspended create → max process 1 Job 할당 → resume 순서. stdin/stdout 두 핸들만 STARTUPINFOEX HANDLE_LIST로 상속한다. stderr는 같은 제한된 output pipe다. 환경은 자체 TEMP/profile 및 SystemRoot 관련 필드만 구성하며 부모 환경을 복사하지 않는다. Job 종료/부모 종료 관찰 후 실제 child wait가 끝나야 정상 정리를 진행한다.

자체 taskroot와 기본 AppContainer profile 하위 ACL에 SID 쓰기·삭제·ACL/소유자 변경 deny 및 RX를 부여한다. 공유 경로 ACL, loopback exemption, firewall 및 기존 write launcher는 수정하지 않았다. `--no-addons --preserve-symlinks-main`은 새로 복사한 고정 일반 파일 main의 외부 상위 디렉터리 realpath 요구를 피한다.

## 실제 검사 이력

- 최초 build PASS. 최초 focused 1 PASS / 3 FAIL: WindowsPowerShell에서 Get-FileHash 미해결, profile 생성 전 실패.
- 수정 가설 1: hash와 ACL을 .NET 직접 API로 전환. 실제 child와 profile/root 정리까지 진행했으나 Node main의 realpathSync가 `EPERM lstat D:\`로 거절됨. 공유 drive ACL은 변경하지 않았다.
- 수정 가설 2: 고정 main의 `--preserve-symlinks-main` 옵션, launcher의 실제 child exit code 전달.
- 최종 focused 명령(daemon cwd): `npx vitest run test/integration-model-boundary.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
- 2026-09-11 16:30:18 실행: **3 PASS / 1 FAIL**. 고정 production ping/error IPC, 실제 정상 PID/profile/root 정리, timeout cancellation 및 관찰된 부모 종료 Job 정리, production probe override 거절과 oversized/multiple message 거절은 PASS.
- 남은 실패: 파일/자식/네트워크 통합 fixture가 5초 deadline으로 exit113. **timeout은 차단 PASS가 아니다.** 따라서 해당 OS 권한 전체를 qualified로 보지 않는다.
- 최종 build 재검사 시 다른 작업의 `integration-acceptance.test.ts:103` 임시 이름, `:144` readonly 필드 할당 두 오류로 FAIL. 이 단위 파일의 최초 build는 PASS였지만 현재 전체 build PASS를 주장하지 않는다.

## 남은 범위

통합 probe hang 진단 및 실제 명시적 OS 거절 관측이 필요하다. 실행기 자체가 강제 종료되면 Job은 child를 종료하지만 PowerShell finally가 profile/root를 지울 수 없으므로 crash cleanup은 **unknown**이다. 별도 guardian/recovery가 필요하다. 프로필 폴더 외 registry/기타 AppContainer 자원 쓰기 제한도 이 파일 검사만으로 입증하지 않았다.

이것은 client-only 경계다. 호스트의 고정 provider broker와 실제 모델 provider 프로세스는 아직 연결하지 않았으며 fullprivileged 서버의 쓰기/네트워크/종료 권한은 **unknown**이다. 모델/과금 API, 서버 시작/종료, 다운로드, 전역 설치는 하지 않았다.

## 파일 SHA-256

- model-only-launch.ps1: `9DC6FB83852AD0A39BE06D430E9AD670D6ED2B6BD825DFA6F351F32CDD392E79`
- model-only-client.cjs: `5D46277164023F8139B40A26EE277D54AB97CBE9842EB1514B9B5EE1ACB80FD9`
- integration-model-boundary.test.ts: `CC94EC378EC45D94F3771C0AA9487B41F7CBABDA2AE425D3AB7E9B0AC6DA66C7`

## 일차 출처

- Microsoft HANDLE_LIST 계약: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
- AppContainer 기본 폴더 API: https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-getappcontainerfolderpath

독립 검토는 별도 review.md에 기록한다.
