# S5 원장 결과 평가의 단일 사용자 연결 계획

읽기 조사만 수행했다. 제품 수정·빌드·모델/helper/실제 호출 0. 완료 기준: 실제 함수/필드, 트랜잭션 및 비용, 소유 파일, 집중 gate, 미확인 표현 명시. 조사 cap 2회. run-outcome.ts는 조사 당시 작성 중이며 아래 반환 계약은 작성자 reuse_pure에게 직접 확인했다.

## 결론: 기존 명시적 보고서 내보내기

`app/core.mjs:exportRunReport(runId)`를 단일 연결점으로 선택한다. 사용자의 기존 보고서 버튼은 이 메서드를 호출한다. 현재 `readRunReport(db,runId)` → `renderReportHtml(report)` → protected `createReportDelivery(...).deliver(...)` 순서다. 새 IPC/버튼/화면/자동 실행을 추가하지 않는다. 기존 HTML의 ‘근거와 불확실성’ details/pre가 report.details를 이미 표시하므로 새 평가 자료를 사용자가 실제로 읽을 수 있다.

초기 후보였던 `completion(taskId)` 연결은 채택하지 않는다. completion은 동기 db.transaction 안에서 readTaskCard/소유권/readOrchestrationSnapshot을 함께 읽는다. renderer pollStatus가 400ms마다 execute/status→completion을 요청한다. new reader는 외부 db.inTransaction을 거부하고 자신의 읽기 TX를 사용하므로 안에 삽입할 수 없다. 완료 카드 TX를 쪼개면 기존 snapshot 계약을 약화시키고 strict acceptance 검사 비용을 매 poll마다 지불한다. 소유권/Stop에 영향을 줄 수 있는 이 변경은 피한다.

`createRetrospective`도 부적합하다. immutable draft의 content hash와 acceptance:not-assessed 계약 및 쓰기 경로까지 변경해야 한다. 명시적 보고서 요청에 한 번만 읽는 것이 더 작다.

## 최소 구현 제안

- `daemon/src/reports/ir.ts`에 내부 신뢰 경로용 `readRunOutcomeReport(db,runId)` wrapper를 새로 둔다. 기존 readRunReport의 단일 TX/브랜드/IR 및 sourceReport 동작은 그대로 보존한다.
- wrapper는 기존 readRunReport를 호출하여 TX가 끝난 브랜드된 run IR을 받고, 같은 DB/동일 runId로 `readRunOutcome(db,{runId})`를 한 번 호출한다. 두 결과를 하나의 원자적 snapshot이라고 주장하지 않는다. `details`에 `outcomeSnapshotRelation:'separate-read-transaction'`와 `runOutcome`를 추가한 새 branded IR을 기존 private finish로 생성한다. 원본 IR 객체를 수정하거나 원래 digest를 재사용하지 않는다. 최종 IR/HTML/receipt hash는 이 부속 자료까지 포함한다.
- `app/core.mjs:exportRunReport`의 reader 한 곳만 wrapper로 교체한다. 기존 protected output path, immutable display bytes, CSP, delivery 검증은 그대로 사용한다. 외부 writer TX 내 export는 새 wrapper가 명시 거부하여 파일 쓰기 이전 실패하도록 한다. reader 외부 TX 거부를 제거하지 않는다.
- 현재 ReportIR details는 unknown이며 기존 HTML은 이 필드를 escape하여 표시한다. 따라서 renderer/HTML 새 섹션 설계가 필수는 아니다. details에 사람이 읽을 고정 설명 `평가 입력 자료이며 품질·시간 또는 현재 실행 자격을 입증하지 않습니다. 단계 관측과 별도 읽기 시점입니다.`를 함께 둔다.
- reader가 unavailable을 반환하면 그대로 표시한다. 예상 밖 read 오류만 fixed unavailable(reason은 최종 backend union과 합의)로 표시하고 raw SQL/error/path는 출력하지 않는다. 기존 run report 생성 실패는 가짜 보고서로 대체하지 않는다. null은 ‘해당 실행 평가 자료 없음’이며 success로 취급하지 않는다.
- outcome은 report 단계 state, 기존 historical acceptance, Core card.state/소유권/Stop/승인/정리 영수증을 변경하지 않는다. 별도 읽기 중 원장이 변경되면 서로 다른 snapshot인 상태가 그대로 표시되며 둘을 합쳐 새 success/acceptance를 계산하지 않는다.

## 작성자 확정 backend 계약

`readRunOutcome(db,{runId})` 동기 반환:
- null
- `{status:'unavailable',reason:fixed}`
- `{status:'recorded',version,runId,authority:'evaluation-input-only',sourceHashScope:'safe-column-projection',sourceDigest,observedTaskState,outcome:'success'|'fail'|'cancelled'|'unknown',outcomeBasis,uncertaintyReasons,policy,attempts,acceptanceRef,accounting,quality:null,elapsedMs:null,trialReadiness:{status:'not-convertible',reasons}}`.

strict accepted만 success. quality/elapsedMs는 null을 유지하고 0이나 추정으로 대체하지 않는다. sourceDigest는 해당 reader의 safe projection만 식별하며 두 snapshot의 동시성/OS 진실을 증명하지 않는다. 최종 타입/file은 backend 안정화 후 확인해야 한다.

## 후속 소유와 gate

maker 소유 제안: `daemon/src/reports/ir.ts`의 wrapper, `app/core.mjs`의 export reader 호출, 신규 `daemon/test/integration-run-outcome-report.test.ts` 및 기존 `integration-report-app.test.ts` 최소 회귀. 외부 Core API 형태 불변이면 core.d.mts 수정 불필요. backend reader는 reuse_pure 소유로 유지한다. DB migration/registry/IPC/preload/renderer 변경 없음.

집중 gate: 신규 outcome-report + `integration-reports.test.ts`, `integration-report-delivery.test.ts`, `integration-report-app.test.ts`, backend outcome 집중 테스트(최종명 확인). typecheck0 및 root 조율 build. 실제 SQLite fixture에서 reader 두 개 모두 실제 구현을 사용하며 모델/네이티브 호출 0. 확인할 항목: strict success와 receipt 없는 unknown, 실패/취소/품질시간null, unavailable 오류 비공개, 외부TX export 거부/파일0, 두 snapshot 관계 명시, readonly DB total_changes 및 데이터 불변, 최종 reportJson/HTML/receipt digest가 부속자료까지 포함, 기존 source report/원본 readRunReport digest 계약 보존. 기존 보고서 근거 details에 실제 output 문자열이 나타나는 DOM 검사; 실제 browser QA는 별도 승인된 단계다.

## Footprint

installation-identity의 DIRS가 app/daemon/src/daemon/dist/src/migrations 전체를 측정한다. model-measurement-subject도 source/compiled/app tree를 측정하며 compiled counterpart를 요구한다. 새 reader 및 wrapper/Core 수정은 자동 포함되며 새 registry 등록은 필요 없다. 최종 root build 후 새 source/compiled hash를 보존한다. 이전 generation/qualification 결과를 바뀐 코드에 유효하다고 재사용하지 않으며 이 연결 단위에서 qualification을 재실행하지 않는다.

보강: wrapper details에 `baseReportDigest: original.digest`를 반드시 남긴다. `outcomeSnapshotRelation:'separate-read-transaction'`, 원본 report digest, recorded outcome.sourceDigest가 두 개별 근거를 식별하며 최종 IR digest는 합성 문서 전체를 식별한다. 이전 원본/보관 artifact는 덮어쓰지 않는다. current app import는 기존 compiled reports/ir.js에서 새 wrapper를 가져오고, 그 compiled module이 compiled evaluation/run-outcome.js를 import한다. 두 compiled 파일 모두 installed generation과 model measurement tree에 포함된다. build 후 실제 import resolution/동반 compiled 파일 존재를 집중 gate에서 확인한다.
