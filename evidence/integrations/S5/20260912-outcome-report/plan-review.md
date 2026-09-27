# S5 outcome 보고서 연결 계획 독립 검토

판정: 계획 진행 가능, 구체적 설계 blocker 없음. 구현/실행 PASS가 아니다. Reviewer /root/contracts_review. 지정 계획과 기존 report seam만 읽었다. 제품 소스 수정/build/테스트/native/model/network0.

기존 명시적 exportRunReport 한 곳의 reader를 wrapper로 교체하는 범위는 적절하다. completion의 잦은 polling/단일 transaction/Stop 소유권 및 retrospective immutable 계약을 변경하지 않는다. 같은 DB/runId의 두 별도 읽기를 하나의 atomic snapshot으로 주장하지 않는 것이 중요하며 계획이 이를 명시한다.

baseReportDigest + recorded outcome.sourceDigest + 새 합성 IR digest로 원래 근거와 새 문서를 구분한다. 기존 branded IR을 mutate하거나 digest를 재사용하지 않고 private finish를 통해 새 IR을 만들며 renderReportHtml/createReportDelivery의 재렌더/hash/CSP 검증 경로를 유지한다. outer transaction 거부는 읽기와 파일 전달 전에 이루어져야 한다. 기존 readRunReport 실패를 fake success/unavailable 보고서로 대체하지 않는다.

후속 구현 gate에서 확인할 사항: bounded fixed unavailable reason 및 raw error 제외, 원본 source/run IR digest 불변, null/unknown/failed 결과의 정확한 표현, 최종 JSON/HTML/receipt hash에 부속 자료 포함, 두 snapshot 관계와 base digest 실제 표시, outerTX 파일0/DBtotalchanges0, 기존 IR size limit 안에서 동작, 실제 compiled reports wrapper가 같은compiled backend를 읽는지. 이는 계획에 이미 포함된 완료 조건의 확인이며 추가 기능 요구가 아니다.

평가 입력은 성능 개선·현재 자격·인수·정리 권한이 아니다. 금액/시간/품질 미측정 값을 만들지 않고 사용자의 기존 버튼에서만 읽는다. 실제 browser QA, 모델/qual 재측정 및 전체 S5 완료는 별도다. source가 현재 구현 중이라 본 문서는 최종 코드 검토를 대신하지 않는다.

계획 SHA-256:
FA8D93740454EFE4F481AB55A9BCA736A7A4669DC80DDD865303E230569EF585
