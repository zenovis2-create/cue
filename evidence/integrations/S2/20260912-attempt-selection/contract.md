# Attempt 선택 설명 영속화 — 사전 계약

완료 gate: daemon cwd `npm run build`, 신규 attempt-selection 및 기존 monetary/local engine·retry 집중 테스트 exit0, 별도 contracts_review. 수정 가설 cap2. 매 pass 동일 gate를 실행하고 새 실패를 기록한다. Native/model 호출0.

025는 최대100000개 preexisting attempt ID를 한 번만 legacy 목록에 기록한 뒤 migration marker로 INSERT를 봉인한다. 재개방 시 새 attempt를 legacy에 추가하지 않는다. 새 attempt의 결정 누락은 오류이고 legacy만 `legacy-not-recorded`이다. 선택 snapshot은 기존 claim/reserve/prepare/activity와 같은 IMMEDIATE 안에서 저장한다. replay는 관측/선택/실행/예산 reserve를 재호출하지 않는다.

새 store는 기존 run-policy identity/plan/claim/request/reservation을 재검증하며 출력 선택 설명만 저장한다. policy 입력/원시 estimate.source/대화/인증/환경을 복제하지 않는다. 출력validator를 selector와 공유하되 기존 selector 정규 bytes를 바꾸지 않는다. local fixed pair와 monetary 결정을 구분한다. 반환값은 historical-explanation-only이고 실행 권한/현재 eligibility가 아니다.

Preimages SHA256:
- orchestration/engine.ts `E224325A474BDA7641081BE18F271C5C7D5D5725D456FEF53C384376D92CBDA8`
- selection/policy.ts `351EE9D401859CEEBA004AC9DFDD47B30E2F8B31573395F8965E94739DFF3355`
- selection/local-policy-store.ts `8D7130AF42EB86EC18DBCCA3D34534D583AAAB14BE03EE19E6EB64CFB0F8296C`
- attempt-decision-store.ts /025 SQL/신규 테스트는 신규 파일.

No-eligible의 claim 이전 거부는 이 attempt 저장소에 가짜 attempt로 저장하지 않는다. 별도 request rejection audit 범위이다. Parent ledger/copy 등록 외 다른 작업자 파일은 수정하지 않는다.
