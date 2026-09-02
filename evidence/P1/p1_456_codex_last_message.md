조사를 완료했고 요구된 산출물을 생성했습니다.

- **P1-4 — SUPPORTED:** 실제 커서를 두 번 이상 왕복했고, 소진 후에는 `limited=false`, `returnedMessageCount=0`, 동일 cursor가 반환됐습니다.
- **P1-5 — SUPPORTED:** Codex app-server와 `codex exec --json` 모두 실행별 토큰 필드를 제공합니다. Orca 집계와 통화 비용 필드는 발견되지 않았습니다.
- **P1-6 — INCONCLUSIVE:** Hermes의 로그 tail, WebSocket 이벤트/PTY, steer·interrupt 경로는 확인했지만, 현재 서버가 꺼져 있어 특정 실행에 대한 외부 개입 왕복은 검증하지 못했습니다.

중요하게 **P1-5는 ABSENT가 아닙니다.** 따라서 “회계 기능 전무”를 이유로 `blocked/budget`을 봉인할 필요는 없습니다. 집계 원천은 `thread/tokenUsage/updated.params.tokenUsage.last` 또는 `turn.completed.usage`로 제한해야 합니다.

예상 밖 사실: `worker-read`는 oversized transcript record를 생략하거나 절단할 수 있습니다. 따라서 페이징은 지원되지만 byte-complete 감사 원장으로 사용하면 안 됩니다.

산출물:

- [판정문](C:/Users/User/cue/evidence/P1/P1_456_VERDICT.md)
- [구조화 결과](C:/Users/User/cue/evidence/P1/p1_456_result.json)
- [P1-4 프로브](C:/Users/User/cue/probes/p1_4_worker_read_paging.py)
- [P1-4 원장](C:/Users/User/cue/evidence/P1/p1_4_ledger.log)
- [P1-5 원장](C:/Users/User/cue/evidence/P1/p1_5_accounting.log)
- [P1-6 원장](C:/Users/User/cue/evidence/P1/p1_6_hermes_events.log)

Python 구문 검사와 JSON 파싱 검증도 통과했습니다. 금지 경로에는 쓰지 않았으며 기존 Orca run/task를 변경하지 않았습니다.