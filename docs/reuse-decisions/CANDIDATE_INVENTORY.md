# 도구 후보 identity 조사 목록

조사일: 2026-09-11 · 신원 통합 검토일: 2026-09-12 · 상태: **비활성 후보 목록**

이번에 갱신한 `agy`부터 `pi / PI-Desktop`까지의 요청 후보에서 `resolved-unqualified`는 제품 신원만 확정됐다는 뜻이며 해당 후보 행은 비활성·실행 불가다. 로컬 설치·Cue 호환·인증·프로토콜 실측·특정 모델 접근·실행 자격·admission을 뜻하지 않는다. `inactive-unresolved` 이름은 제품을 선택하거나 registry alias로 확정하지 않는다. 2026-09-12 신원 판정과 고정 revision의 기존 근거는 [독립 통합 검토](../../evidence/integrations/S0/20260912-candidate-identity/review.md)를 따른다. 이후 두 제품의 사용자 선택은 [확인 기록](../../evidence/integrations/S0/20260912-confirmed-identities/report.md)이 해당 두 행의 모호함 판정을 대체한다.

| 사용자 후보 | primary identity / 고정 조사 revision | 역할·연결 근거 | Windows·라이선스·남은 확인 | 상태 |
|---|---|---|---|---|
| Codex CLI | 기존 Cue Codex 경로, [공식 app-server](https://learn.chatgpt.com/docs/app-server) | JSONL RPC, thread/turn/interrupt. 기존 host/model와 workspace worker 분리 유지 | 실행 binary identity/hash/schema는 S1에서 고정. 본 목록은 코드 복사 없음; 신규 재배포 시 license/notice 확인 | 기존 연결 기준선, 공통화 실험 대상 |
| Claude Code CLI | [anthropics/claude-code](https://github.com/anthropics/claude-code/tree/536a2e23d9e28586f81f17b3535281b5f2995a70) | 공식 print/stream-json; [R-02](R-02.md) 모델 전용 실험 | native Windows 실행과 sandbox 미지원 구분. LICENSE.md Commercial Terms. API/auth 연결 계약 미확정 | 사전 선별 |
| agy | [google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli/tree/e4afe6b6f3aa115b1ba31e26db6508a23b5e42e5), command `agy` | Google Antigravity coding-agent CLI/orchestrator; managed subprocess JSON/NDJSON is the narrow candidate boundary | Public repo has no established license grant; installed binary/version, auth, protocol and cleanup unmeasured | **inactive / resolved-unqualified** |
| grok build | [xai-org/grok-build](https://github.com/xai-org/grok-build/tree/37949780c144e37df692e3d669051a21fec24f20), command `grok` | SpaceXAI coding-agent CLI/runtime; ACP stdio is the narrow long-lived candidate boundary | Apache-2.0 first-party plus third-party notices; installed artifact, auth and lifecycle unmeasured | **inactive / resolved-unqualified** |
| nlm mcp cli | 사용자 선택 [jacob-bd/notebooklm-mcp-cli](https://github.com/jacob-bd/notebooklm-mcp-cli)를 alias로 보존; canonical [jacob-bd/gemini-notebook-mcp-cli](https://github.com/jacob-bd/gemini-notebook-mcp-cli/tree/03f7812c243f4d6ff732e2a485e6b9d35540f660) | package `notebooklm-mcp-cli`; CLI `nlm`, MCP server `notebooklm-mcp`. Notebook 서비스 도구이며 일반 모델이 아님 | MIT 표기; 설치 package/source pin 일치·auth·MCP 시작/취소·서비스 부작용·전체 라이선스 조건 미검증. `tmc/nlm`은 선택하지 않음 | **inactive / resolved-unqualified / user-selected** |
| hermesagent | 사용자 선택 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent/tree/2f21d29f4446134b51b7e6b1d2f515502bc0ae5e) | Hermes Agent / agent·gateway; 모델·도구·세션은 Hermes 소유, Cue 연결 계약 별도 | 설치 artifact/source pin 일치·auth·protocol·tool/child 정리·전체 라이선스 조건 미검증. `hermesagent/hermesforge-mcp`는 선택하지 않음 | **inactive / resolved-unqualified / user-selected** |
| openclaw | [openclaw/openclaw](https://github.com/openclaw/openclaw/tree/a0148f9a81c6db230002d08838f6732b6358fcba), package/bin `openclaw` | agent platform/Gateway; Gateway WebSocket client가 후보 경계 | MIT + third-party notices; Gateway-owned session/worker와 Cue cleanup 소유권 실측 필요 | **inactive / resolved-unqualified** |
| paseo | [getpaseo/paseo](https://github.com/getpaseo/paseo/tree/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b), package `@getpaseo/cli`, bin `paseo` | agent/workspace daemon; SDK/daemon WebSocket이 후보 경계 | Apache-2.0 first-party; Paseo-owned child/worktree lifecycle 실측 필요 | **inactive / resolved-unqualified** |
| orca | **이미 확립된 로컬 Orca 제품 identity**; 공개 비교 후보 [stablyai/orca](https://github.com/stablyai/orca/tree/556a7772ed7bdf67d5f811449d07f06dcd4285f4) | 로컬 Orca의 version-matched guide만 command 계약 근거; Orca-managed worktree/terminal/task를 Orca가 소유 | 로컬 설치본의 public-source provenance 미확정. 이름/형태만으로 `stablyai/orca` 또는 별도 [xiws/orca](https://github.com/xiws/orca/tree/067d638a1c0849276dc0414db578c01dbb7f740d)에 귀속 금지 | **inactive / local resolved-unqualified; public provenance unresolved** |
| herdr | [herdrdev/herdr](https://github.com/herdrdev/herdr/tree/9ad65d9031e8cb16a7b553c0e6f74809e9811e92), package/bin `herdr` | persistent terminal workspace/runtime; CLI JSON wrapper가 좁은 후보 경계 | Apache-2.0 + Windows packaging notices; pipe ACL, state semantics and cleanup unmeasured | **inactive / resolved-unqualified** |
| pi / PI-Desktop | [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop/tree/2b1ebb9336a871688a8aee0a17a5214ed7a41a25); stable `v0.14.6` | local-first desktop app; opt-in loopback MCP가 후보 경계. 내장 [Pi Agent Harness](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477)는 별도 실행 후보로 암묵 등록하지 않음 | PI-Desktop LGPL-3.0, Pi Harness MIT; MCP opt-in/auth/authority/lifecycle 미측정 | **inactive / resolved-unqualified** |

## 공통 등록 규칙

- `identity-known`, `installed`, `authenticated`, `protocol-tested`, `qualified`를 별개 필드로 관리한다. 표에 있는 후보는 자동으로 installed/qualified가 되지 않는다.
- source SHA와 배포 package/binary hash를 분리한다. dynamic 공식 docs는 조회일을 기록했으며 실제 설치 버전의 CLI help/schema/계약 fixture로 다시 확인한다.
- MCP 도구·모델 endpoint·coding agent·하위 orchestrator를 하나의 실행 권한으로 합치지 않는다. 모든 후보의 원격 비용 종료/로컬 트리 사망은 아직 별도 실험 대상이다.
- native Windows 지원 문구는 Cue의 자식 프로세스 금지·credential isolation·정지 계약 통과를 의미하지 않는다.
- 외부 저장소의 install/upgrade/migration 명령은 실행하지 않았다. 특히 다른 도구 설정/토큰을 옮기는 기능은 자동 적용하지 않는다.
- 사용자 모델 별칭은 [통합 spec](../INTEGRATION_SPEC.md)의 원문 목록을 유지한다. 이 조사로 모델 존재·가용성·가격·순위를 확정하지 않는다.

## 다음 측정

로컬 read-only 관측(부모 작업): Claude `--version` 2.1.267, Ollama client 0.32.14 및 실행 서버 없음, Node 24.18.0/npm 12.0.1. 인증·모델 접근·binary hash는 확인하지 않았으며 이 사실만으로 qualified를 부여하지 않는다.

S1은 Codex 공통화 + Claude 모델 전용 연결 + 로컬 endpoint에 집중한다. 나머지 후보 심층 조사가 이를 막지 않는다. 후보별 exact binary/버전, 설치/인증 계약, stream fixture, 취소/복구/부작용, 모델 canonical 목록 조회가 완료된 범위만 자격을 부여한다. 2026-09-12 사용자 확인으로 `nlm mcp cli`와 `hermesagent`의 제품 선택은 확정되었으며 실제 설치·연결·자격은 여전히 별도다.

검토 상태: 작성자 사전 조사 완료. 독립 검토와 실제 실행 게이트는 별도 기록이 필요하다.

## 확인된 로컬 endpoint — 2026-09-11 후속

| 사용자 후보 | 실제 접속 정보 | 관측 | 지원 상태 |
|---|---|---|---|
| Qwen 로컬 모델 | llama.cpp OpenAI 호환 `http://127.0.0.1:8085/v1`, `qwen38-27b-unc` | 모델 목록의 동일 ID, 서버 보고 context 147456, SSE 텍스트 `OK`와 terminal | 연결 확인; 모델 weight 지문·M1~M3·사용량·실제 정지·제품 등록 미완료 |

이 ID는 사용자가 제공하고 서버가 광고한 값이다. 마케팅 모델명과 weight의 동일성을 독립 검증한 것은 아니다. [증거](../../evidence/integrations/S1/20260911-qwen-live/result.json). 다른 미확인 모델 별칭을 이 endpoint로 임의 매핑하지 않는다.
