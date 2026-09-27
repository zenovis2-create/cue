# Native 복구 관찰기 구현 계약 (실행 전)

완료: `npm run build` exit 0 + 신규 offline fixture 및 기존 identity-store 테스트 통과 + 독립 검토. 수정 가설 cap 2. 실패는 새 가설과 결과를 기록한다. 실제 helper/OS 조회는 별도 조율 후에만 수행한다.

Preimages: `daemon/src/native-recovery-observer.ts`, `daemon/src/native-process-observation.ps1`, `daemon/test/integration-native-recovery-observer.test.ts`는 신규 파일이다. 기존 store/core/adapter/DB row를 수정하지 않는다. 부모가 copy-assets 등록을 소유한다.

`createNativeRecoveryObserver({db,assertInstallationCurrent,fixture?}).observe({identityRef,runId,candidateId,subjectDigest,signal?})`는 sourceKind와 observation-only 상태만 반환한다. fixture는 항상 fixture 표기. 보호된 동기 설치 guard는 현재 helper/호스트 무결성만 검사하며 과거 subject의 현재 자격을 부여하지 않는다. 불변 store ref와 세션 lineage를 query 전후 검증한다.

고정 helper는 정확히 기록된 세 PID를 조회한다. FileTime 정밀도를 유지하고 같은 handle에서 종료 상태를 확인한다. narrow local GetProcessById의 documented ArgumentException만 absent의 근거로 사용하며 다른 실패는 unknown이다. 알려진 OS folder/temp에서 경로를 구성하고 reparse/접근 오류/경로 불일치는 unknown이다. ENOENT만 path absent이다. timeout5초, 출력16KiB, nonce 바인딩, 취소/변화 뒤 늦은 결과 거부. 과거 session.cwd에 의존하지 않는다.

반환값은 cleanup receipt/acceptance/실행재개 권한이 아니다. DB writes, kill/delete, Job/profile 변경, 원시 환경·명령줄·전역 프로세스 스캔이 없다. 이번 단위는 모델/network0과 offline검증만 수행한다.
