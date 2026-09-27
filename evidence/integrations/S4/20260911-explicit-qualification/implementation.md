# 명시적 generated JSON 자격 검증 작업

완료 기준: 빌드 exit 0, 명시적 작업/기존 수집기 집중 테스트 통과 및 별도 독립 검토. 수정 가설 상한 2; 이번 단위에서 기능 실패 가설은 0이다. 동시 startup 테스트의 main 선언 누락 때문에 중간 공유 빌드가 한 번 실패했으며 해당 소유자가 수정 후 재검증했다.

## 구현 계약

`createGeneratedJsonQualification({daemon, config, installation, generation}).collect({signal?})`는 보호된 호스트 진입 API이다. 실제 `AppDaemon`, 해당 DB 경로, 정확한 설치 설명자와 canonical identity 모듈의 비공개 WeakSet에 등록된 generation만 받는다. 입력은 복사/동결하고 접근자·프록시·추가 필드를 거부한다. 이 provenance 검사는 **pre-import freshness 자체의 증명은 아니다**. 호출자는 실제 guarded entry에서 capture 후 동적 import한 동일 generation을 제공해야 한다.

- 구성 시 호출 없음. 명시적 collect 때 기본 실제 수집기만 생성한다. 생산 API에 fixture/transport/executor 재정의 인자는 없다.
- 검사기부터 검증하고 live/eligible/allClean 결과에 한해 모델 검증을 정확히 한 번 시작한다. 모델 수집기의 production canary는 최대 한 요청이며 나머지는 기존 통제된 진단이다.
- 동일 데몬/동일 입력의 재생성은 같은 작업을 반환한다. collect는 진행/실패/성공 Promise를 재사용하며 재시도나 초기화가 없다. 다른 입력은 충돌 거부한다.
- 같은 원장 사용, 설정·정책 생성 없음. 실제 반환된 수집기 결과와 참조만 전달하고 자체 PASS 증거를 발급하지 않는다.
- 필수 설치 검사 훅을 수집 전과 SQLite 증거 발급 트랜잭션 안에 전달한다. 기존 collector 호출 API는 optional 훅으로 호환성을 유지한다. false/thenable/예외는 발급을 거부하고 원시 관측은 남긴다. 발급 직전 취소와 전체 180초 collector 기한도 다시 검사한다.
- AbortSignal을 전달하며 검사기 실패/취소/fixture 결과/설치 변화 뒤 모델을 시작하지 않는다. 수집 예외 때 cleanup은 unknown으로 보고한다.
- 호출자가 데몬을 소유한다. **collect를 await한 뒤 finally에서 daemon.close를 await해야 한다.** 작업은 caller DB를 닫거나 미확인 정리를 성공으로 바꾸지 않는다. 별도 실제 Electron 검증과 정상 재시작이 필요하다.

## 검증

```text
npm run build
exit 0
npx vitest run test/integration-qualify-generated-json.test.ts test/integration-model-qualification.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-11 22:10:47 KST: 2 files / 16 PASS / exit 0 / 59.03s
```

새 작업 테스트는 실제 임시 AppDaemon/SQLite와 명시적 모듈 mock을 사용한다. authentic guard와 live 형태 결과 mock은 자격 증거가 아니다. 수집기 테스트는 실제 Windows 격리 진단과 fixture transport를 사용하며 자동으로 fixture 증거만 발급한다. 실제 Qwen/모델 요청 0. 기존 canary 두 요청 한도는 그대로 소진 상태이다.

검증 항목: 생성 시 무호출, 동일 DB, 기본 collector 인자에 fixture 없음, 검사기→모델 순서, 중복 Promise/실패 재생, 가짜 guard/잘못된 DB/접근자 거부, 발급 시 소스 변화에 capability 행 0·원시 관측 보존, unknown/fixture/실패 후 모델 없음, 실행 중 취소 전달·caller DB 유지. main/CLI 실제 연결과 실제 Electron qualification/workflow는 범위 밖이다.

## 최종 SHA-256

| 파일 | SHA-256 |
|---|---|
| app/qualify-generated-json.mjs | ACBDA3264BB80D6124DB15F7D0F95191F134F77342DE06C2750E4B1C98202D04 |
| app/qualify-generated-json.d.mts | 71E4CE1657DFFC7BEB2434AA478A7F521EFFB1C99005B7772BAB5D00CE9DEEED |
| daemon/src/model-qualification.ts | CD5FAD3BAAEDEDA5D0F13B74465BE0BF5506B7FA63420D6B037E28FBA87B84AE |
| daemon/test/integration-qualify-generated-json.test.ts | ED3AD0DB21442823FB247C1804B96F71D1CF3B48DD2EAD0BB570D4ACB46BC991 |
| daemon/test/integration-model-qualification.test.ts | 637C3A5CA319A0792D53F049C5C52878C92E0F5A8BD96AE847980C47A535EAA9 |
