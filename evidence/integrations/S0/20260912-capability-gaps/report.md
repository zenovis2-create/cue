# 요청 후보의 실제 등록 gap — 2026-09-12

읽기 전용 조사. 기존 S0 문서·로컬 introspection 증거·spec/backlog와 현재 catalog/host 구현만 대조했다. 새로운 외부 사실을 추가하지 않았으므로 공식 웹 재조사도 하지 않았다. 모든 버전/해시는 **2026-09-11의 역사적 관측**이며 오늘 설치 상태가 아니다. CLI/model/설치/인증파일 접근/제품 코드 변경0. 조사 가설1: 문서 후보 등록과 생산 실행 등록은 다르다. 아래 코드 대조로 확인했고 반복 가설 없음.

## 현재 코드와 이미 완료된 것

- `daemon/src/adapters/registry.ts`: 레거시 목록에는 codex만 있다. 실행 자격은 목록 선언과 별개라고 명시한다.
- `app/generated-json-host.mjs:60`: 보호된 model/checker 두 후보를 받아 catalog를 만들고 identity/모델 binding/각 자격 및 네 정책을 대조한다. 아래9개 사용자 도구를 자동 발견·추가하는 코드가 아니다.
- `daemon/src/integration-catalog.ts`: agent/model/checker/mcp/orchestrator 타입과 alias/설치/프로토콜/auth/subject/시각 평가 기능은 이미 있다. 이 타입 선언이 각 제품 어댑터 구현을 뜻하지 않는다.
- 등록 후보 읽기 전용 core/IPC/UI와 actual QA는 이미 완료 항목이다. 새 목록 UI나 catalog 기반을 다시 구현할 필요 없다.
- Hermes/OpenClaw/Orca 로컬 신원 조사도 checklist에서 완료다. 남은 일은 그 조사를 반복하는 것이 아니라 version/binary/protocol/소유권과 실제 연결 경계를 좁혀 확인하는 것이다.

## 후보별 차이

아래 source는 기존 CANDIDATE_INVENTORY/R-02/PI backlog에서 확인한 고정 링크다. 역할은 해당 기록의 분류이며 runtime capability 부여가 아니다. **9개 모두 현재 검사한 생산 host/registry에 개별 실행 후보로 연결되지 않았다.** 별도 의존 패키지나 과거 실험이 있다는 사실과 구분한다.

| 요청 | canonical identity / 기존 source | 확인된 관측·역할 | 아직 등록/검증되지 않은 정확한 부분 |
|---|---|---|---|
| agy | [google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli/tree/34406bef8e87fc103783c0c9715e5e2cce3c3e1b) | CLI coding agent. 서로 다른 두 PE/hash 관측 | 어느 설치가 승인 대상인지, 실제 버전·시작 부작용·headless schema·cancel/cleanup 미확정. 두 경로를 하나로 합치지 않음. 라이선스 확인 미완료. |
| grok build | [xai-org/grok-build](https://github.com/xai-org/grok-build/tree/37949780c144e37df692e3d669051a21fec24f20) | 로컬 coding agent. `.grok/bin` binary만 과거 version `1.0.25 (f7e67d6988e2) [stable]`, before/afterhash 동일. 다른 설치는 별도 | 공개 headless/ACP 선언은 있지만 설치 버전 wire와 modelbinding/auth/stop/billing/OS경계 미검증. 웹 Build 서비스와 동일 후보 처리 금지. |
| nlm mcp cli | [tmc/nlm](https://github.com/tmc/nlm/tree/23a4c4540f8fa6897397b9f688003bb774328914) 또는 [jacob-bd/gemini-notebook-mcp-cli](https://github.com/jacob-bd/gemini-notebook-mcp-cli/tree/03f7812c243f4d6ff732e2a485e6b9d35540f660) | 로컬 trampoline은 notebooklm-mcp-cli 배포의 notebooklm_tools entry를 지시, 소스 선언0.11.1. knowledge/service CLI 또는 MCP 역할 | 사용자 요청이 어느 repo인지 여전히 불명확. 로컬 발견 distribution과 source pin 대응 미확정. 실제 MCP 기능·데이터 생성/삭제·원격 auth/취소 미검증. LLM endpoint/coding agent로 등록 금지. |
| hermesagent | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent/tree/05d705dd695d1084388529124dc2ffe5ce919e89) | agent/gateway/subagent. 로컬 uv entry hermes_cli.main:main, 선언0.21.1 | 기존 보고서에서 recovery 초기화가 빠른version 이전에 호출됨. 안전한 help/version조차 미실행. 선언version=실행version 아님. tool/backend/child/session종료 authority 미연결. |
| openclaw | [openclaw/openclaw](https://github.com/openclaw/openclaw/tree/2128a6081516d44e82ecfb9bee059e8075596e0e) | agent/platform. 두 wrapper가 interpreter/env참조 방식 다름 | 로컬 module과 pin동일성 및 실제protocol/cleanup 미검증. 공식fastpath를 설치본에 상속하지 않음. 일반모델이 아니라 platform/하위orchestrator 역할 매핑 필요. |
| paseo | [getpaseo/paseo](https://github.com/getpaseo/paseo/tree/d7c7044dfc91d1d18721dc8757ac3bb913d8c232) | 하위agent 세션/원격 제어, Claude adapter 참고 | 설치identity/버전/실제attach/send/stop미측정. SDK+내부spawn/env/state 결합; Cue와 이중owner 위험. 전체추출defer는 기존결정이며 재조사완료로 변경하지 않음. |
| orca | [stablyai/orca](https://github.com/stablyai/orca/tree/2ecde717b4561cae1701a27615f704434232399a) | ADE/CLI·worktree·agent 조정자. wrapper→nativeexe 지문 관측 | 설치version/upstream동일성 미확정. wrapper는 일부 메시지 명령 거부하므로 native exactargv 필요. Cue대신최종owner가 되는지 종속owner인지 계약 및 stop/cleanup 미정. 현재 대화의 Orca 사용을 Cue 통합증거로 계산 금지. |
| herdr | [herdrdev/herdr](https://github.com/herdrdev/herdr/tree/61ca85d5895bb530b59da85beeccdd767f4720d2) | terminal/agent 자동화 후보 | 로컬 설치/entry/version/source 대응과 machine-readable 제어계약 미확정. ready detection은 작업완료/검증/정리의 증거 아님. |
| pi | [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop/tree/db29ac2e8e5d59d9da8ba73d18423e964548c1a5) | 사용자 원본은 desktop+Rust host+pi harness. spec의 pi는 추가runtime 후보; PI-01~05는 구조 재사용 항목 | PI-Desktop repo identity는 고정됐지만 독립 pi agent package/실행파일 canonical binding은 이 기록들에서 미확정. desktop와 harness를 같은실행대상으로 등록 금지. LGPL표기와편입조건, host/runtime API의 독립성 검토 남음. |



## 사용자 모델 별칭 gap

spec 원문 모델 후보는 모두 실제 vendor ID·계정 entitlement·지원 tool·가격/성능 측정을 뜻하지 않는다. 이번 도구 조사로 gpt/Claude/Gemini/Qwen/Grok 등의 모델 별칭을 추가 매핑하지 않았다. 현재 고정 로컬 provider ID와 checker는 별도 경로이며 새로운 도구의 지원 모델 목록으로 재사용할 수 없다. 지금 네모드 고정pair UI/정책 비교가 존재해도 여러 외부 agent를 최적 배치한 증거는 아니다.

## 다음 최소 구현 하나

**Grok exact-install observation을 현재 host catalog에 연결하는 보호된 읽기 전용 등록 단위**를 우선 제안한다. 이유는 후보 중 한 정확한 binary에 과거version+hash 관측이 이미 있어, 같은 검색/CLI호출을 반복하지 않고 새 production inventory 소비경로를 만들 수 있기 때문이다.

범위는 host가 명시한 하나의 승인 설치 descriptor(binary path+expectedhash+과거 observation/evidence reference)를 기존 catalog/UI로 투영하는 연결이다. 사용자/모델이 임의 경로나 권한을 제출할 수 없고, noexec이며 runtime resolver에는 등록하지 않는다. 등록 source와 실제파일 hash가 다르면 unavailable. 현재 파일hash 재확인 시각과 과거version/protocol관측시각을 분리해 오래된 계약을 갱신된 것으로 표시하지 않는다. auth/실제wire/모델/자격은 unknown 유지. 불명확한 `.local/bin` 설치로 fallback하지 않는다.

기존 catalog의 단일 observedAt에 서로 다른 종류의 freshness를 무리하게 합치지 말고, 최초 단위는 과거 관측시각 유지와 source reference를 가진 host projection으로 제한한다. default generated JSON pair와 분리된 비실행 관측 목록을 기존 UI read API가 소비해야 하며 새로운 고립된 registry모듈만 추가하고 끝내지 않는다. 현재 unavailable bootstrap shape를 바꾸려면 먼저 좁은 명세/독립 검토를 거친다.

완료 gate: 실제 tempbinary fixture의 exacthash/변경/없음/경로바꿔치기 거절, 관측시각 불변, secret/path display제외, 기존catalog평가/현재inventoryIPC→DOM 테스트, runtime.start에서 해당candidate미등록 확인, task/session/approval0. sharedbuild/typecheck와독립검토 후 no-model actualElectron 목록QA. 이 단위는 Grok 실행지원 완료가 아니라 문서에만 있던 관측을 기존제품목록이 실제소비하는 좁은 연결이다.

실제 coding agent 연결은 그 다음 별도 S1: 설치버전 headless/ACP sourcegrounded protocol, 소유권/정지/범위/현재qualification이 필요하다. 다른 도구의 기본 authhome복사·임의 설치·모델call은 제안범위가 아니다.

## 대조 근거

- docs/INTEGRATION_SPEC.md §§후보/S0/S1 및 docs/INTEGRATION_BACKLOG.md PI-01~05.
- docs/INTEGRATION_CHECKLIST.md: 기존 S0 세후보 조사·catalog·등록후보UI 완료와 실제자동발견/다중후보선택 미완료 구분.
- docs/reuse-decisions/CANDIDATE_INVENTORY.md, R-02.md.
- evidence/integrations/S0/20260911-three-candidate-introspection/report.md 및 20260911-remaining-cli-identity/report.md.
- app/generated-json-host.mjs, daemon/src/integration-catalog.ts, daemon/src/adapters/registry.ts 실제source 대조.

이번 보고서는 이 완료된 조사·UI·catalog 구현을 새 완료성과로 중복 계산하지 않는다. 정확한 현재설치/모델권한은 전부 별도 측정으로 남긴다.
