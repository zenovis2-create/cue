# 읽기 전용 native 복구 관찰기 — maker 증거

완료 기준과 cap2는 상위 계약 및 `../20260912-native-recovery-observer-contract.md`에 기록했다. 이번 기능 수정 가설 0/2. 중간 읽기 명령의 잘못된 cwd/glob은 출력에 보존되었으며 제품 변경을 요구하지 않았다. reviewer의 초기 PATH 탐색 지적은 실제 sealed wrapper chain 확인으로 철회되어 수정하지 않았다.

## API와 범위

`createNativeRecoveryObserver({db,assertInstallationCurrent,fixture?}).observe({identityRef,runId,candidateId,subjectDigest,signal?})`.

- 저장된 ref의 해시/세션 linkage 및 run/candidate/subject를 검증하고 전후 다시 읽는다. 과거 session.cwd 존재를 요구하지 않는다.
- 설치 guard는 보호된 호스트의 현재 소스 범위 검증이며 capability 발행/과거 qualification의 현재 유효성을 증명하지 않는다. strict synchronous true만 허용한다. helper bytes의 import-time SHA를 재검사한다.
- 기본 실행은 `runProcessSync`→`resolveSealedExecutable` Windows systemTools의 고정 PowerShell 경로, module-relative PS 파일, shell:false, 5초 전체 기한/16KiB 출력/nonce/정확한 세 PID를 사용한다. 비Windows 기본 query는 실행하지 않는다.
- helper는 local GetProcessById의 ArgumentException만 absent로 해석한다. 다른 접근/관찰 실패는 unknown. 하나의 query/synchronize handle에서 unsigned FileTime과 Wait(0) 결과를 읽고 항상 닫는다. 재사용 PID는 별도로 표시한다.
- OS temp/LocalAppData로 예상 경로를 구성하고 기록 경로와 비교한다. 각 경로 조상부터 lstat하여 reparse/파일/접근 오류는 unknown, ENOENT만 absent로 구분한다. source와 lineage drift/abort/기한 뒤 결과는 반환하지 않는다.
- 반환은 `sourceKind: native|fixture`, `authority: observation-only`, process/path 상태만 포함한다. native 라벨은 이 코드 경로의 관찰 종류이지 테스트/자격/cleanup PASS가 아니다. DB write, kill/delete, state change, 재개, cleanup receipt, acceptance 함수가 없다.

## 검증

```text
cwd C:/Users/User/cue/daemon
npm run build
exit 0
npx vitest run test/integration-native-recovery-observer.test.ts test/integration-native-execution-identity-store.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-12 00:22:41 KST: 2 files / 18 PASS / exit 0 / 758ms
```

실제 SQLite identity fixture를 사용했으며 OS query/stat는 모두 explicit fixture 또는 module double이다. default wiring 테스트도 실제 helper를 실행하지 않는다. 두 FileTime의 1 tick 차이, UInt64 최대값, matching exit/reuse/absent/unknown, foreign lineage, getters/proxies, 잘못된 nonce/부분응답/접근오류, reparse/경로 drift, 원장/소스 변화, 취소와 late rejection, 데이터 무변경을 검사했다. PS의 read-only API와 same-handle 구조를 정적으로 검사했다. 실제 OS 조회/모델/network 호출 0. 별도 무해한 소유 프로세스 native gate와 독립 검토가 남아 있다.

## 최종 SHA-256

| 파일 | SHA-256 |
|---|---|
| daemon/src/native-recovery-observer.ts | B76B273CE1CD7EE81BA3512C4E098302D2653C776581303A4E7BA095045B2134 |
| daemon/src/native-process-observation.ps1 | DBF6ABB0D3B0343E03BF848A8564F54F34F7A96714D079BAB570E14FA3C567A4 |
| daemon/test/integration-native-recovery-observer.test.ts | 1BD63C7AB75EA1C8382B206AFCED10DBD003B587FD0AD726F9735EA4A0E7D154 |
