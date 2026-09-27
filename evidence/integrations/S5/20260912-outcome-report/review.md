# S5 outcome report 독립 구현 검토

판정: PASS — 기존 명시적 보고서 내보내기에 평가 입력 관측을 연결한 제한된 단위. Reviewer /root/contracts_review, maker /root/reuse_transport; backend run-outcome 독립 의미 검토는 별도 checker 소유다. 제품 소스 수정/build/native/model0. 완료 기준은 동일DB wrapper/외부TX파일0/각snapshot 지문/최종IRhash/기존report 회귀/compiled app gate/typecheck. 독립 교정 요청0/상한2.

## 확인

- reports/ir.ts readRunOutcomeReport는 open DB 및 외부 transaction 부재를 먼저 요구한다. 기존 readRunReport 실패/null은 그대로 전파한다. outcome만의 예상 밖 오류는 fixed stored-evidence-unavailable로 표시하고 raw error/SQL/path를 노출하지 않는다.
- 원본 branded report를 수정하지 않고 baseReportDigest를 기록한다. outcomeSnapshotRelation=separate-read-transaction 및 고정 설명이 두 읽기를 원자 snapshot으로 오인하지 않게 한다. outcome.sourceDigest와 새 finish/합성digest가 원본과 부속 근거를 구분한다.
- 원래 readRunReport/sourceReport 경로와 report brand/기존 render/delivery 검증은 유지한다. 기존 escaped details/pre가 실제 보고서에 새 필드를 표시한다. composite JSON/spec hash와 HTML/receipt 대조는 기존 재렌더 검증을 사용한다. 새 IPC/renderer/자동 polling이나 실행 권한 변화가 없다.
- app/core.mjs:12는 실제 compiled wrapper를 import하고 :998 export에서 호출한다. 외부TX의 run 존재 SELECT는 가능하지만 wrapper가 파일경로 생성/전달 전에 거부한다. 실제 compiled app regression에서 reports 폴더 자체가 없음이 확인된다.
- completed task라도 strict acceptance 없으면 unknown/quality=null/elapsedMs=null이며 fail 재조회와 unavailable이 그대로 보존된다. snapshot끼리 합쳐 새 acceptance를 만들지 않는다. DB serialize/total_changes, 원래 IR digest와 객체 불변을 확인한다.

## 독립 게이트

```text
cwd C:/Users/User/cue/daemon
npx --no-install vitest run test/integration-run-outcome-report.test.ts test/integration-reports.test.ts test/integration-report-delivery.test.ts test/integration-report-app.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-12 01:57:27 KST: 4 files/29 PASS/exit0/4.82s
npx --no-install tsc --noEmit -p tsconfig.json
exit0
```

새4+기존reports/delivery19+compiled app6=29 고유 테스트. Maker gate를 다시 더하지 않는다. root shared build 이후 actual compiled app wrapper를 호출하는 gate이며 실제 Electron 시각 QA/실제 모델 workflow 검증은 아니다. strict backend acceptance history는 stage 경로의 파일 metadata를 읽을 수 있으므로 zero filesystem reads라고 주장하지 않는다. helper/native/model은 호출하지 않는다.

한계: 두 snapshot은 서로 다른 시점, source digests는 불변 관측의 무결성이지 적대적 전체 DB 재작성 인증이 아니다. 실제 품질/시간/가격/정책 개선·현재 실행 자격·정리 또는 최종 인수 증거를 새로 발행하지 않는다. 이전 qualification은 변경된 generation에 재사용하지 않는다.

## 현재 SHA-256

| 파일 | SHA-256 |
|---|---|
| daemon/src/reports/ir.ts | 0B81B6C8F8D33250C026ABDCF998A132EB5DEA15DE16498835362C61A128E173 |
| app/core.mjs | 3E867081FA793615CDC6F846EFA9E89A98E15BB9227485A38CD995054D2E29AC |
| daemon/test/integration-run-outcome-report.test.ts | 373E4132E764EB5C5AD3943D005DB399E3F0D4C22C8175D2E21376C44ECB1353 |
| daemon/test/integration-report-app.test.ts | 0E4819A25993D20B3D53575F9D7ED126A7293AC067F4CAEC569EA6FDAE1D5392 |
| daemon/src/evaluation/run-outcome.ts | A7DB1D39483082786F717F3BE1CAE529E970EBE88FD24054910EB6BDE9DBAC53 |
| daemon/dist/src/reports/ir.js | 013AA78A16775E41C2AD48FA5173C6A28F29415EA1446272BC249735F821FE36 |
| daemon/dist/src/evaluation/run-outcome.js | 54753DB5C3FCD300C3F0F5C6C8D7BB860642FC2DE37258B46FEF707F09838524 |

## Backend policy ID 마스킹 후속 — PASS

Root 최종 build 이후 run-outcome.ts:96의 policy.id는 publicPlanId(:16)로 제한된 opaque ID만 공개하며 경로형은 null이다. idDigest는 JSON canonical string SHA(:12)로 추가된다. wrapper는 DTO를 opaque details에 포함하므로 nullable ID에 접근/분기하지 않으며 추가 digest도 새 report hash에 포함된다.

독립 좁은 게이트: integration-run-outcome-report.test.ts만 실행, 2026-09-12 01:59:53 KST /4 PASS/exit0/1.89s. 기존29 PASS는 이전 source snapshot 기록으로 보존하며 새4를 합쳐 고유33으로 주장하지 않는다. 기존 전체 suite/typecheck/build를 반복하지 않았다.

Current backend source SHA F78128B66F3FEB4194F847349F19D74B875FF18D97F271C2BE03E9C2C366A072; compiled backend E08A91956196543DB2E2BE91DDAA20BAF422522FCE5663B978AA3118698AA714.
Wrapper source 0B81B6C8F8D33250C026ABDCF998A132EB5DEA15DE16498835362C61A128E173; compiled wrapper 013AA78A16775E41C2AD48FA5173C6A28F29415EA1446272BC249735F821FE36. Compiled 파일은 hash만 읽었다.

예정 실제 QA proof SHA17B447E72152EFD78119219A8E07E68F945CE23B0DB5600A94D04C4E2894199D. report-fixture.mjs:5의 정책 ID qa-outcome는 마스킹 허용범위라 id 자체는 유지된다. 추가 idDigest/달라진 sourceDigest/보고서 hash는 당일 생성값으로 검증해야 하며 이전 해시를 재사용하지 않는다. 이번 확인은 실제 proof 실행/승인이 아니다. 제품 수정·build·native/model0.
