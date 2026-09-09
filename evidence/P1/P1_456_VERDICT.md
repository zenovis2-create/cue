# P1-4 / P1-5 / P1-6 판정

## P1-4 — `worker-read` 페이징

### 질문

완료 워커 출력을 커서로 나눠 읽고, 소진 뒤 재개할 수 있는가? 소스가 바뀌면 무엇이 반환되는가?

### 실측

- 기존 완료 dispatch `ctx_462f43f3380e`(`completed` / `succeeded`, archived transcript)를 사용했다. 새 Orca run/task는 만들지 않았다.
- `--limit 2` 첫 페이지는 `result.transcript.returnedMessageCount=2`, `limited=true`와 top-level `result.cursor`를 반환했다. 같은 값은 `result.transcript.nextCursor`에도 있었다.
- 그 커서를 다음 호출의 `--cursor`에 넣자 다음 2건과 새 커서가 반환됐다. 새 커서를 다시 넣어 두 번째 실제 왕복도 성공했다.
- 마지막 데이터 페이지는 `limited=false`, `returnedMessageCount=42`였다. 끝 커서로 한 번 더 읽으면 `limited=false`, `returnedMessageCount=0`, 동일 cursor가 반환됐다. 따라서 끝 커서는 오류가 아니라 반복 가능한 빈 페이지다.
- `source_changed` 또는 유사 필드는 어느 성공 응답에도 없었다. transcript 커서에 `--source terminal`을 강제로 결합한 호출은 `source_changed`가 아니라 `runtime_error: ... structured transcript output only; terminal output was released.`로 실패했다. 실제 원본 변경은 읽기 전용 조건에서 만들지 않았으므로 그 조건의 동작은 미관측이다.
- 응답 warning은 oversized transcript record가 `skipped`되고 텍스트/tool input이 `clipped`될 수 있음을 밝혔다.

### 판정

**P1-4 = SUPPORTED.** 커서 필드는 top-level `result.cursor`이며 transcript 내부 별칭은 `result.transcript.nextCursor`; 페이지 크기는 `--limit`; 소진 신호는 `limited=false`와 끝 커서 재조회 시 `returnedMessageCount=0`; 같은 source identity에서는 재개 가능하다.

### 설계 영향

Cue adapter는 커서를 opaque 값으로 저장하고 `limited=false` 또는 빈 끝 페이지에서 종료해야 한다. `sourceIdentity`도 함께 기록하고, 오류/향후 `source_changed`가 오면 무커서 재시작해야 한다. worker-read 출력은 oversized record를 생략/절단할 수 있으므로 이를 완전한 감사 원장으로 간주하면 안 된다.

## P1-5 — 비용·토큰 회계

### 질문

Codex/Orca가 실행 하나의 사용량 또는 비용을 알려주는가?

### 실측

- 기존 app-server 원장에 실제 이벤트가 있다.
  - `thread/tokenUsage/updated.params.tokenUsage.last.totalTokens=20609`
  - 같은 객체의 `inputTokens=20468`, `cachedInputTokens=9216`, `outputTokens=141`, `reasoningOutputTokens=70`
  - 별도 경로 `rawResponse/completed.params.usage.totalTokens=18840`도 관측됐다.
- clean `CODEX_HOME`의 vendor `codex.exe exec --json` 실제 짧은 턴은 다음을 반환했다.
  - `turn.completed.usage.input_tokens=20297`
  - `cached_input_tokens=11008`, `output_tokens=12`, `reasoning_output_tokens=0`
- Codex에서 통화 비용 필드는 관측되지 않았고 app-server의 `usageMetadata`는 `null`이었다.
- `orca orchestration run-show`, `task-list`, `worker-show` 실제 JSON에는 usage/cost/token 필드가 없었다.

### 판정

**P1-5 = SUPPORTED (ABSENT 아님).** Codex의 실행별 토큰 회계는 존재한다. 통화 비용과 Orca 자체 집계는 없다.

### 설계 영향

`blocked/budget`을 “회계 전무” 이유로 계속 봉인할 필요는 없다. v0.1 집계 원천은 app-server의 `params.tokenUsage.last` 또는 exec의 `turn.completed.usage`로 한정하고, 통화 비용은 모델별 가격표 없이는 계산하지 말아야 한다. Orca run/task 필드에 비용이 있다고 가정하지 않는다.

## P1-6 — Hermes 이벤트 / 실행 중 개입

### 질문

Hermes가 실행 중 이벤트를 밖으로 내보내고 외부에서 메시지를 끼워 넣을 수 있는가?

### 실측

- 설치 버전은 `Hermes Agent v0.21.0`이다.
- `hermes logs`는 파일 조회, 필터 및 `-f/--follow` tail을 제공한다. 실제 `agent.log`에서 `tui_gateway.ws: ws accepted`/`ws closed ... messages=1`을 관측했다.
- `hermes serve`는 desktop/remote client용 JSON-RPC/WebSocket backend라고 표시되며, 설치 source에는 dashboard event subscriber WebSocket과 `/api/pty` 입력 채널이 있다.
- 설정/실행 코드에는 `busy_input_mode=interrupt|queue|steer`, `/steer` → `agent.steer(payload)`, typed input → `agent.interrupt(message)` 경로가 있다.
- 하지만 현재 `serve --status`는 `No hermes dashboard or serve processes running`, `gateway status`는 `Gateway is not running`, `webhook list`는 platform disabled였다. webhook은 outbound 실행 이벤트 sink가 아니라 inbound agent activation subscription이다.
- 특정 기존 실행에 붙어 headless CLI로 메시지를 주입하는 안정적 명령은 찾지 못했고, 읽기 전용 제약상 새 실행/주입 왕복도 수행하지 않았다.

### 판정

**P1-6 = INCONCLUSIVE.** 로그/WebSocket/PTY 및 in-process steer·interrupt 경로의 존재와 일부 WS 동작 흔적은 확인했지만, 외부 소비자가 실행 중인 특정 작업을 구독하고 개입하는 end-to-end 왕복은 검증하지 못했다.

### 설계 영향

Hermes는 지시대로 v0.1에서 `enforcement-only`로 유지한다. 후속 adapter 조사는 authenticated serve의 event subscriber + PTY 세션 식별/입력 계약을 대상으로 하되, 일반 webhook이나 `hermes send`를 실행 이벤트/로컬 세션 개입 API로 오인하지 않는다.

## 예상 밖 사실

`worker-read` transcript는 warning에 따라 oversized record를 건너뛰거나 텍스트/tool input을 절단한다. 따라서 페이징은 지원되지만 byte-complete 감사 스트림은 아니다. 또한 archived transcript에서 다른 source를 강제하면 `source_changed`가 아니라 terminal output released 오류가 났다.
