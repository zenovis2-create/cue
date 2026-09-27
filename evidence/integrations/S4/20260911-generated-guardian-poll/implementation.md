# Guardian 잔존 재관찰

실제 카나리 `D:/Temp/User/Cue.GeneratedResume.e2e8sl`는 생성 bytes를 저장했지만 첫 guardian residual 관찰로 producer가 blocked가 됐다. 독립 원장 감사에서 11:59:01.703 residual 후 11:59:01.834 verified-clean이 발견됐다. 기존 attempt의 blocked/cleanup 0과 acceptance 부재를 그대로 보존한다. 131ms 차이의 후속 정리 사실은 과거 실패를 성공으로 바꾸지 않는다. 누적 Qwen 요청 2회를 소모했으며 추가 라이브 호출은 없다.

App host가 첫 terminal receipt를 발급하기 전에 기존 cleanup OS observer를 다시 호출한다. residual만 50ms 간격으로 최대 10초의 monotonic deadline 동안 재관찰한다. 매 관찰은 기존 durable store에 저장된다. unknown은 즉시 반환하며, abort는 대기를 해제하고 마지막 receipt를 유지한다. 프로세스 종료/경로 삭제/새 실행/청구 확정은 하지 않는다.

완료 gate: build exit 0 + focused host tests + 독립 검토. 신규 finding 진단 상한 2회, 현재 수정 가설 1회로 통과. `npm run build` exit 0. Host 기존 및 신규 14개 PASS(11.34s), 이후 unknown 즉시 반환 테스트 1개 추가 PASS(469ms). Persistent residual은 10038ms 후 blocked, cancel은 40ms, delayed guardian은 303ms 후 실제 observer의 verified-clean을 얻는 synthetic PID 관찰 fixture다. 실제 Node import 회귀도 통과했다. 현재 테스트는 추가 실환경 모델 성공을 의미하지 않는다.

최종 연결 focused gate와 source hashes는 독립 `review.md`에 기록한다.
