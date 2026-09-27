# 선택 판단 영속화 독립 검토

판정: PASS — 제한된 historical selection output 저장 및 engine 재생 계약. Reviewer /root/contracts_review, maker /root/reuse_pure, migration 등록 /root. 제품 소스 수정·native·모델 호출0, build 재작성0. 완료 기준은 소스/계보/일회성 migration 검토, 지정5 suites 및 noEmit 타입 검사, 현재 SHA와 compiled025 일치다. 독립 수정 요청0/상한2. Maker의 TS narrowing/frozen-manager fixture 교정 이력은 result.json에 그대로 보존한다.

## 확인한 계약

- 025는 migration marker 부재 시에만 기존 attempt를 legacy에 넣고 marker를 봉인한다. marker/legacy update/delete/중복 insert/REPLACE/UPSERT 거부. openLedger:39에서 transaction으로 실행하며 copy-assets:27 등록. 실제 pre025 원장 업그레이드 후 새 누락 attempt를 생성하고 reopen해도 legacy에 편입되지 않는 회귀가 통과한다.
- attempt-decision-store.ts:33 context는 plan canonical digest, run envelope, 현재 고정 policy identity, task/allowed candidate, claim/request journal/reservation 계보를 묶는다. payload는 policy/plan/request/reservation 지문과 선택 output이며 raw estimate.source/prompt/auth를 저장하지 않는다.
- :63 value는 monetary mode/selected candidate/pin과 local 역할별 fixed candidate를 대조한다. output validator는 제한된 enum/점수/배열/중복/선택 대상 및 ranked tie-break를 확인하고 방어적 immutable 사본을 만든다. 원래 private host estimates를 재계산하거나 인증하는 검사가 아니다.
- :78 read는 신규 missing을 snapshot-missing으로 거부하고 migration에 등록된 과거 attempt만 legacy-not-recorded를 반환한다. canonical bytes/hash/index kind/run/request와 연결된 원장 값이 불일치하면 거부한다. :93 record는 열린 claim transaction을 요구하고 legacy 소급 쓰기를 거부한다.
- engine.ts:146/:217 기록은 기존 claim/예약/stage prepare/request activity와 같은 transaction에 있다. 삽입 또는 prepare 실패 시 전체 rollback하고 runtime 호출0. :118/:201 replay는 저장된 결과를 반환하며 관측/selector/예약/launch를 다시 실행하지 않는다. 기존 claim의 idempotent 확인은 유지한다.
- runtime 실패 또는 미확인 cleanup이 선택 설명을 성공/인수 증거로 바꾸지 않는다. retry는 새 attempt의 별도 결정이며 과거 값은 유지한다. no-eligible preclaim 요청은 attempt가 없으므로 이 저장소가 다루지 않는다.

## 독립 게이트

```text
cwd C:/Users/User/cue/daemon
npx --no-install vitest run test/integration-attempt-selection.test.ts test/integration-engine.test.ts test/integration-local-engine.test.ts test/integration-retry-backend.test.ts test/integration-selection.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-12 00:52:30 KST: 5 files /49 PASS/exit0/4.47s
npx --no-install tsc --noEmit -p tsconfig.json
exit0
```

추가 읽기 검사에서 maker result.json의7 source SHA 모두 현재 일치, source025와 compiled025 bytes 동일. dist 소스는 읽지 않았으며 SQL 바이트만 비교했다. replay 무관측/무예약/무재실행은 같은 engine fixture에서, 실제 reopen은 store 역사 읽기에서 검증한다. 새 process의 실제 모델 재개를 시험한 것은 아니다.

범위 한계: UI 표시, no-eligible 요청 수준 감사, 원래 추정 입력 provenance, 정책 성능 개선, 현재 admission/cleanup/실제 모델 실행 증거는 별도다. 소유 host/DB가 전체 근거를 재작성하는 적대적 상황을 SHA만으로 인증하지 않는다. 기존 monetary/local selector 출력 bytes를 변경하지 않는 추가 snapshot validator이며 전체 최적화 완료를 주장하지 않는다.

## 현재 source SHA-256

| 파일 | SHA-256 |
|---|---|
| daemon/src/selection/attempt-decision-store.ts | 91DB996B6B3FC1B91080D021A9A9C9D5148CE6776C3482063A729E6AF1AD134D |
| daemon/migrations/025_attempt_selection.sql | 6A8DAFDE307CDC7EDA0133EF31A2B30AF989425AD7C791813205D50F786D753F |
| daemon/src/orchestration/engine.ts | 46A064EEF9AC9ED947842FE4F0FFC9998D60A479A8A9AE53289A9EBBDF1E0915 |
| daemon/src/selection/policy.ts | 93EE50A166BCA25441FF2C8AABE0C0FB0DBF44C496CED165CF76F0F375DDDEAF |
| daemon/src/selection/local-policy-store.ts | 8B0A81600C57DCB930483C7C2FE44A8EB63913431D668699413AB76BAEF08934 |
| daemon/test/integration-attempt-selection.test.ts | ACAA327F09B7933E5D42D9BCFFB9728E55DED3A2A5DFF959D901A34E35244E52 |
| daemon/test/integration-retry-backend.test.ts | 952A91AF27CBA2A76482E4043602EA853459FFEAAB7ECDA1471CF803EAA57E72 |
| daemon/src/ledger.ts | 3BE629A34E9106BDA9EA328EDE541056EC736167F2F498A50FA70E631B91AFB2 |
| daemon/scripts/copy-assets.mjs | BB14B04F125946340B6587B793ACA3B26A332591C3E674FD6B39F909009A6640 |
