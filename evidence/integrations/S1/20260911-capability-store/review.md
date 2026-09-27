# 독립 검토 — capability evidence store

2026-09-11 · 검토자 reuse_transport (구현자와 분리) · 최종 판정: **코드·fixture 검토 통과 (실제 P/M 자격 생성 아님)**

범위: `daemon/src/capability-store.ts`, `daemon/migrations/011_capability_evidence.sql`, `daemon/test/integration-capability-store.test.ts`, ledger/copy-assets 등록과 capability-admission 소비 계약. 소스 수정·외부 모델 호출 없음.

## 검사

- 저장소 루트 `npm --prefix daemon run build`: exit 0.
- daemon `npx --no-install vitest run test/integration-capability-store.test.ts test/capability-admission.test.ts --fileParallelism=false --maxWorkers=1`: exit 0, 14/14, 583ms.
- 독립 Node stdin probe: 실제 in-memory SQLite store와 createCapabilityAdmission을 연결하고 synthetic observation으로 모델 probe 참조를 만든 뒤 최신 실패/동시 충돌 뒤의 과거 참조 재사용을 검사했다. 이것은 의미 검증을 위한 synthetic live-labelled fixture이며 실제 M 측정 기록이 아니다. DB는 메모리에서만 생성하고 닫았다.

## P1 — 과거 pass 참조를 재사용하면 최신 실패·충돌을 우회한다

`resolveEvidence`는 ID와 두 hash 무결성만 검사하고 해당 subject/probe의 최신 측정 여부를 검사하지 않는다. `referencesFor`는 최신 실패와 동시 충돌을 반영하지만, admission은 후보의 기존 참조를 resolver로 검증할 수 있으므로 이 필터가 강제되지 않는다.

재현:

1. M1/M2/M3 pass (measuredAt=1000) 참조를 저장한다.
2. M1 fail (measuredAt=1500)을 추가한다.
3. 같은 host clock=2000, TTL=2000에서 과거 참조로 재판정하면 `modelOnlyEligible=true`, 새 referencesFor로 재판정하면 false.
4. M1 pass를 같은 1500 시각에 추가해 최신 verdict를 충돌시켜도 과거 참조는 계속 true, 새 referencesFor는 false다.

수정 요청: admission에 사용하는 resolver가 subject/probe의 최신성 및 동시 충돌을 검사하여 superseded/ambiguous 참조를 거절해야 한다. 기록 자체의 불변성과 감사용 과거 기록 보존은 유지한다. storage+admission 통합 회귀에서 cached ref를 재사용해도 최신 fail/unknown/동시 충돌 뒤 승격되지 않는 것을 검증한다.

## 확인된 범위·한계

migration 등록과 idempotent SQL, INSERT OR REPLACE/UPDATE/DELETE 차단 trigger, SHA 기반 ID·payload/observation 무결성, opaque 참조와 경로 접근 없음, SQLite 재열기, fixture provenance 유지가 코드/테스트에 있다. 호스트 소유 DB/API라는 전제가 필요하며 DB 소유자가 스키마를 변경하는 공격까지 trigger가 막는다고 해석하지 않는다. hash는 내용 무결성이고 실제 probe의 의미적 진실이나 P/M 자격 생성 기능은 아니다.

상기 P1 해결 전 최신 실패가 과거 pass를 무효화한다는 계약 완료로 체크하지 않는다. 구현자 수정 후 같은 통합 probe와 focused 회귀를 재검토한다.

## 첫 수정 후 독립 재검토

기존 P1은 **해결됨**이다. resolver가 subject/probe별 최신 timestamp와 동일 timestamp의 summary hash 충돌을 검증하므로 cached reference가 검사 경계를 우회하지 못한다. 앞의 발견·수정 요청은 이력이다.

- `npm --prefix daemon run build`: exit 0.
- daemon `npx --no-install vitest run test/integration-capability-store.test.ts test/capability-admission.test.ts --fileParallelism=false --maxWorkers=1`: exit 0, **15/15**, 526ms.
- 별도 SQLite+admission synthetic probe에서 최신 **fail** 및 **unknown** 뒤 cached pass 거부를 각각 assert했다. 더 최신 pass로 회복된 뒤 동일 timestamp fail을 추가하면 그 참조도 undefined이고 admission은 false임을 확인했다. 두 시나리오 PASS, probe exit 0. 실제 live measurement를 저장한 것이 아니며 DB는 in-memory로 종료했다.

최종 검토 hash (SHA256):

| 파일 | hash |
|---|---|
| capability-store.ts | `EDD587A0329D1E9929DA84F48E33504AA51D37D2805FE6AA9C27B6494B2BC23E` |
| 011_capability_evidence.sql | `427C0511A5FAA596E93B7B109D5ED5AC98F31D966B276519C4E6C8C1A1ED5803` |
| integration-capability-store.test.ts | `8063375BC9380BDB78DD93C93954349ADDD1379548824E0D16AE41937F1B6EF9` |
| ledger.ts | `24AC31E320F27D42C541F94D4D4AB042578E46CB798EDCCA31F5E7AAEB380823` |
| copy-assets.mjs | `60FABDFD963F54A74696E1559F3CAC9E44DB1EB0C7A38C9CBF4B2DD6D84BD7CF` |

새로운 차단 결함은 확인하지 않았다. protected host ownership와 단일 실행 판정/쓰기 경계가 전제이며, 이 검토는 실제 P/M probes의 의미적 진실 또는 제품 전체 완료를 보증하지 않는다.
