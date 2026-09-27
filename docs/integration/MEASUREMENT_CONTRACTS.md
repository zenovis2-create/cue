# 측정 계약의 생산자 입력·저장 경계

2026-09-22 / batch93. `daemon/src/evaluation/measurement-contracts.ts`.

## 현재 구현

지표, 환경, 계정 한도, 가격 계약을 ID/revision으로 등록하고 canonical digest에 결합한다. 등록된 계약은 불변이며 ID/revision 재요청은 **처음 저장된 계약·시각을 그대로 반환**한다. 재요청 시 호스트를 다시 호출하지 않는다. 새로운 관측/정의에는 새로운 revision을 사용해야 한다. 이는 현재 환경/가격을 자동 재확인하는 API가 아니다.

`freezeMeasurementDefinition(input)`은 생산자가 사용할 공통 직렬화 도구다. 객체 키는 canonical 순서, 배열은 입력 순서로 결합하며 중첩 데이터까지 복사·동결한다. 반환값은 `{definition, sourceDigest}`뿐이다. **관측 진실·계정 자격·실행 승인·host authority를 발급하지 않는다.**

- 일반 배열/중첩 객체 허용. sparse·접근자·Proxy·비표준 prototype·추가 배열 속성·함수·순환 참조는 거부.
- 정의 전체 최대1MiB,4096nodes,깊이16; 문자열/키 최대65536bytes, 객체당128keys, 배열 길이4096. 전체 계약 metadata를 포함해1MiB를 넘으면 등록 거부.
- `__proto__`는 setter를 호출하지 않고 데이터로 복사한다. `toJSON`의 일반 데이터는 보존하되 함수/접근자는 실행하지 않고 거부한다.
- 호스트 응답은 `then` 속성을 읽지 않는다. 등록 호스트는 동기 API이며 Promise는 미지원.
- 응답을 검증·동결한 뒤 시각 callback을 호출하므로 callback 중 원본 변경이 등록값을 바꿀 수 없다.
- 같은 원장에서 진행 중 등록의 callback 재진입은 거부한다. 콜백은 writer transaction 밖에서 실행하며 최종 삽입은 IMMEDIATE 잠금 아래 ID/revision 충돌을 재검사한다.
- 별도 SQLite 연결이 같은 내용을 먼저 등록했다면 최초 저장값을 반환하고, 다른 내용/authority면 충돌로 거부한다. 콜백의 외부 변경을 등록 실패를 이유로 임의 취소하지 않는다.
- fixture 계약을 같은 ID/revision의 host 계약으로 재등록해 승격할 수 없다. 조회는 저장된 authorityClass를 그대로 반환한다.

## 합성 예제 — 실제 관측 아님

```ts
const snapshot = freezeMeasurementDefinition({
  schemaRevision: 'environment-v1',
  complete: false,
  fields: { devices: [{ id: 'fixture-cpu', revision: 'v1' }] },
});
const registry = createOfflineFixtureMeasurementContractStore(db, {
  read: (_kind, id, revision) => ({
    id, revision, sourceRevision: 'fixture-v1', ...snapshot,
  }),
  nowMs: () => 10,
});
const saved = registry.registerEnvironment({ id: 'environment', revision: 'v1' });
// saved.authorityClass === 'offline-fixture'
// 동일 ID/revision 재등록은 saved 및 최초 observedAtMs를 재사용한다.
```

실제 `MeasurementContractHost` 구현은 관측 출처와 명시적인 revision을 제공해야 한다. 예제의 정적 데이터를 host-observed로 이름만 바꾸어 실제 측정으로 사용하면 안 된다.

## 측정 fact의 참조 검증

`measured-facts.ts`는 enrollment의 metric/environment/accountLimits와 저장 계약의 **ID + revision + digest**를 모두 대조한다. 기존 digest만 비교하던 경로는 다른 ID/revision으로 바꿔 부른 계약을 통과시킬 수 있었다. capture와 read의 공통 canonical 검증에서 거부한다. 등록 전 관측 시각과 authorityClass 검사도 유지한다.

## 아직 하지 않은 것

이 변경은 생산 측정기를 연결할 때 필요한 계약 저장소 결함을 수정한 것이다. 실제 실행 입력·품질·시간·계정/가격/비용 관측 생산자, 기본 앱의 측정 호스트 구성, fact→trial 변환, 사용자 실측 및 성과 비교를 완료하지 않았다. `trialReady:false`, outcome-only `trial:null`, 승격불가를 유지한다.

[검증](../../evidence/integrations/S5/20260922-measurement-contract-integrity/RESULTS.md): 수정 전10fail/6pass, 최종31파일249pass/build0/skip0. 합성 호스트와 임시 실제 SQLite를 사용한 자체 검사이며 독립 검토·전체 suite·실제 공급자 자격이 아니다.
