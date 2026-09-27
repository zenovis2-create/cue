# 읽기 전용 default generated host bootstrap

`createDefaultGeneratedJsonBootstrap(authority)`는 실제 core의 `{db,config,worktree}`를 받는 동기 factory를 반환한다. 고정 settings ID `generated-json-default`의 최신 V2 enabled 설정만 사용한다. 네 모드의 immutable local 정책 ref/digest, 정확히 같은 count/time 상한과 동일한 고정 producer/checker 쌍을 요구한다. 설정 digest/revision은 기존 local invocation budget의 source에 고정되며 다른 금전 의미를 만들지 않는다.

실제 `createModelMeasurementSubject`와 `measureModelControlBundle`을 호출하도록 연결했다. 주어진 경로는 protected host discovery에서만 얻고 ordinary goal/settings에는 저장하지 않는다. `validateLoadedInstallation`은 필수이고, 실제 host executable/runtime/version 비교와 고정된 전체 subject의 재측정 전후에 호출된다. 이 callback은 전달된 frozen discovery descriptor 및 실제 loaded host/control root와 **process-start loaded closure**의 관계를 독립적으로 입증해야 한다. 현재 디스크 재측정이나 boolean true 선언만으로 그 증명을 했다고 주장하지 않는다. 이 단위는 그 보호 callback의 실제 구현을 제공하지 않으며 기본값은 unavailable이다.

같은 실제 ledger의 capability bytes/ref를 읽고 원 측정 timestamp를 유지하여 missing/expired/fixture/unknown을 거절한다. Auth/resource/data/quota 사실은 보호 host의 엄격한 동기 boolean callback으로만 받고, 품질/가격 추정은 없다. 정책/증거/예산을 bootstrap이 쓰지 않으며 collector, 모델, 기본 executor launch, 설치, 다운로드 또는 legacy fallback도 호출하지 않는다. 성공은 generated host의 `.host`를 unwrap한다. `main.mjs`는 변경하지 않았다.

Gate: `npm run build` exit 0. `npx vitest run test/integration-default-generated-json-bootstrap.test.ts test/integration-driver-core.test.ts test/integration-selection-preference-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: **3 files / 20 PASS**, 2026-09-11 21:38:56, 2.21s. Bootstrap 자체 12개 검사에서 missing/disabled/V1, guard 부재/async/false, Node-versus-Electron, malformed discovery getter, 네 정책 count/time mismatch, no auth, capability unknown/fixture/expired/missing, same ledger, zero writes/attempts, 설정 source binding과 정확한 input/output 상한을 확인했다.

테스트의 측정 함수는 Vitest module mock이고 증거는 synthetic live-shaped host fixture다. 실제 설치/로드 검증, 현재 live 자격 또는 기본 앱 활성화를 입증하지 않는다. 공개 bootstrap API에는 measurement/factory/evidence 주입 필드가 없다.

진단 상한 2회. 첫 focused gate의 11 PASS/1 FAIL은 catalog가 guard 실패를 예외 대신 unavailable로 반환하는 기존 계약을 test가 잘못 기대한 문제였다. `available:false`를 검사하도록 수정한 뒤 통과(가설 1회). 검토 중 보호 root descriptor를 loaded validator에 명시적으로 전달하는 frozen context 필드만 추가했다. 최종 독립 판정과 source hashes는 별도 review artifact에 기록한다. 모델 호출 0회.
