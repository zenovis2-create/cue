# S1 남은 항목 판정과 외부 호출 없는 다음 구현 단위

감사 시각: 2026-09-12 KST. 범위는 체크리스트 48, 51, 52, 69, 78과 직접 연결된 spec/backlog, R-01~R-03, S1/S4 증거, 현재 source/test다. 제품 소스·문서·체크리스트와 기존 증거는 수정하지 않았다. 저장소 루트의 물리 `AGENTS.md`는 감사 시점에 존재하지 않았으며, 작업에 전달된 root AGENTS 지시를 적용했다.

이 기록의 판정은 체크 문구나 maker의 PASS만으로 내리지 않았다. 현재 파일을 읽고, 외부 모델·native launcher·Electron 없이 아래 검사를 실행했다.

```text
cwd daemon
npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 18 PASS / exit 0

npx --no-install vitest run test/integration-executors.test.ts test/host-codex-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2 files / 8 PASS / exit 0

npx --no-install vitest run test/claude-jsonl-fixture.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 7 PASS / exit 0

cwd repository root
node --test scripts/reuse/claude-launch-spec.test.mjs
9 PASS / exit 0
```

`npx --no-install tsc -p tsconfig.json --noEmit`는 exit 1이다. 현재 병행 변경 중인 `orchestration/store.ts`와 `integration-handoff-activity.test.ts`가 새 `TerminalHandoffInput.receiptRevision`을 제공하지 않는 6개 오류이며, S1 runtime/adapter 실패로 귀속할 근거는 없다. 그러나 전체 type gate가 현재 green이라는 주장도 할 수 없다. 다음 단위는 이 소유자가 오류를 정리한 뒤 같은 명령을 다시 통과해야 한다.

## 열린 체크박스 판정

| 줄 | 현재 세부 상태 | 판정 | 체크 유지 이유 |
|---|---|---|---|
| 48 R-01~R-03 정상/실패/취소/재시작과 부품 선택 | R-01 직접 `fetch` transport는 fixture와 실제 Qwen SSE에 사용됐고, R-03 격리 broker도 실제 Qwen 왕복을 남겼다. R-02 Codex는 기존 backend wrapper의 fixture 회귀만 있고 Claude는 실행 불가 launch spec과 test fixture만 남았다. 세 결정문은 모두 최종 adopt/limited가 아니라 defer다. 원격 provider 종료, 재시작 대조, SDK 대비 유지비 선택도 닫히지 않았다. | **partially proven + external-blocked** | 정상 transport 일부만 실물이다. 세 R-ID 전체의 실패/취소/재시작과 채택 판정은 없다. |
| 51 기존 Codex 동작의 공통 어댑터 보존 | `createCodexExecutor`가 `launchHostCodexRun`, owner/envelope, raw result, stop-once, goal verification을 보존하도록 구현돼 있다. 현재 offline focused 8 PASS다. 다만 기존 독립 review의 adapter hash `DB7D...`와 현재 hash `7A1A...`가 다르고, host controller/runtime에도 아직 독립 검토되지 않은 이벤트 delta가 있다. 최신 S0 실제 manifest gate는 pinned Codex binary hash mismatch로 실패했다. | **implemented, partially proven, external-blocked for completion** | injected backend/stream fixture는 현재 설치 Codex app-server의 같은 wire behavior, auth, P13, 실제 stop/cleanup을 증명하지 않는다. |
| 52 두 번째 에이전트와 로컬 모델 전용 경로 실물 검증 | 로컬 경로는 실제 `qwen38-27b-unc` 연결, GGUF/executable identity, 격리 broker 왕복, native cleanup, 과거 fresh Electron의 live M1~M3 발행까지 관측됐다. 그러나 해당 workflow는 producer cleanup 미확인으로 실패했고 이후 실행 자산 hash가 변했다. 두 번째 에이전트인 Claude는 version 관측과 합성 fixture뿐이며 production parser/executor/auth가 없다. | **local route previously partially proven; second agent external-blocked; line overall external-blocked** | conjunction 전체를 만족하지 못한다. 과거 M rows는 현재 subject에 재사용할 수 없고, Claude는 실제 실행 경로가 없다. |
| 69 원격 취소 요청/실제 종료와 하위 작업 ID/소유권 구분 | transient runtime은 cancel requested/adapter acknowledged와 host cleanup receipt를 분리하고, local result는 `providerStopped:'unknown'`을 보존한다. attempt/task, native PID/FileTime 및 Codex tool `callRef`도 각각 존재한다. 그러나 provider terminal/과금 종료/remote subtask lineage를 append-only 원장으로 보존하는 계약이 없다. Codex activity의 adapter ordinal은 현재 0이고 provider thread/turn과 하위 call의 소유권 projection도 없다. | **partially implemented; external-blocked for actual remote death** | client abort나 로컬 tree death가 remote compute/billing 종료로 승격되지 않는 것은 맞지만, 그 서로 다른 사실을 재시작 뒤 대조할 내구 모델과 실물 provider receipt가 없다. |
| 78 `integration-runtime-contract.test.ts` 및 필요한 P13/M gate | test 파일은 존재하며 현재 18 PASS다. runtime은 synthetic live evidence로 admission/role/cancel/cleanup을 fail closed한다. 과거 actual M issuance는 존재했지만 현재 source hashes가 당시 증거와 다르고, P13 Codex 최신 baseline은 binary pin mismatch다. 현재 revision의 Codex P-vector와 model/checker M-vector 발행·admission 재확인은 없다. | **contract test proven; P13/M external-blocked; line overall open** | 합성 admission PASS와 오래된 actual rows는 현재 실행 자격이 아니다. |

### 증거 해석의 경계

- `20260911-model-broker`는 실제 Qwen `OK`, usage 22/37/59와 당시 native 정리를 뒷받침하지만 `providerStopped`, qualification, cleanup receipt는 unknown이었다.
- `S4/20260911-fresh-electron-gate/live-review.md`는 실제 M1~M3 rows와 Qwen 결과를 검증했으나 최종 verdict가 **FAIL**이다. producer attempt가 running, cleanup unverified, checker/acceptance 0이었다. 그 gate가 허용한 두 inference request는 모두 소진됐다.
- `20260911-native-identity-commit/actual-attempt1`은 provider/model 호출 없이 두 native executor identity와 정리를 증명한 별도 PASS다. 그 증거는 명시적으로 추가 실행을 허용하지 않는다.
- `20260911-model-boundary`의 실패·교정 기록은 보존한다. SID/module-free 교정과 focused M1/M2/M3 관측은 과거 source-bound 진단이며 current qualification 발행이 아니다.
- 현재 model launch/qualification/subject/test SHA가 당시 consolidated/collector review SHA와 다르다. P13 원칙상 지문 변경 뒤 과거 PASS는 미측정이다.

## 겹치지 않는 다음 최소 구현 단위

아래 1과 2는 서로 병렬 가능하고 3은 둘 이후다. 각 단위는 제품 변경 correction hypothesis를 최대 **2회**만 허용한다. 매 pass에서 지정된 hostile test와 typecheck를 실행한다. 측정 gate가 나빠지면 그 hypothesis 변경을 되돌리고 새 원인을 제시한다. 두 번 뒤에도 실패하면 실물 실행으로 우회하지 말고 blocker와 raw 결과를 인계한다.

### 단위 1 — Codex 공통 어댑터 보존 계약과 정규화된 하위 호출 이벤트

목표: 실제 Codex를 호출하지 않고 현재 event delta를 기존 controller/runtime semantics에 고정한다. 공통 wrapper가 기존 launch 인자, clean Codex home, owner/envelope, `cue_workspace` runner, goal verification, stop-once, ordered teardown을 바꾸지 않는지 golden fixture로 비교한다. provider thread/turn과 dynamic tool call ID는 불투명 reference로 내보내되, tool call은 별도 프로세스나 완료된 Cue task라고 주장하지 않는다. adapter cancel resolve는 `client-cancel-acknowledged`일 뿐 provider terminal/cleanup이 아니다.

정확한 파일 ownership:

- `daemon/src/host-codex-controller.ts`
- `daemon/src/host-codex-runtime.ts`
- `daemon/src/adapters/integration-executors.ts`
- `daemon/test/host-codex-controller.test.ts`
- `daemon/test/integration-executors.test.ts`
- 새 `daemon/test/integration-codex-adapter-preservation.test.ts`

시작 전 위 파일은 현재 병행 event 작업 소유자에게서 stable handoff를 받고 hash를 다시 기록한다. 다른 단위는 이 파일을 수정하지 않는다.

Hostile tests:

- duplicate/foreign/late `item/completed`와 `turn/completed`, malformed or oversized opaque IDs가 output/terminal을 위조하지 못한다.
- 같은 tool call ID 재사용, terminal 뒤 tool call, concurrent tool call, sink throw가 성공을 만들지 못한다.
- pre-abort, abort-during-launch, repeated cancel, backend `stop()` throw, completed-with-failed-goal-verification가 모두 false success 0과 stop 최대 1을 유지한다.
- wrapper의 binary/model/owner/envelope/home/options snapshot이 caller mutation, getter, proxy로 바뀌지 않는다.
- event에 stderr, prompt, auth, absolute private path가 포함되지 않는다.

Done commands:

```text
cwd daemon
npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p10c-host-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

이 단위는 line 51의 구현 회귀 근거와 line 69의 event 입력을 강화한다. 실제 Codex 보존/P13 완료 판정은 하지 않는다.

### 단위 2 — provider 실행과 하위 작업 소유권의 append-only 원장

목표: cancel request, client acknowledgement, provider terminal, 로컬 controller/tree 관측, cleanup, billing finality를 서로 다른 이벤트로 저장한다. `provider terminal=unknown`과 `billing=unknown`은 cleanup clean 뒤에도 그대로 남는다. provider thread/turn/subtask reference는 attempt/task/candidate와 결합한 bounded opaque digest로 저장하고, 다른 attempt가 같은 소유권을 주장하면 거부한다. projection은 누락·충돌·순서 역전에서 보수적으로 unknown을 반환한다.

정확한 파일 ownership:

- 새 `daemon/src/orchestration/provider-lifecycle.ts`
- 새 `daemon/test/integration-provider-lifecycle.test.ts`
- `daemon/src/ledger.ts`
- 새 migration: 감사 시점 최고 번호는 source/dist 모두 `031_orchestration_handoff_activity.sql`이므로 예상 이름은 `daemon/migrations/032_provider_execution_lifecycle.sql`

**migration 번호는 구현 시작 직전에** `daemon/migrations`, `daemon/dist/migrations`, `daemon/src/ledger.ts`의 최고 번호를 다시 확인한다. 031보다 큰 migration이 생겼으면 032를 사용하지 말고 정확히 `max + 1`로 바꾼다. compiled migration은 수동 편집하지 않고 정상 build/copy 산출물로 만든다.

최소 schema는 append-only event와 subtask binding 두 종류다. event는 `run_id/task_id/attempt_id/event_id/ordinal/kind/observed_at/payload/payload_sha256`을, binding은 parent attempt와 provider thread/turn/subtask digest, kind, 최초 관측 event를 고정한다. UPDATE/DELETE/REPLACE/IGNORE, ordinal gap/duplicate, 다른 lineage의 replay, terminal 상충을 거부한다. 이 store는 process kill, billing release, acceptance 권한을 갖지 않는다.

Hostile tests:

- cancel-requested 뒤 client ack만 있어도 provider terminal/death/billing이 unknown이다.
- provider cancelled terminal만 있어도 local PID tree cleanup은 unmeasured다.
- clean local tree만 있어도 provider terminal/billing은 unknown이다.
- duplicate event ID, same ordinal/different bytes, gap, late event after sealed projection, cross-attempt subtask theft를 거부한다.
- proxy/accessor/custom prototype/extra key/oversize payload/hash drift/SQLite reopen과 migration replay를 검사한다.
- 기존 orchestration attempt가 없거나 run/task가 다르면 한 행도 쓰지 않는다.

Done commands:

```text
cwd daemon
npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/p5.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
npm run build
```

이 단위는 line 69의 내구 계약을 구현하지만 실제 원격 종료를 증명하지 않는다.

### 단위 3 — runtime/driver에 lifecycle 원장 연결

목표: transient runtime이 요청한 cancel과 adapter acknowledgement를 직접 기록하고, adapter가 명시적으로 내보낸 provider terminal/subtask event만 단위 2 store에 넘긴다. `verifyCleanup` receipt는 local ownership observation으로만 기록한다. `AdapterExecution.completion` 또는 `succeeded`만으로 provider terminal, cleanup, billing, acceptance를 합성하지 않는다. 재시작 시 store projection을 읽되 미완료 요청을 재송신하지 않는다.

정확한 파일 ownership:

- `daemon/src/integration-runtime.ts`
- `daemon/test/integration-runtime-contract.test.ts`
- `app/orchestration-driver.mjs`
- `app/orchestration-driver.d.mts`
- `daemon/test/integration-driver.test.ts`

단위 1/2 파일은 이 단위에서 수정하지 않는다. adapter event shape가 추가 보정이 필요하면 단위 1 소유자에게 새 revision으로 돌려보내고, 두 단위가 같은 파일을 동시에 잡지 않는다.

Hostile tests:

- cancel promise resolve 후 provider terminal 없음, provider terminal 후 cleanup 없음, cleanup clean 후 billing 없음의 세 projection을 각각 분리한다.
- cancellation/terminal/cleanup callback throw 또는 timeout은 성공/settled/budget release를 만들지 않는다.
- late event, duplicate replay, stale attempt, wrong task/run/candidate, terminal attempt에 대한 write가 current projection을 바꾸지 못한다.
- driver reopen은 상태를 읽기만 하고 launch/HTTP/native/Electron 호출 수 0을 유지한다.
- runtime의 현재 admission, pending launch, late resolution, receipt run/subject binding 18개 회귀를 보존한다.

Done commands:

```text
cwd daemon
npx --no-install vitest run test/integration-runtime-contract.test.ts test/integration-driver.test.ts test/integration-provider-lifecycle.test.ts test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
npm run build
```

이 단위가 끝나도 line 69의 “실제 원격 종료”와 line 78의 actual P13/M은 외부 gate로 남는다.

## 외부/실물 없이는 닫을 수 없는 증거

기존 actual/Qwen/model/native/Electron 시도를 재실행하지 않는다. 특히 fresh Electron gate의 두 Qwen request, 과거 generated canary cap, native identity actual proof, model-boundary correction attempts는 소진/종결 기록 그대로 보존한다. 아래는 새로운 승인과 별도 evidence unit이 생길 때만 수행할 completion gate이며, 위 세 offline 단위의 done command가 아니다.

### 기존 Codex 실제 보존과 P13

- 현재 설치의 canonical absolute `codex.exe`, 실제 SHA-256, version, package/source identity, app-server schema/help flags, updater 상태를 새 observation으로 고정한다. 현재 default pin `cf6826...`과 실제 파일이 불일치한 최신 baseline을 먼저 해결해야 한다.
- 승인된 Codex auth reference와 canonical model ID가 필요하다. secret 값은 원장/argv/renderer/evidence에 넣지 않는다.
- 같은 frozen generation에서 실제 app-server start/turn/dynamic `cue_workspace`/normal/failure/cancel/restart를 관측하고 provider thread/turn/call refs, local controller/worker PID+FileTime, credential-home cleanup을 결합한다.
- 현재 subject로 P1~P5/B1~B5와 해당 역할의 M 요구를 다시 측정한다. 실제 PASS를 요구하는 것이 아니라 PASS/FAIL을 그대로 발행하고 admission 결과를 따른다.

### 두 번째 실제 에이전트

- 제품과 계정 소유자가 허용한 Claude 연결 방식이 먼저 필요하다. claude.ai 구독 인증 복사를 가정하지 말고, 허용된 API credential reference 또는 명시적으로 승인된 공식 연결 계약을 기록한다.
- canonical binary/real target path, SHA-256, package/tarball, `--version`, 실제 `--help`의 tools/MCP/customization/auto-resume 제한 옵션, clean home/env, 자동 업데이트/시작 부작용을 고정한다.
- 실제 account/model list 또는 provider가 반환한 canonical model ID, 실제 stream-json capture와 schema/version, request/thread/session IDs가 필요하다. 현재 synthetic `cue-claude-fixture-v1`은 이 증거가 아니다.
- normal/error/EOF/timeout/cancel/hard-kill/restart에서 local tree death, hidden child 0, unapproved path/credential access 0, provider terminal과 billing/usage finality를 각각 관측한다. 도구 사용 에이전트로 활성화하려면 별도 P13 writer gate도 필요하다.

### 현재 로컬 모델 M gate

- 새 실행이 승인된다면 현재 frozen installation에서 llama-server endpoint `127.0.0.1:8085/v1`, PID/FileTime, executable와 loaded dependencies, GGUF SHA-256/license, exact model-list ID, cloud fallback 부재를 다시 고정한다.
- fresh compiled Electron process가 current model/checker subjects를 측정하고 M1/M2/M3 rows를 발행한 뒤, 같은 subject로 admission과 한정 workflow를 수행해야 한다. 이전 rows를 redate/reuse하지 않는다.
- client cancel, server request terminal, llama-server process/compute 종료는 별개다. 서버를 Cue가 소유하지 않으면 실제 death를 주장하지 않고 `providerStopped:unknown`을 유지한다. 새 계정/endpoint/실행 allowance가 없으면 line 52/78은 blocked로 남는다.

## 현재 검토 파일 해시

| 파일 | SHA-256 |
|---|---|
| `daemon/src/integration-runtime.ts` | `BA5F0F3F01BD3E124C2327ACB4E106865EB4242603A743A71DBA6B9FDD4FEC29` |
| `daemon/test/integration-runtime-contract.test.ts` | `F44E9D1EA82E4343C1C3414E877953E9076315DC371C6A4F0C8B80E5D473D646` |
| `daemon/src/adapters/integration-executors.ts` | `7A1A2817B7498F34143E3AB1C471F11BCD355EBDC4C4173889ABF326E8096FFD` |
| `daemon/test/integration-executors.test.ts` | `869479EAD7B56310341EDD3C6BE23B23F883B150208541AC5C54D3AE5179AD52` |
| `daemon/src/host-codex-controller.ts` | `68E4CD2F6DA5FB0F119587650AE277D6CB6E744257F81F05C0B504F69B2963D8` |
| `daemon/test/host-codex-controller.test.ts` | `0C0F2445EAF9044ACE83723050550BEE8361F8FE2ED629191FAB013732622A3A` |
| `daemon/test/fixtures/claude-jsonl-fixture.ts` | `9239ABFD92B69D6C09DDC2A6635F485817B8EDB743132FCE9B667C8B8CFEEDF4` |
| `daemon/test/claude-jsonl-fixture.test.ts` | `BB42A158DBCE0BB67B684F58B1CE6AE6A7B8F58E8F3E0F27140C739F8DBDB91D` |
| `scripts/reuse/claude-launch-spec.mjs` | `57A07D016BE906F01CF2AE1D188A936CB36A036D385DF9D0EC67E86F66B4FD17` |
| `scripts/reuse/claude-launch-spec.test.mjs` | `3DB03F2F1AF964BF7BB886ECF5009FFB3F189638EC31DA9BB8CF1C6AC6E1CECB` |

최종 체크박스 판정은 48 **open/partial+external**, 51 **open/implemented+partial+external**, 52 **open/external**, 69 **open/partial+external**, 78 **open/contract-test-pass+actual-gates-external**이다.
