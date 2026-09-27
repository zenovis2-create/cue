## 다음 구현·검증 단위 — batch76

1. **S0/S1/S4-01 기본 native 실행:** 승인된 기존 파일의 snapshot/도구 계약 충돌은 native launcher fixture로 수정·검증했다. 다음은 기존 보호 모델에 따라 실제 runtime 결과·정리·명시적 checker·원장 권한을 구성하는 구현이며 그 뒤 setup/시작 경로를 연결한다. 빈 resolver나 enabled 플래그는 완료가 아니다. 새로운 파일 생성은 별도 native primitive가 필요하다.
2. **선택 부품 유지·추가 채택:** R03/R04/R05는 현재 canonical 선택 범위의 고정 revision과 실제 로컬 경계로 완료했다. 미채택 transport는 별도 조사·자격·도입 대상이며 새 선택 시 같은 게이트를 다시 적용한다.
3. **S5-04/05/08 실측:** baseline/holdout을 동결하고 신뢰 가능한 관측으로 네 모드 품질 하한·목표를 입증한다. 이번 비용 차원 저장 및 backend 회귀는 실제 청구 정확성이나 성능 개선의 증거가 아니다.
4. **A01/A08 전체 인수:** 기본 앱에서 구현→독립 검증→최종 인수까지 추적하고 남은 실제 경계와 출시 게이트를 통과해야 한다. held 관측 불명은 자동 재개하지 않는다.
5. **제한:** 구독 호출4/4 소진, 추가 모델 호출 없음, Qwen OFF, 출처 불명 과거 Codex SHA 보류, GOAL usageLimited를 유지한다. release not-ready와 improvement not-proven을 유지한다.
