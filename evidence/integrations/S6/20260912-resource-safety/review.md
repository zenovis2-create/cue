# S6 resource safety / extension quarantine — independent review

작성일: 2026-09-12

판정: **BLOCKED**. 제품 구현에서 즉시 악용 가능한 결함은 찾지 못했고 지정된 7개 및 18개 테스트, typecheck, build는 모두 통과했다. 그러나 이 unit이 요구한 단일 gate 증거에는 아래 세 가지가 빠져 있어 `권한/정책/verification 비확대`, `home 자동 탐색·주입 0`, `quarantined candidate 등록 0`을 테스트가 직접 증명한다고 승인할 수 없다.

## Blocking findings

1. **🔴 fake-home 검사가 실제 home 접근 계측과 연결되지 않는다.** `daemon/test/integration-resources.test.ts:114-119`는 임시 `fakeHome`과 sentinel을 만들고 전후 tree hash만 비교한다. 테스트는 `HOME`, `USERPROFILE`, `CODEX_HOME`을 이 경로로 바꾸지 않고, home resolver/파일 접근 callback도 주입하거나 계측하지 않는다. 따라서 코드가 다른 home 경로를 읽거나 쓰더라도 `treeHash(fakeHome)`는 그대로 통과한다. 현재 `packages.ts`와 `quarantine.ts`의 import/API를 정적으로 보면 home discovery는 없지만, 요구된 “home 관련 host callback 호출 수 0”의 실행 증거는 아니다.

2. **🔴 authority counter가 verification을 포함하지 않는다.** `authorityCounters`는 `policy`, `acceptance`, `capability` 이름의 table만 선택한다(`integration-resources.test.ts:43-46`). 실제 ledger에는 `verification` table이 있지만 이 baseline에서 빠진다. `permission` 이름 또는 권한 관련 명시 counter도 없다. 따라서 `integration-resources.test.ts:129`의 equality는 receipt가 주장하는 전체 policy/permission/verification 비확대를 직접 입증하지 않는다.

3. **🔴 `registrationCalls`는 등록 호출 counter가 아니다.** `integration-resources.test.ts:135,151-153`의 변수는 hostile candidate의 `id` getter가 실행됐는지만 센다. package registry, durable resource store, Cue core의 import/register/activate API 호출을 계측하지 않는다. 정적 import graph상 `quarantine.ts`는 `isVerifiedResourceSnapshot`만 import하며 store/core 등록 경로가 없어 현재 구현은 등록하지 않는 것으로 보이지만, 설계가 요구한 quarantined candidate의 package/store/core registration calls `0` 실행 증거와 이름이 일치하지 않는다.

위 항목은 제품 source를 바꿀 필요 없이 테스트의 계측을 실제 경계에 연결하고 정확한 counter를 추가하면 닫을 수 있다. 이 reviewer는 지정된 review 파일 외 제품/test/docs를 수정하지 않았다.

## Confirmed implementation behavior

- `packages.ts:28-34`는 각 경로 component를 읽기 전에 검사한다. `auth`, `authentication`, `transcript`, `raw-transcript`와 기존 credentials/secrets/env/environment/conversation/raw-conversation/chat-history 계열은 대소문자 무관하게 component 시작 + 구분자/끝 조건으로 거부된다. 대상 파일이 존재하지 않는 hostile path도 `resource_path`로 끝나므로 filesystem read보다 validation이 앞선다.
- 독립 compiled-code probe에서 false substring인 `author.md`, `oauth.json`, `transcriptome.txt`, `authentication2.md`, `raw-transcript2.json`, `secretary.txt`, `environmental.md`, `credentialed.txt`가 모두 load됐다. `conversation-piece.md`는 보호 대상 `conversation` + `-` variant라 올바르게 거부됐다. 기존 traversal, ADS, reserved path, symlink/junction, hash, UTF-8, size 회귀도 7-test gate에서 통과했다.
- loader identity는 module-private `WeakSet`에 실제 생성 snapshot만 추가한다(`packages.ts:13-15,109`). plain frozen spread copy는 독립 테스트와 probe 모두 `extension_snapshot_binding`으로 거부됐다. 실제 snapshot과 candidate의 id/version/manifest SHA-256이 모두 일치해야 한다.
- candidate 및 requirements는 proxy, custom prototype, accessor, extra key를 data read 전에 거부한다. hostile getter probe 결과 `getterReads=0`, rejection=true였다.
- declarative 결과는 frozen top-level과 frozen `{id, version, manifestSha256}` reference만 포함하고 callable, command, module path, raw snapshot text를 포함하지 않는다. resource count/byte count도 loader snapshot에서 계산된다.
- executable 또는 requirements-bearing candidate 결과는 frozen `{status, reason, releaseRequires, candidateSha256}`뿐이다. reason은 `extension_execution_requires_isolation`, releaseRequires는 정확히 `['os-isolation-boundary','p13-qualified-evidence']`이고 raw candidate/callable/command/module/authority를 반환하지 않는다.
- target test의 process spies는 `fetch`, `http.request`, `https.request`, `net.connect`, `dns.lookup`, `dns.resolve` calls `0`을 확인했다. 이는 해당 Node process와 이 import graph에 한정된다.
- target durable test는 v1/run1, v2/reopen/run2, remove/reopen/run3-empty와 old/new exact text를 통과한다. 이 target test 자체는 source package를 삭제하지 않는다. 다만 별도 지정 회귀 `integration-resource-store.test.ts:20-26`가 manifest와 guide를 삭제한 뒤 DB를 reopen하여 old/new snapshot bytes 복원을 실제로 통과했고, `integration-resource-core.test.ts`도 package path 재독해 없이 reopen pin을 확인했다.

## Independent commands

- `npx --no-install vitest run test/integration-resources.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — **PASS**, 1 file / 7 tests, exit 0.
- `npx --no-install vitest run test/integration-resource-store.test.ts test/integration-resource-core.test.ts test/integration-knowledge-quality.test.ts test/integration-knowledge.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — **PASS**, 4 files / 18 tests, exit 0.
- Quality aggregate observed: macro recall@3 `1`, English `1`, Korean `1`, all-query FP queries `9`, negative FP queries `2`, provenance checks `28`.
- `npx --no-install tsc --noEmit -p tsconfig.json` — **PASS**, exit 0.
- `npm run build` — **PASS**, exit 0.
- Owned source/test/receipt `git diff --check` — **PASS**, diagnostics 0.
- Adversarial compiled-code probe pass 1 included `conversation-piece.md` as a presumed benign substring and correctly failed `resource_path`; pass 2 used true false-substring cases and passed all, with getter reads 0 and frozen-copy rejection true. No product/test file was changed by either probe.

## Audited hashes

| File | SHA-256 |
|---|---|
| `daemon/src/resources/packages.ts` | `fe0d66f4aec1f341dcc8b1b5ab4c4509b4d8f79b0bd7b21998c6d4ae6e62f067` |
| `daemon/src/extensions/quarantine.ts` | `b6e8d9bf321172de04a53e0fe9a62602b5bad4792d6624ee11cd05ece73a7872` |
| `daemon/test/integration-resources.test.ts` | `151f8f1fa5602c08f2b22955e5d8bd4a3554ce9ef45ccf18e4ff4e1b55f04bf9` |
| `evidence/integrations/S6/20260912-resource-safety/implementation.md` | `21b32db572e6f6faf350ca09492fa1be7de854ebf973ba6271d3616b36e63584` |

## Limits preserved

과거 `S6/20260911-knowledge-holdout` v1의 `qualityGate=false`는 그대로다. 이 review는 정상 파일명 안 secret 의미 탐지, remote source authenticity, 실제 사용자/production 검색 품질, OS 전체 egress 차단, privileged host/DB 변조 방어, 실행형 plugin 지원을 증명하지 않는다. 실행형 후보는 OS isolation boundary와 P13 qualified evidence가 별도로 충족될 때까지 quarantine 상태다.

---

## Final correction re-review

재검토일: 2026-09-12

최종 판정: **PASS**. 위 최초 BLOCKED 기록은 correction 전 상태로 보존한다. 현재 `integration-resources.test.ts` SHA-256 `1cd1bc09e39e4ad5c78a654fafb8797bc6e0744c6a45e3aaae7faf418fdb6b58`에서 세 blocking finding이 모두 닫혔고, 제품 source hash는 최초 검토와 동일하다.

### Corrected evidence

- `HOME`과 `USERPROFILE`은 테스트 소유 fake-home으로 stub된다. `homeAccessProbe`는 `lstatSync`, `realpathSync`, `openSync`, `readFileSync`, `writeFileSync`, `appendFileSync`, `mkdirSync`, `readdirSync`, `rmSync`, `unlinkSync`, `renameSync`, `copyFileSync`의 실제 `node:fs` default export를 감싸고 `syncBuiltinESMExports()`로 제품의 named builtin binding까지 동기화한다. 그 상태에서 package loader 등록, durable store/Core 구성, quarantine admission을 실행하며 fake-home path calls는 정확히 0이다. 복원 후 sentinel tree hash도 동일하다.
- 경로 counter는 resolved fake-home 자체 또는 그 descendant만 센다. 테스트는 실제 HOME/USERPROFILE 경로, auth 파일, 환경 파일 내용을 열거나 출력하지 않는다. source 검색에서도 environment dump, actual HOME 파일 read, env/auth value logging은 없었다. Core가 정상 구성용 `process.env` 변수를 선택적으로 참조하는 기존 코드는 있지만 이 테스트는 그 값을 receipt/output에 기록하지 않는다.
- durable gate의 authority snapshot은 이제 실제 `verification` table을 포함하고 baseline에 `['verification',0]`을 요구한다. 두 reopen 뒤 전체 policy/acceptance/capability/verification row snapshot이 동일하고 verification rows는 다시 0이다.
- quarantine gate는 permission-grant callback baseline/final을 별도로 비교하며 둘 다 0이다.
- test-owned admission route는 실제 `registry.register`, `store.importApproved`, `core.importResourcePackage`를 각각 감싼다. executable candidate가 `assessExtensionCandidate`에서 quarantined로 반환되면 즉시 return하므로 세 actual-operation wrapper counter는 `{package:0,store:0,core:0}`이다. hostile getter counter는 별도로 0이다.
- process-scoped `fetch`, HTTP/HTTPS request, net connect, DNS lookup/resolve는 계속 모두 0이다. quarantine 결과의 exact reason/releaseRequires/digest-only surface, verified loader identity, frozen declarative metadata와 hostile proxy/accessor rejection도 그대로 통과했다.
- target durable test의 old/new/remove/reopen 동작과 별도 resource-store 회귀의 source manifest/guide 삭제 후 exact DB snapshot 복원도 다시 통과했다.

### Final independent gate

첫 재실행은 동시 작업 중이던 unrelated `daemon/src/evaluation/comparisons.ts`의 TypeScript 오류와 아직 생성되지 않은 compiled module 때문에 target/core suite collection 전에 실패했다. S6 assertion 실패는 없었다. 해당 공유 작업공간이 안정되고 build가 성공한 뒤 동일 gate를 새 명령 형태로 재실행했다.

- `npm run --silent build` — **PASS**, exit 0.
- `npx --no-install vitest run ./test/integration-resources.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — **PASS**, 1 file / 7 tests, exit 0.
- `npx --no-install vitest run ./test/integration-resource-store.test.ts ./test/integration-resource-core.test.ts ./test/integration-knowledge-quality.test.ts ./test/integration-knowledge.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — **PASS**, 4 files / 18 tests, exit 0.
- `npx --no-install tsc -p ./tsconfig.json --noEmit` — **PASS**, exit 0.
- Final quality aggregate: macro recall@3 `1`, English `1`, Korean `1`, all-query FP queries `9`, negative FP queries `2`, provenance checks `28`.
- Final scoped `git diff --check` — **PASS**, diagnostics 0.

### Final audited hashes

| File | SHA-256 |
|---|---|
| `daemon/src/resources/packages.ts` | `fe0d66f4aec1f341dcc8b1b5ab4c4509b4d8f79b0bd7b21998c6d4ae6e62f067` |
| `daemon/src/extensions/quarantine.ts` | `b6e8d9bf321172de04a53e0fe9a62602b5bad4792d6624ee11cd05ece73a7872` |
| `daemon/test/integration-resources.test.ts` | `1cd1bc09e39e4ad5c78a654fafb8797bc6e0744c6a45e3aaae7faf418fdb6b58` |
| `evidence/integrations/S6/20260912-resource-safety/implementation.md` | `091d20f8c0d2d7edb4fa03755164766cdd746a7029cb6f9d8a2d8848c4c634e7` |

최종 PASS의 범위는 이름/schema/hash/path로 제한된 선언형 resource와 process-scoped quarantine gate다. 과거 v1 quality FAIL과 위 limits는 변경되지 않으며, OS-level egress 차단 및 실행형 plugin 지원은 여전히 증명되지 않았다.
