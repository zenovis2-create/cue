## 다음 구현·검증 단위 — batch75

1. **S0/S1 실제 앱 자격:** native 구현·독립 verifier 배포 seam을 보호된 기본 앱 설정에 연결하되, 현재 설치 identity를 인증·entitlement·protocol 자격으로 승격하지 않는다. app-server·취소·재개·정리의 실제 경계는 별도 승인과 예산 뒤 검증한다.
2. **S2/S5 실제 관측:** backend 단계 정산과 비용 UI 표시의 독립 판정을 보존한다. 구독/API/local별 신뢰 가능한 실제 생산자, 동결 baseline/holdout 및 네 모드 비교는 새 입력·예산이 확보된 뒤 수행한다.
3. **R03~R05 재사용 편입:** 실제 선택된 부품에 대해서만 lifecycle matrix, 고정 revision/고지/adapter/patch ledger, upstream과 Cue 및 필요한 실제 경계 영수증을 같은 revision에 묶는다. 미채택 후보를 빈 집합으로 해석해 닫지 않는다.
4. **S3/S4 전체 workflow:** writer backend 완료와 기본 앱 전체 구현→독립 검증→최종 인수 자격을 구분한다. held 외부 부작용은 인증된 관측자가 없으면 계속 held이고 자동 재개하지 않는다. 실패한 staged 실행은 게시 없이 정리됐다는 별도 durable discard 상태·migration·lease 조건이 필요하다. 기존 committed-publication 정리 상태로 대신 기록하는 실험은 실패해 복원했다.
5. **예산·출시:** 구독 호출 4/4 소진, 추가 모델 호출 없음, Qwen OFF, 출처 불명 과거 Codex SHA 보류를 유지한다. release는 not-ready, 개선은 not-proven이며 승인된 `closures.json` 밖의 상위 항목을 완료로 계산하지 않는다.
