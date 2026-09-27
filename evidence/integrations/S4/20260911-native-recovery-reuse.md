# Native 복구용 읽기 전용 관찰기 재사용 조사

2026-09-11, `/root/reuse_pure`. 소스 읽기만 수행했다. 실제 OS/process 조회, kill/delete, DB 복구, 모델·네트워크 호출, 제품 변경은 0이다. 이 문서는 다음 구현 후보 계약이며 완료/cleanup 증거가 아니다.

## 기존 코드에서 가져올 부분

| 소스 | 재사용 경계 |
|---|---|
| `daemon/src/native-execution-identity-store.ts:75` | `createNativeExecutionIdentityStore(db).read(ref)`로 해시·세션/run 연결을 검증한 불변 identity를 읽는다. launcher/client/guardian 각각 PID+createdFileTime을 사용한다. `session.start_time`은 대체 식별자가 아니다. 현재 경로 검증은 basename/형식까지이므로 실제 OS base 증명은 추가로 필요하다. |
| `daemon/src/model-only-profile-cleanup.ps1:13–28` | `OpenProcess`, `GetProcessTimes`, `CloseHandle` 선언과 동일 handle에서 생성 FileTime을 읽고 exact 비교하는 작은 부분만 참고한다. `WaitAndDrain`은 Job 종료·profile 삭제를 포함하므로 호출/전체 복사 금지. |
| `daemon/src/model-only-launch.ps1:161,176` | 네이티브 process handle의 생성 FileTime 전후 비교 패턴. 부동소수 Date/밀리초로 줄이지 않고 저장된 십진 문자열을 정확 비교한다. |
| `daemon/src/adapters/isolated-model-cleanup.ts:14–19` | 존재 관측의 3값 분류: process 조회는 ESRCH만 absent, path `lstat`는 ENOENT만 absent, 접근 오류 등은 unknown. 다만 기존 `process.kill(pid,0)`는 PID 생성 identity를 확인하지 않으므로 새 복구 관찰기의 핵심 프로세스 판정으로 재사용하지 않는다. |
| `app/protected-installation.mjs:46` | PowerShell의 실제 `Environment.GetFolderPath(LocalApplicationData)`와 `IO.Path.GetTempPath()` 조회 패턴. taskRoot는 OS temp/profile, profileRoot는 OS LocalAppData/Packages/profile, profilePath는 그 아래 AC와 정확히 비교한다. 환경변수 문자열이나 renderer 경로를 권위로 삼지 않는다. |
| `daemon/src/model-only-launch.ps1:37,443` | `GetAppContainerFolderPath`를 사용한 SID 기반 실제 profile 경로 조회 패턴. 조회 불가를 폴더 부재/삭제 완료로 치환하지 않는다. |
| `daemon/src/model-only-launch.ps1:376–391` | 고정 profile 이름과 temp 아래 정확한 경로, ReparsePoint 거부 패턴. 복구 관찰은 존재 여부만 읽고 재귀 enumerate/delete는 하지 않는다. |
| `daemon/src/process-launch.ts:89` | `runProcessSync`의 sealed executable/shell:false 래퍼. 소수 PID를 조회하는 짧은 read-only helper에 명시적 timeout/maxBuffer/windowsHide 옵션을 붙일 수 있다. 전체 프로세스/CommandLine/환경 스캔은 필요 없다. |

재사용하면 안 되는 경계: `recovery.ts:13`의 CIM 생성시간을 `session.start_time`과 10초 오차로 비교하고 taskkill하는 경로는 새 정확 FileTime 계약과 맞지 않는다. `process-termination.ts`와 `probes/run-scope.ts`의 전체 CIM/descendant 스캔도 이번 최소 관찰기에 필요 없다.

## 가장 작은 다음 API

```ts
createNativeRecoveryObserver({ db, protectedInstallation })
  .observe({ identityRef, runId, candidateId, subjectDigest, signal? })
  // -> frozen observation only:
  // identityRef + queriedAt + exact lineage
  // processes.{launcher,client,guardian}:
  //   matching-alive | matching-exited | pid-reused | absent | unknown
  //   expected FileTime / observed FileTime / bounded reason
  // paths.{taskRoot,profileRoot,profilePath}: present | absent | unknown
  // pathProvenance: matched | unknown
  // authority: observation-only
```

소유 파일 후보는 `daemon/src/native-recovery-observer.ts`, 작은 `native-process-observation.ps1`, `daemon/test/integration-native-recovery-observer.test.ts`이다. 기존 TypeScript/Node/PowerShell/PInvoke만 사용하며 새 패키지나 새 DB 테이블은 필요 없다. helper는 고정 JSON 입력/출력, PID 세 개, 제한된 출력/시간, query/synchronize 권한만 사용한다. terminate 권한, Job 변경, profile 생성/삭제 API를 포함하지 않는다. helper 추가 시 기존 설치 footprint/pin 정책과 source 재검증도 필요하다.

한 번 연 process handle에서 FileTime과 실행/종료 상태를 관측하고 반드시 닫는다. 다른 FileTime이면 `pid-reused`로 별도 표시하여 현재 무관한 프로세스를 원래 실행으로 오인하지 않는다. Win32 오류별 **absence 근거는 구현 전에 명시적으로 검증**해야 하며, OpenProcess 실패 전부를 absent로 해석하지 않는다. access denied, 관찰 중 race, timeout, 잘못된 frame, 부분 응답은 unknown이다. 생성 FileTime이 같더라도 살아있는 동일 프로세스인지/이미 종료된 handle인지는 구분한다.

경로는 저장된 이름만 신뢰하지 않고 현재 protected OS base와 비교한다. account/base 변경, reparse 경로, SID 경로 불일치, 접근 오류는 unknown이다. 알려진 base 안에서 실제 `lstat` ENOENT를 관측한 경우에만 absent로 표시한다. 원래 bytes/원장 identity를 수정하지 않는다.

이 반환값은 `CleanupReceipt`가 아니다. 세 PID와 폴더 부재만으로 다른 자식/Job/provider/ACE 잔여물, 사용자 요구 완료, 실행 재개 권한을 자동 추론하지 않는다. 관찰을 기존 cleanup/복구 권한에 연결하는 변경은 별도 검증 단위로 남긴다.

## 필요한 좁은 테스트

1. 실제 identity store read의 null/해시 변조/세션·run·candidate·subject mismatch는 query 전 거부.
2. PID 일치+정확 FileTime, PID 재사용, matching-exited, 관찰 전 부재, 접근 거부/부분 응답/timeout → 별도 상태. Date로 반올림한 비교를 거부.
3. 실제 file/dir fixture와 ENOENT, EACCES/EPERM, reparse/잘못된 known-folder/SID/base, 경로 탈출을 구분. getter/proxy 입력과 임의 script/path/command 거부.
4. Abort 전/중 및 조회 사이 identity/설치 변화에 늦은 결과를 확정하지 않음. 누락 한 프로세스가 있으면 완전한 관측처럼 표현하지 않음.
5. DB `total_changes()` 불변, native helper에 mutation 권한/API 없음, 기존 identity/cleanup 행 유지, 결과에서 `verified-clean`/acceptance/실행 재개 권한 생성 없음.
6. 이후 별도 승인된 Windows fixture gate에서 자신이 만든 무해한 프로세스 하나의 실제 FileTime과 종료 상태를 검사한다. 현재 조사에서는 수행하지 않았다.
