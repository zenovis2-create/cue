# S6 잔여 공백 설계 — 두 개의 충돌 없는 구현 단위

작성일 2026-09-12. 이 문서는 제품과 기존 증거를 읽기 전용으로 대조한 설계다. 테스트, 빌드, 외부 호출은 실행하지 않았다. 인증 값, 환경 값, 원시 대화/전사 내용은 읽거나 기록하지 않았다. `node_modules`, `.git`, `dist`, `build`도 조사 대상에서 제외했다.

## 결론

다음 순서는 현재 실패를 정직하게 보존하면서 S6 잔여 범위를 가장 작게 닫는다.

1. **Unit 1 — bilingual retrieval quality gate**: migration 없이 검색기의 precision을 개선하고, 기존 실패 결과를 덮어쓰지 않는 별도 사전 고정 평가로 한국어/영어 검색 품질과 출처/hash 인용을 판정한다.
2. **Unit 2 — resource/extension safety gate**: 패키지 입력 경계를 보강하고 선언형 확장만 통과시키며 실행형 후보는 명시적으로 격리한다. 같은 `integration-resources.test.ts`에서 재시작/다음 run, 권한·정책 불변, 사용자 파일/홈 설정 보존, 외부 요청 0을 한 번에 검증한다.

두 unit의 owned files는 겹치지 않는다. Unit 2는 Unit 1 완료 후 실행해 최종 통합 gate가 개선된 검색기까지 소비하도록 한다.

## 현재 상태와 공백

기준 문구는 `docs/INTEGRATION_SPEC.md:168-176`과 `docs/INTEGRATION_CHECKLIST.md:204-225`다.

| S6 잔여 요구 | 현재 확인된 근거 | 판정과 정확한 공백 |
|---|---|---|
| 출처/hash 기반 한국어+영어 검색 품질 | `lexical.ts`는 manifest/content SHA-256, revision, 선언 source, UTF-8 byte range를 hit에 보존한다. 기존 lexical 통합 테스트는 한국어 복합어와 영어 식별자를 작은 fixture에서 다룬다. | **품질 FAIL 유지.** `20260911-knowledge-holdout/review.md`의 16문서/24질의 작성형 평가는 recall@3 27.78%→100%였지만 전체 질의 오탐률이 8.33%→16.67%로 증가해 `qualityGate=false`다. blind/production 품질 근거도 아니다. |
| 인증/환경/원시 대화 제외 | 패키지 경로는 credentials/secrets/env/environment/conversation/raw-conversation/chat-history 계열을 거부하고, 검색기는 `kind === 'knowledge'`만 색인한다. 자동 디렉터리 탐색은 없고 host가 선택한 패키지만 읽는다. | **부분 근거.** `auth.*`와 transcript 계열 이름은 현재 명시 거부 목록에 없다. 정상처럼 보이는 파일명 안의 비밀을 의미 분석으로 탐지한다고 주장할 수 없다. 따라서 기본 제외는 명시 이름·종류·명시 승인 경계로 한정해 검증해야 한다. |
| 권한 비확대 | hit은 `authority:'reference-only'`, `sourceVerification:'declared-not-remote-verified'`이고 core/UI 증거는 원문을 goal이나 실행 권한에 넣지 않음을 보인다. | 여러 테스트에 흩어진 근거다. 정책 snapshot, 실행 봉투, tool/model 권한이 import/search 전후 동일한지를 S6 단일 gate가 직접 단정하지 않는다. |
| 경로/schema/크기/hash, version pin, next run | `packages.ts`의 strict schema, bounded read, fatal UTF-8, symlink/junction/ADS/traversal 거부와 process-local next-run 테스트가 있다. `store.ts`와 resource-store/core 증거는 SQLite 재열기 뒤 옛 run bytes와 새 active version을 보존한다. | 구현 근거는 강하지만 `integration-resources.test.ts` 자체는 process-local registry만 사용한다. 체크리스트가 요구하는 package restart/next-run 통합 gate로 모이지 않았다. |
| 사용자 파일 및 홈 hook/MCP 자동 주입 금지 | 패키지 loader 공개 API는 register/pin/remove뿐이고 unknown manifest hook, `hook`/`mcp` kind를 거부한다. fixture의 사용자 파일 보존도 확인한다. | 패키지 디렉터리만 비교한다. 격리된 가짜 home의 hook/MCP 설정과 정책/권한 snapshot이 전후 동일한지, 관련 host API가 한 번도 호출되지 않는지는 아직 직접 검증하지 않았다. 실제 사용자 home을 읽으면 안 된다. |
| 선언형 확장과 실행형 격리 | resource kind는 `skill | rule | knowledge`이고 내용은 실행되지 않는다. | `daemon/src/extensions/`가 존재하지 않는다. 실행형 Node 후보의 상태, 보류 사유, 해제 조건(OS 경계와 P13)을 반환하는 제품 계약이 없다. 단순 schema reject는 감사 가능한 quarantine 기록이 아니다. |
| `integration-resources.test.ts` gate | 현재 5개 테스트는 불변 pin, update/remove, 사용자 파일 보존, hash/path/junction/크기/UTF-8/schema/accessor 거부를 검증한다. | 정책 변경 0, 권한 취득 0, 통신 비활성 외부 요청 0, durable restart, 가짜 home의 hook/MCP 무변경, 실행형 후보 quarantine가 한 gate에 없다. |

현재 대조한 핵심 파일 해시는 다음과 같다. 이는 과거 review의 hash가 아니라 2026-09-12 읽기 시점의 현재 바이트다.

| 파일 | SHA-256 |
|---|---|
| `daemon/src/knowledge/lexical.ts` | `B1C26BAFC0A5671564A54DDEB0CE587D5B7F1422AD711FC56EAAC32B871B6E21` |
| `daemon/src/resources/packages.ts` | `E58BB3015FCB134DB84A88B9FA049DD4F7CB2FC2509719509D9531A3C5E3924A` |
| `daemon/src/resources/store.ts` | `1F974E29544A1E9EB1CB6B1DD4CCC6CE6D623CA65EF3C4443427E827C28CAAD1` |
| `daemon/test/integration-resources.test.ts` | `3EDD465FC028BE94C6B66F9597B3412F1F391DA9057EC2B177D717F3EB9BA02D` |
| `daemon/test/integration-knowledge.test.ts` | `A231FC55A086C0DA6DB70437207CEB669AEBF2F4887D5CBD02924F6BBBA2CA31` |

## Unit 1 — migration-free bilingual retrieval quality gate

### Exact owned files

- Modify `daemon/src/knowledge/lexical.ts`.
- Add `daemon/test/integration-knowledge-quality.test.ts`.
- Add `daemon/test/fixtures/s6-knowledge-quality-v2/contract.json`.
- Add `daemon/test/fixtures/s6-knowledge-quality-v2/corpus.json`.
- Add `daemon/test/fixtures/s6-knowledge-quality-v2/queries.json`.

`packages.ts`, `store.ts`, `integration-resources.test.ts`, migrations, app/core/UI 파일은 이 unit의 소유가 아니다. 기존 `20260911-knowledge-holdout` 파일은 실패 보존 증거이므로 절대 수정하지 않는다.

### 입력 계약

- `createKnowledgeIndex`는 지금처럼 host가 이미 승인·고정한 frozen `ResourceSnapshot[]`만 받는다. mutable/proxy/accessor/custom iterator는 getter를 실행하지 않고 거부한다.
- 색인 대상은 `kind:'knowledge'`뿐이다. 각 문서는 원본 UTF-8 byte length와 content SHA-256이 맞아야 하고 package source/revision/manifest hash가 유효해야 한다.
- 검색 query는 문자열 256자, token 32개 이하, limit 1–10의 현재 bound를 유지한다.
- 품질 fixture는 실행 전에 `contract.json`에 baseline, top-k, positive recall 기준, 전체-query false-positive 비증가 기준, bilingual/identifier/hard-negative 구성, 세 입력 파일 hash를 고정한다. 현재 구현 결과를 본 뒤 relevance나 corpus를 고치지 않는다.

### 출력 계약

- hit의 provenance 필드, `reference-only`, `declared-not-remote-verified`, original UTF-8 byte range와 frozen/stable order를 유지한다.
- ranking 변경은 deterministic해야 한다. exact token coverage, phrase/proximity 또는 문서 길이 정규화 중 가장 작은 한 가설만 적용하고, 점수 동률은 기존 package/resource key 순서를 유지한다.
- gate는 최소한 `positive macro recall@3 >= contract threshold`, `all-query false-positive rate <= frozen baseline`, `negative-query false positives <= frozen baseline`, 모든 반환 hit의 source/revision/manifest/content hash 및 byte slice 일치를 함께 요구한다. 어느 하나 실패하면 전체 FAIL이다.
- 기존 작성형 v1 FAIL 결과를 PASS로 재라벨링하지 않는다. v2도 `evaluationComplete`와 `qualityGate`를 별개로 취급한다.

### Hostile/failure cases

- CamelCase/acronym/숫자 식별자, 띄어쓰기 한국어와 붙여쓰기 한국어, BOM/emoji, 같은 토큰을 공유하는 parser/cache 문서, 관련 문서가 여러 개인 질의, 쉬운 negative와 hard negative를 포함한다.
- forged content/hash/byte length, duplicate resource identity, missing provenance, mutable snapshot, proxy/own/inherited accessor는 fail closed다.
- 빈/구두점-only/과다 token/과다 길이 query와 limit 경계를 유지한다.
- 개선 가설이 recall만 올리고 오탐을 늘리거나 특정 언어만 통과하면 변경을 버린다. fixture를 결과에 맞게 수정하는 방식은 허용하지 않는다.

### Done commands

모두 `daemon` 작업 디렉터리에서 실행한다.

```text
npx --no-install vitest run test/integration-knowledge-quality.test.ts test/integration-knowledge.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
```

독립 checker는 fixture 세 파일과 product source의 SHA-256을 먼저 다시 계산하고, test output의 aggregate를 corpus/queries에서 독립 재계산한다. 시도 상한은 사전 고정 baseline 1회와 단일 ranking 가설 1회다. gate가 악화되면 `lexical.ts` 변경을 보존하지 않는다.

### 이 unit으로 확인되는 것 / 남는 것

확인 가능: 승인된 snapshot 내부에서 한국어+영어 검색 품질의 고정 평가 통과 여부, source/hash/byte citation 불변성, reference-only 출력, 검색기 입력의 실행 불가성. 남는 것: 실제 사용자/production 품질, remote source 진위, secret 내용 의미 탐지, package restart, home hook/MCP, 권한·정책·network 0, 실행형 확장 quarantine. 이 남은 항목 중 제품 내부 S6 경계는 Unit 2가 맡는다.

## Unit 2 — durable resource gate and declarative extension quarantine

### Exact owned files

- Modify `daemon/src/resources/packages.ts`.
- Add `daemon/src/extensions/quarantine.ts`.
- Modify `daemon/test/integration-resources.test.ts`.

`lexical.ts`와 Unit 1의 quality test/fixtures는 이 unit의 소유가 아니다. 기존 `store.ts`, migration 019, `ledger.ts`, app/core는 변경하지 않고 실제 경로로 소비한다. 따라서 새 migration도 필요 없다.

### 입력 계약

- Package import는 기존 `{ root: absolute host-selected path, manifestSha256 }`만 받으며 자동 home/project 탐색을 추가하지 않는다.
- manifest v1의 exact schema와 `skill | rule | knowledge` 선언형 kind만 유지한다. sensitive path component 거부 목록을 `auth`, `authentication`, `transcript`, `raw-transcript` 계열까지 명시적으로 확장한다. 이는 이름 기반 기본 제외이며 파일 내용 secret scanner라고 표현하지 않는다.
- `quarantine.ts`는 own-data-only `ExtensionCandidate`를 받는다. 후보는 package identity/version/manifest hash와 mode를 선언한다. `mode:'declarative-resource'`는 이미 loader가 검증한 snapshot identity와 정확히 결합될 때만 reference descriptor를 반환한다. `mode:'node-executable'` 또는 hooks/MCP/tool/policy/permission/network/entrypoint 요구는 실행하지 않고 frozen quarantine result를 반환한다.
- 실행형 quarantine 결과에는 최소 `status:'quarantined'`, 안정된 reason code, `releaseRequires:['os-isolation-boundary','p13-qualified-evidence']`, 후보 digest만 포함한다. 후보 원문, 인증/환경 값, raw conversation은 기록하지 않는다.

### 출력 계약

- 선언형 출력은 immutable metadata/reference뿐이며 callable, module path, command, hook, MCP server, tool permission, model/policy mutation을 포함하지 않는다.
- resource register/update는 future active version만 바꾸고 이미 pinned run을 바꾸지 않는다. SQLite close/reopen 뒤 기존 run은 예전 exact bytes/hash를, restart 후 생성한 새 run은 당시 active version을 본다. remove 뒤 새 run은 빈 pin, 기존 run은 보존된다.
- quarantine는 제품의 명시 상태이지 설치 실패 fallback이 아니다. quarantined candidate는 package/store/core 등록 함수를 호출하지 않는다.
- public package operation과 extension operation 모두 사용자 파일, 격리된 test home, host policy/permission snapshot을 쓰지 않고 외부 요청을 만들지 않는다.

### Hostile/failure cases

- `auth.json`, `authentication.md`, `environment.txt`, `raw-conversation.json`, `chat-history.txt`, `transcript.md`, `raw-transcript.json`이 root 및 nested component에 있을 때 manifest hash가 맞아도 읽기 전에 거부한다. benign filename 속 secret 의미까지 탐지했다고 주장하지 않는다.
- unknown manifest fields (`hooks`, `mcpServers`, `install`, `postinstall`, `entrypoint`, `permissions`, `network`), executable kind/extensions, proxy/accessor/custom prototype, symlink/junction/root alias/ADS/traversal, invalid UTF-8, oversize, hash drift, same-version replacement을 fail closed로 다룬다.
- 가짜 home 안에 canary hook/MCP/config/auth 파일을 만들되 내용은 무해한 sentinel만 쓴다. import/update/remove/quarantine 전후 tree와 byte hash가 같고 home 관련 host callback 호출 수가 0이어야 한다. 실제 home이나 실제 secret은 열지 않는다.
- 통신 비활성 fixture에서 `fetch`, `http/https request`, `net connect`, DNS 경로를 test-owned deny spies로 막고 호출 수 0을 단정한다. 이 검증은 해당 Node process와 import graph에 한정하며 OS 전체 traffic 증거로 확대하지 않는다.
- 실제 `openLedger(tempDb)` + 기존 migration 자동 적용 경로에서 v1 import/pin, v2 import, DB close/reopen, old-run read, new-run pin, remove, second reopen을 순서대로 검증한다. source package 삭제 뒤에도 pinned bytes가 DB에서 복원되어야 한다.
- policy/permission baseline은 안전한 구조적 snapshot이나 호출 counter만 사용한다. 인증 값, 환경 값, raw transcript payload를 읽어 비교하지 않는다. import/search 결과를 verification/acceptance true로 승격하는 API가 없음을 확인한다.

### Done commands

`daemon`에서 다음 순서로 실행한다.

```text
npx --no-install vitest run test/integration-resources.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install vitest run test/integration-resource-store.test.ts test/integration-resource-core.test.ts test/integration-knowledge-quality.test.ts test/integration-knowledge.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
```

checker는 임시 DB와 임시 package/home만 사용했는지, cleanup target이 OS temp 아래 test prefix인지, source/user/home canary hash가 전후 동일한지, request/callback counters가 0인지, old/new run의 version+manifest/content hash가 기대값과 일치하는지 확인한다. 제품 변경 시도 상한은 package sensitive-name 보강 1회와 quarantine 계약 1회다. 기존 path/hash/pin 회귀나 home/network counter 증가가 생기면 해당 변경을 보존하지 않는다.

### 이 unit으로 확인되는 것 / 남는 것

확인 가능: 명시적 package 입력만 허용하는 기본 제외, 파일명 기반 auth/environment/raw conversation/transcript 차단, 권한/정책/verification 비확대, restart와 next-run pin, 사용자 파일 및 격리 home 보존, hook/MCP 자동 주입 0, process-scoped 외부 요청 0, 선언형 reference 허용과 Node 실행형 후보의 감사 가능한 quarantine. 또한 체크리스트 221, 222, 224, 225를 하나의 실제 integration gate로 묶는다.

여전히 미완료: benign 이름 파일 안의 secret 의미 판별, remote repository/source authenticity, OS 전체 egress 차단 증명, 임의 privileged host/DB 변조 방어, 실행형 플러그인 지원. 마지막 항목은 quarantine result의 해제 조건대로 OS 격리 경계와 P13 자격 증거가 별도로 완성될 때까지 의도적으로 보류한다. Unit 1의 새 자료도 독립 blind/production holdout이 아니므로 두 unit 통과만으로 “실제 사용자 검색 품질 완료”라고 표시할 수 없다.

## 체크리스트 반영 조건

- 219는 Unit 1의 새 사전 고정 gate가 PASS이고 독립 산술/hash 검토가 끝난 뒤에도 “bounded authored evaluation” 범위로만 체크한다. 실제 사용자 품질은 별도 미완료 문구를 유지한다.
- 220–222와 225는 Unit 2의 단일 `integration-resources.test.ts` gate, restart proof, canary hashes/counters가 모두 PASS일 때 체크한다.
- 224는 `quarantine.ts` 제품 계약과 hostile executable candidate 검증이 PASS일 때 체크하되 “실행형 플러그인 지원”으로 쓰지 않는다.
- source URL/revision은 여전히 선언 provenance다. remote verification이 없으므로 검색 hit을 검증 증거나 acceptance 판정으로 승격하지 않는다.
