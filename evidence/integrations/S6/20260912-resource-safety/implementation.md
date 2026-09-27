# S6 Unit 2 — durable resource safety and extension quarantine

작성일: 2026-09-12

## 범위와 결과

Package API는 host가 명시한 절대 root와 manifest SHA-256만 받는 기존 경계를 유지한다. 자동 home/project discovery를 추가하지 않았다. 민감 경로 component의 이름 기반 거부 목록에 `auth`, `authentication`, `transcript`, `raw-transcript` 계열을 추가했다. 이는 내용 기반 secret scanner 증거가 아니다.

새 extension API는 own data exact schema만 받고 getter/proxy/custom prototype을 거부한다. Loader가 생성하고 module-private identity set에 등록한 frozen `ResourceSnapshot`과 id/version/manifest hash가 정확히 일치하는 `declarative-resource` 후보만 frozen reference metadata로 반환한다. Node 실행 또는 hook/MCP/tool/policy/permission/network/entrypoint 요구는 실행·등록하지 않고 `extension_execution_requires_isolation`로 격리한다. 결과에는 status, 안정 reason, 정확히 `os-isolation-boundary`와 `p13-qualified-evidence`, 후보 SHA-256만 있으며 command, callable, module path, 후보 원문을 포함하지 않는다.

실제 임시 SQLite ledger에서 v1 import/run1 pin, v2 import, close/reopen, run1 옛 bytes 복원, run2 v2 pin, remove, 두 번째 reopen, 기존 pin 보존과 run3 빈 pin을 한 테스트로 검증했다. 격리된 임시 home의 harmless hook/MCP/config/auth sentinel tree hash와 package user-file hash는 전후 동일했다. policy/acceptance/capability 이름의 ledger table 구조적 row counter도 전후 동일했다. 실제 사용자 home, 인증 값, 환경 값, raw conversation/transcript는 읽지 않았다.

## 검증과 correction pass

시도 상한은 2회로 고정했다. Pass 1에서 모든 runtime test는 통과했지만 test union 결과의 TypeScript narrowing 두 곳이 `TS2339`로 실패했다. 제품 계약은 바꾸지 않고 status guard 두 줄을 추가했다. Pass 2의 동일 gate 결과는 다음과 같다.

- `npx --no-install vitest run test/integration-resources.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — PASS, 1 file / 7 tests.
- `npx --no-install vitest run test/integration-resource-store.test.ts test/integration-resource-core.test.ts test/integration-knowledge-quality.test.ts test/integration-knowledge.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — PASS, 4 files / 18 tests.
- Unit 1 quality aggregate — macro recall@3 1.0, English 1.0, Korean 1.0, all-query FP queries 9, negative FP queries 2, provenance checks 28.
- `npx --no-install tsc --noEmit -p tsconfig.json` — PASS, exit 0.
- `npm run build` — PASS, exit 0.
- owned paths `git diff --check` — PASS, diagnostics 0. Scoped status contained exactly the three source/test files before this receipt; no product/Core/store/migration/docs/quality file was modified by this unit.

The network-deny spies covered process-scoped `fetch`, HTTP request, HTTPS request, net connect, DNS lookup and DNS resolve; observed calls were 0. This does not prove OS-wide egress absence. Quarantined candidates have no registration callback surface, and the hostile accessor registration counter remained 0.

### Independent-review BLOCKED correction

최초 독립 검토는 제품/adversarial probe가 아니라 세 계측의 제품 경계 연결성이 부족해 BLOCKED였다. 그 판정은 재검토 전까지 그대로 유지한다. 마지막 correction에서 다음을 추가했다.

- Test-owned fake home을 process `HOME`과 `USERPROFILE`에 복원 가능한 stub으로 연결했다. 실제 이전 값은 출력하거나 비교하지 않았다. `fs` builtin의 path-taking read/write operations를 감싸고 ESM builtin binding을 동기화한 상태에서 package loader, durable store import, Core 구성과 quarantine 경로를 실행했다. Fake-home 접근 counter는 0, 전후 sentinel tree hash는 동일했다.
- Authority baseline에 `verification` table을 명시적으로 포함했다. 최초와 두 번의 reopen 뒤 verification row는 0이고 policy/acceptance/capability/verification 구조적 row snapshot은 동일했다. 같은 host admission route의 permission-grant callback은 0이었다.
- Test host admission route는 실제 `registry.register`, `store.importApproved`, `core.importResourcePackage` operations를 각각 감싼다. Quarantined candidate가 이 route에서 반환된 뒤 세 실제 registration counter는 각각 0이었다. Hostile getter counter는 별도로 0이었다.

Correction gate는 `./test/...` equivalent 경로로 Unit 2 7/7, resource/core/Unit 1 18/18, `tsc -p ./tsconfig.json --noEmit`, `npm run --silent build`를 다시 실행했고 모두 exit 0이었다.

## Final source hashes

| File | SHA-256 |
|---|---|
| `daemon/src/resources/packages.ts` | `fe0d66f4aec1f341dcc8b1b5ab4c4509b4d8f79b0bd7b21998c6d4ae6e62f067` |
| `daemon/src/extensions/quarantine.ts` | `b6e8d9bf321172de04a53e0fe9a62602b5bad4792d6624ee11cd05ece73a7872` |
| `daemon/test/integration-resources.test.ts` | `1cd1bc09e39e4ad5c78a654fafb8797bc6e0744c6a45e3aaae7faf418fdb6b58` |

## 한계

정상 파일명 안의 secret 의미 판별, remote source 진위, OS 전체 traffic 차단, privileged DB 변조 방어, 실행형 extension 지원은 증명하지 않는다. 실행형 지원은 명시된 OS isolation boundary와 P13 qualified evidence가 별도로 충족될 때까지 quarantine 상태다. 이 자료는 독립 checker가 source hash, test output, 임시 경로 범위와 counter를 다시 검토할 준비가 된 implementation receipt다.
