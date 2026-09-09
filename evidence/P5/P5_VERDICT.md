# Phase 5 판정

최종 판정: **PASS**

검증 시각: 2026-09-03 (Asia/Seoul)

검증 명령: `npm test`

실측 결과: **99 passed / 3 skipped / 0 failed**, 7개 테스트 파일 통과. Phase 5 전용 테스트는 16개이며, 기존 Phase 1~4.5 단정의 삭제·약화·skip 추가는 없다. 전체 원문은 `p5_test_output.log`에 보존했다.

| 항목 | 판정 | 핵심 증거 |
|---|---|---|
| P5-1 | PASS | 다섯 신호원의 conclusive/candidate 등급 테스트 |
| P5-2 | PASS | 후보 1건 0회, 2건 1회 진단 호출 |
| P5-3 | PASS | 음성 3건·양성 1건 상태 전이 |
| P5-4 | PASS | 유형별 threshold 데이터 및 상이한 동작 |
| P5-5 | PASS | 4단 attempt 계보, parent, 가설, 상한 전이 |
| P5-6 | PASS | base SHA/diff hash/fence 선행 및 실제 파일 보존 |
| P5-7 | PASS | handoff 스키마 검증, 자동 executor 부재 |
| P5-8 | PASS | 자율성 1/2/3 모두 human_required |
| P5-9 | PASS | 동일 실패에 서로 다른 계보, 수준 1 attempt 0 |
| P5-10 | PASS | 봉투 밖 decline, 계약·상한 불변 |
| P5-11 | PASS | 상향 stop_new_run, 하향 즉시 반영·원장 기록 |
| P5-12 | PASS | run_id별 수준 조회 및 기존 DB 업그레이드 |

재시작 경로에서 사용자 작업물을 버리는 코드가 있는가: **아니오**

자율성 ③이 봉투·상한·계약을 넓힐 수 있는가: **아니오**

증거 로그 SHA-256: `043D74501E3EABF330204064DBC9FE9D4C4F10BA135D18BF657B70014433566D`
