# Host control bundle pins — bounded maker evidence

완료 기준: 승인된 immutable bundle을 두 production executor에서 요구하고, native staged 파일 검증 및 성공 metadata 일치를 강제. changed client/core/guardian 각각 실제 child 생성/resume 전 거부, 정상/취소/강제종료 및 독립 cleanup 회귀. 원인별 교정 상한2. 현재 구현 첫 gate 통과 후 부모의 metadata 성공조건 요구를 추가하고 해당 gate 통과. 독립 review 전 maker 결과다.

## API와 신뢰 경계
- `measureModelControlBundle({controlRoot,nodeExecutable,clientKind})`는 host 승인 시점의 파일 집합 측정이다. 자격/권한을 만들지 않는다. 운영 중 drift를 승인값으로 재측정해서 덮어쓰지 않는다.
- `snapshotModelControlBundle(bundle,kind,nodeSha256)`는 exact own data schema, digest, kind/runtime 핀을 검증하고 freeze한다. proxy/accessor/unknown fields 거부.
- 두 isolated executor의 host.controlBundle은 필수다. native production 호출도 pin 누락을 거부한다. ProbeHarness만 명시적 diagnostic-unpinned이며 production bundle과 혼합할 수 없다.
- subject 기존 필드와 measureArtifactSet을 재사용할 수 있다. 새 bundle 자체는 capability probe 성공이나 publication이 아니다.
- 설치된 launcher/adapter/control root를 에이전트가 수정할 수 없다는 신뢰 전제가 필요하다. 작업 디렉터리에서 self-hash를 검사하는 것만으로 안전한 설치를 증명하지 않는다. 본 유닛은 OS installer/전체 grant 검증을 구현하지 않는다.

## 실제 검증 경로
bundle은 node/launcher/guardian/client/core(null for model)/clientKind를 고정 필드 순서 JSON 배열 SHA256에 결합한다. metadata argv에는 ID/해시/상한만 있고 원래 plaintext는 bounded stdin이다.

native는 guardian을 시작하기 전에 기대 해시를 검사하고, Start-Process 직전 FileShare.Read 잠금을 획득한 상태에서 재검사한다. guardian ready까지 잠금을 유지한 뒤 해제하여 쓰기/삭제/교체 race를 막는다. guardian은 기존과 동일하게 root/profile/child보다 먼저 준비한다.

node/client/core 복사본은 source에서 새로 측정한 기대값이 아니라 승인 pin과 직접 비교한다. suspended sealing callback에서 복사본을 다시 검사한 뒤 resume한다. native boundary 보고서에 pinned 상태와 bundle/client/core/guardian 값 및 고정 symlink flag를 남긴다. 두 adapter는 이 모든 보고값이 frozen bundle과 일치해야 성공할 수 있다.

변경 client/core/guardian 테스트는 전용 temporary control root 복사본을 승인 측정한 뒤 해당 파일만 변경한다. 각 오류 식별자와 실제 CUE_MODEL_PID/OBSERVATION/FRAME 부재를 확인한다. client/core 실패의 전용 taskRoot 정리도 확인한다. 공유/설치 파일 변조나 전체 ACL 변경은 수행하지 않는다.

## 검증
- `npm run build` exit0.
- `npx vitest run test/integration-model-control-bundle.test.ts test/integration-isolated-json-checker.test.ts test/integration-isolated-local-model.test.ts test/integration-model-boundary-hardkill.test.ts test/integration-model-boundary-observation.test.ts test/integration-isolated-model-cleanup.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
- 6 files, **20 PASS**,38.48s. Actual compiled checker, injected local transport inside real isolated broker, normal/cancel independent cleanup, native identity, hardkill guardian included.
- bundle metadata 각 필드의 누락/변경 및 accessor 미호출 검증.
- no Qwen/provider call, no qualification/acceptance publication. 예전 실제 Qwen 측정은 예전 소스 한정 역사적 기록으로 유지.

변경파일 해시는 source-hashes.json 참조. 최종 native qualification/process-limit/P45 회귀 결과는 별도 추가한다.

최종 추가 회귀: npx vitest run test/integration-model-boundary-qualification.test.ts test/integration-model-boundary-process-limit.test.ts test/p45.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 : 3 files,8 PASS/1 SKIP,41.50s. 기존 native 진단 결과를 수정하거나 자격으로 자동 승격하지 않음. 현재 총28 PASS/1 SKIP,build0.
