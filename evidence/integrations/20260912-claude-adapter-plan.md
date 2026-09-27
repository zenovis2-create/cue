# Claude adapter: 최소 생산 연결 계획

작성 2026-09-12 · 상태: read-only source discovery / 구현·채택·실행 자격 미완료.

이번 작업은 아래 로컬 소스와 기존 고정 출처 기록만 읽었다. Claude/모델 실행, 버전 재조회, 인증 파일 조회, 설치·다운로드·빌드·제품 코드 변경은 하지 않았다. 새 upstream 검증이 아니며 2026-09-11의 버전/문서 관측을 현재 설치 상태로 승격하지 않는다.

## 결정

가장 작은 다음 단위는 Cue 소유 `HostCandidate.launch(RuntimeContext)`에 맞는 **기본 비활성 Claude 모델 전용 transport**다. 별도 스케줄러/원장/SDK 런타임을 만들지 않는다. 오프라인 launch-spec의 엄격한 입력/argv 규칙을 생산 모듈로 옮기고, 부분 JSONL 파서를 보강한다. 실제 Claude 실행 파일·인증·모델·경계 자격이 확인되기 전 registry/default host/UI dispatch에 연결하지 않는다.

사용자가 원하는 복수 코딩 에이전트의 완성이 아니다. 최초 범위는 제공된 텍스트의 응답 전송이며 파일 변경·도구 bridge·Claude의 자체 승인 권한은 범위 밖이다.

## 재사용 출처와 한계

- `scripts/reuse/claude-launch-spec.mjs` SHA256 `57A07D016BE906F01CF2AE1D188A936CB36A036D385DF9D0EC67E86F66B4FD17`; test `3DB03F2F1AF964BF7BB886ECF5009FFB3F189638EC31DA9BB8CF1C6AC6E1CECB`. R-02에 9 fixture PASS 기록이 있다. 이번에는 재실행하지 않았다.
- exact `2.1.267`, native `claude.exe`, own-data snapshot, verified canonical binding, tools/MCP/customization 차단, clean home/env, prompt stdin, unreviewed-version refusal을 재사용한다. `identityVerified:true`는 현재 caller 주장일 뿐 증거 조회기가 아니므로 생산 request 필드로 허용하지 않는다. `auth:unconfigured`, `executable:false`는 사실상 실행 준비가 안 되었음을 뜻한다.
- 기존 파서는 전체 문자열 JSONL 최대1MiB, init/terminal/tool-event 일부 검사만 한다. UTF-8 오류 검증, stream 상태 전이, block index, 세션/모델 일치, stop reason, incremental usage의 검증 완료로 볼 수 없다. `providerStatus:completed`도 native process death/요구사항 acceptance/billing 완료가 아니다.
- `docs/reuse-decisions/R-02.md` SHA256 `BF41C2E53C19D504D9A8A719A0B2D8A3F923F090D59B7AA5482515DA4D3EE13E`의 과거 source/license 기록을 이어받는다: [Claude CLI LICENSE](https://github.com/anthropics/claude-code/blob/536a2e23d9e28586f81f17b3535281b5f2995a70/LICENSE.md), [SDK LICENSE](https://github.com/anthropics/claude-agent-sdk-typescript/blob/80eebc4881da2f11140deb6114f4bceff8da704a/LICENSE.md). 해당 기록은 Commercial Terms를 지적하며 OSS 재배포 허가로 보지 않는다. 버전/배포·인증 약관은 실제 연결 전에 다시 확인할 항목이다.
- Paseo [query.ts](https://github.com/getpaseo/paseo/blob/d7c7044dfc91d1d18721dc8757ac3bb913d8c232/packages/server/src/server/agent/providers/claude/query.ts)는 기존 R-02 참고 후보다. 프로세스/env/state 엔진 전체 추출은 Cue 소유권과 중복이므로 이번 단위에서 편입하지 않는다. 외부 코드/의존성 추가 0.

## 기존 생산 seam

| 소스 | 재사용 범위 | 그대로 쓰면 안 되는 부분 |
|---|---|---|
| `daemon/src/integration-runtime.ts` | RuntimeContext attempt identity/signal, HostCandidate.launch, AdapterExecution completion/cancel, fresh capability admission, duplicate run refusal | adapter의 terminal을 cleanup/acceptance로 승격 금지; 후보는 host resolver 전용 |
| `daemon/src/adapters/integration-executors.ts` | attempt Envelope+SessionOwner 대조, bounded callback/ordinal, late callback host fencing | Codex implementation role/goalVerification을 Claude 모델 결과로 복제 금지 |
| `daemon/src/process-launch.ts` | sole child_process boundary, `spawnOwned` session 등록/실패 소유 | `spawnOwnedPiped`는 env 인수가 없고 상속 환경을 쓴다. Claude에 그대로 사용 금지 |
| `daemon/src/adapters/isolated-local-model.ts` | request/attempt ID, bounded transport, cancel 및 독립 cleanup 결과 분리의 사례 | 고정 Qwen broker, AppContainer subject/guardian evidence를 Claude에 재사용해 자격 주장 금지 |
| `daemon/src/host-codex-runtime.ts` / `tool-home.ts` | 소유권·정리 계약의 사례 | Codex RPC/credential home/worker envelope를 이름만 바꿔 재사용 금지 |

생산 spawn은 기존 `spawnOwned(db, owner, exactBinary, argv, {env: exactAllowlist, windowsHide:true, stdio:['pipe','pipe','pipe']})`를 사용한다. adapter에서 node:child_process를 import하지 않는다. stdin/stdout/stderr 존재 검사와 failed registration/no-PID 경로를 검증한다. 필요한 작은 공용 helper가 확인되면 별도 소유 범위로 제안하고 P4/P45 목록을 넓히지 않는다.

## 제안 파일/API와 두 단위 경계

1. `daemon/src/adapters/claude-protocol.ts` + `integration-claude-protocol.test.ts`: 기존 own-data builder의 단일 생산 원본, 고정 reviewed version/flags, bounded byte UTF8/JSONL decoder와 보수적 상태 전이. 실험 스크립트는 후속으로 이 모듈을 재export하거나 과거 fixture로 보존해 두 구현이 갈라지지 않게 한다. 이 단계는 subprocess 0.
2. `daemon/src/adapters/claude-model.ts` + `integration-claude-model.test.ts`: 기존 process-launch를 쓰는 inactive executor. 별도 unit으로 소유권·취소 회귀를 끝낸다. 실제 CLI가 아닌 고정 테스트 transport/process fixture만 사용한다.

개략 계약:

```ts
createClaudeModelExecutor(host: {
  db: Ledger;
  binding: HostVerifiedClaudeBinding; // exact binary path/hash/version + canonical model/account reference; host only
  resolveAttempt(context: RuntimeContext): { owner: SessionOwner; envelope: Envelope; prompt: string; isolatedHome: string };
  resolveEnvironment(binding: HostVerifiedClaudeBinding): Readonly<AllowedClaudeEnvironment>;
  observeEvent(event: AttemptBoundClaudeEvent): void | Promise<void>;
  stopOwnedExecution(identity: OwnedClaudeIdentity): Promise<void>;
}): (context: RuntimeContext) => Promise<ClaudeExecution>;

// extends AdapterExecution
// result: { attemptId, requestId, providerTerminal, text, usage?, localCleanup:'unknown', remoteBilling:'unknown', acceptance:'unverified' }
```

이는 제안 API이며 미구현이다. HostVerifiedClaudeBinding은 renderer/model DTO가 아니다. 인증 값은 host credential resolver가 실제 지원되는 수단으로만 주입하며 홈 복사/ambient env/PATH 탐색/CLI 로그인 자동 실행을 하지 않는다. 인증 수단이 미확정이면 실행 거절한다. `stopOwnedExecution`은 단순 Promise 성공만으로 cleanup을 증명하지 않으며 실제 PID+creationtime/owned tree와 연결된 기존 host 경로여야 한다.

owner.run_id/envelope.run_id/context.runId 일치, task/cwd, immutable subject/model binding 대조. role=model만 허용하고 no file-change envelope. prompt/응답은 argv나 진단 로그에 넣지 않는다. 원문 stderr를 ledger/UI에 넣지 않는다. 홈은 승인된 ephemeral host root이며 사용자 workspace와 분리한다. 이 분리는 OS sandbox 증명이 아니다.

## 프로토콜/수명주기 완료 조건

- UTF8 fatal streaming decoder, CRLF 처리 계약, total1MiB/프레임·이벤트 수/timeout 한도. UTF8 분할/비정상 byte, EOF 중간 JSON, oversize, trailing data, duplicate terminal 거절. 기존16,384 UTF16 prompt limit는 historical experiment limit이고 제품 바이트 한도는 명시 별도 계약으로 정한다.
- 빈 tool/MCP init 요구, 알려진 schema만 허용, tool/tool_result/unknown block 차단. text/thinking/signature는 허용 schema별 처리하며 thinking은 UI/로그 기본 노출하지 않는다. assistant full text와 delta를 두 번 합치지 않는다.
- 정확 모델/세션 필드의 live schema가 미확인인 상태에서는 임의 필드/alias를 만들어 통과시키지 않는다. 해당 fixture를 '합성'으로 표시하고 실제 자격을 비활성 유지한다.
- text provisional events와 terminal 결과를 구분한다. 성공은 지원되는 정상 terminal, 완전 EOF, exit0, abort없음으로 한정한다. 길이제한/최대턴/실패/미지원 stop reason은 succeeded 아님. usage가 없으면 unknown; local exit로 비용0/최종과금 확정 금지.
- launch 전에 소유권 상태를 확보하고 abort listener 등록; 지연 launch/초기 abort/close/error를 한 번만 settle한다. cancel은 idempotent, pending launch도 소유하고 bounded drain한다. 등록 실패/정리 관측 부족 시 runtime unknown 보존; retry/relaunch 자동 수행 금지.
- host callback throw/timeout에서도 pipes/process 소유권 유지. attempt+ordinal로 늦은 sink side effects를 fence한다. 재시작하면 ledger session+host 측정을 대조하며 이전 요청 자동 재전송 금지.
- cleanup은 RuntimeHost.verifyCleanup/verifyFailedStartCleanup의 독립 호스트 관측. local 죽음과 remote billing/요구사항 acceptance를 분리한다. 같은 ID 재호출은 runtime/engine 기존 idempotency와 회귀 비교한다.

## 실제 활성화 전 남은 차단점

현재 모델 경계는 M1/M2/M3를 요구한다. 도구를 끈 Claude cloud CLI도 직접 provider network가 필요하므로, 고정 no-network client + host broker인 현 Qwen 경계를 자동 충족하지 않는다. 이를 허용하려고 M3를 약화하거나 기존 Qwen의 subject/evidence를 붙이지 않는다. 실제 자격 설계는 **별도 네이티브 경계/브로커 단위**이며 필요하면 승인된 provider API host broker와 비네트워크 client를 검토한다. 그 대안은 Claude Code CLI 실행 지원과 같은 기능이 아니다.

따라서 transport 구현 완료 뒤에도 기본 후보 미등록/비활성, auth 미확정이면 unauthenticated, current subject/evidence 없으면 ineligible이다. UI 등록 관측과 실행 자격을 구분한다. 여러 모델/agent 선택 또는 비용 ranking이 개선됐다는 주장을 하지 않는다. 실제 CLI binary/deps/control bundle 고정, 약관·인증 경로, canonical model 확인, Windows 파일/자식/network/정상·stop·crash 관측, 독립 review 이후에만 별도 live gate를 요청한다. 현재 live 허용량을 재사용하지 않는다.

## 실행 gate / 교정 상한

구현 시작 시 source preimage, fixture/command hashes를 새 evidence에 저장한다. 각 단위 최대2개 진단 교정, 실패 시 근거와 미완료를 남기고 scope 재설계한다. parser gate → executor fixture gate → 공통 lifecycle regression 순서로만 넓힌다.

```powershell
cd daemon
npx vitest run test/integration-claude-protocol.test.ts --fileParallelism=false --maxWorkers=1
# 다음 소유권 단위에서 파일이 생긴 뒤:
npx vitest run test/integration-claude-model.test.ts test/integration-runtime-contract.test.ts test/integration-executors.test.ts test/p4.test.ts test/p45.test.ts --fileParallelism=false --maxWorkers=1
npm run build
```

명령은 향후 제안이며 이번 discovery에서 실행하지 않았다. 기존 runtime-contract/executors/P4/P45 파일 존재는 이번 rg로 확인했다. 신규 Claude 테스트 두 개는 아직 제안 경로다. 새 실모델 gate는 별도 승인/한도와 current measurement가 필요하다. maker/checker 분리, compiled adapter fixture 검증, 실패/취소/재시작 evidence 후에만 S1의 해당 좁은 체크 항목을 완료한다.

기준 소스 SHA256: integration-runtime `27331A2FA59209943371D5F0707AFB5C8875D06DF755204101A9D58845227590`; integration-executors `DB7D391166403987F6B80E1EC3902A0B58B90CAE9ACE611A4649053D4F580A84`; process-launch `EA5819B562F55ED4776A48EDDD13CE79F9E3A43EC52841BE0203C2E14F561990`. 다른 maker의 동시 변경이 가능한 역사적 read snapshot이다.
