# 기존 구독 계정 실측 결과 — 2026-09-16

사용자 허용 상한 4회 중 **4회 사용**, 추가 실행 없음. 기존 Claude/ChatGPT 로그인만 사용했고 API 키 fallback 및 로컬 Qwen 호출은 하지 않았다.

| 슬롯 | 공급자 | 결과 | 실행 시간 | 관측 |
|---|---|---|---|---|
| 1 | Claude `opus / medium` | PASS | 4.566초 | 응답 모델 `claude-opus-5`; 정확한 JSON, terminal/usage, 임시 작업 폴더 정리 |
| 2 | Codex | FAIL | 2.502초 | CLI 옵션 위치 오류, exit 2; stdout/terminal/usage 없음 |
| 3 | Codex | FAIL | 2.313초 | 설정 로딩 실패, exit 1; 모델 없는 features list에서 기본 provider 덮어쓰기 거부 재현 |
| 4 | Codex `gpt-6-astra / high` 요청 | PASS | 9.780초 | 정확한 JSON, turn.completed/usage, 임시 인증 사본·작업 폴더 정리; 이벤트에 실제 모델 ID 없음 |

두 성공 실행 모두 정해진 덧셈·정렬·nonce 응답을 검증했다. stdout에서 도구/재시도 이벤트는 관측되지 않았다. HTTP 호출 수, 인증 복구 내부 재전송, 원격 종료 및 청구 확정은 이 기록만으로 알 수 없다. Codex 성공 시 stderr가 존재했으나 원문은 저장하지 않았으므로 내용은 미확정이다. 성공 판정은 stdout terminal·정답·usage·exit 및 소유 임시 경로 정리를 기준으로 한다.

Claude 사용량: 일반 입력 2, 캐시 생성 입력 2,712, 출력 61 토큰. CLI의 $0.028655는 API 환산 표시이며 실제 구독 청구액이 아니다. Codex 성공 사용량: 입력 17,419, 출력 42 토큰. 단일 짧은 작업과 서로 다른 기본 프롬프트이므로 효율/가격 비교 자료로 사용할 수 없다.

슬롯 2/3은 모델 응답 전 실패했어도 각각 한도를 소모했다. 슬롯 2의 옵션 진단은 도움말 재현으로, 슬롯 3의 설정 진단은 자격증명이 없는 프로필의 features list로 수행했다. 이는 실패 실행 stderr 원문을 보존한 것은 아니다. 실패 원본과 수정 전 스크립트는 유지한다. 슬롯 4에서는 비예약 provider ID를 사용하고 공식 ChatGPT endpoint, OpenAI 인증 요구, ChatGPT 로그인 강제, request/stream retry 0을 고정했다.

검증 범위는 signed installed CLI의 기존 구독을 통한 **짧은 정상 응답 가능성**이다. Cue 기본 앱→구현→독립 검증→최종 인수, app-server 보존 동작, 취소/재개, 실제 비용 원장, 네 모드 baseline/holdout 및 전체 출시는 남아 있다. 원본 상위 체크리스트는 44개 중 23개 완료·21개 미완료를 유지한다.

근거: [실행 승인](authorization.json), [사전 검사](CLI-PREFLIGHT.md), [runner 독립 검토](RUNNER-REVIEW.md), [수정 기록](CORRECTION.md), 슬롯별 spec/preflight/validation 및 `ledger/20260916-subscription-live/slot-N.json`.

공급자 설정 근거: [공식 Codex 0.154.0 provider 소스](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/model-provider-info/src/lib.rs), [Claude 환경변수 문서](https://code.claude.com/docs/en/env-vars). 소스 설정은 실제 원격 청구 증명이 아니다.
