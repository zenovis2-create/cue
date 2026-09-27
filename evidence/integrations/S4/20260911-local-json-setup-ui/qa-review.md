# 로컬 JSON 설정 UI — 독립 실제 Electron QA

판정: **설정·재시작 경계 범위 PASS**. 제품 작성자와 별도 검토자가 실제 화면을 검토했다. 제품 수정 없음. 일반 legacy core를 사용했으며 합성 자격/evidence/control-bundle도 만들지 않았다.

완료 기준: 실제 core 사전검증 후 shipped renderer/preload/IPC/core/SQLite에서 읽기·명시적 저장·정책 개수·재시작 준비 차단·CAS 충돌 최신값·재개방을 확인한다. 최대2회, **첫 preflight 및 첫 Electron 실행 PASS**. main.mjs는 이 proof에서 가져오거나 실행하지 않으므로 해시에 포함하지 않았다.

## 독립 실행

- `node scripts/reuse/local-json-setup-electron-proof.mjs`: **PASS**,exit0(tool4beff8). main-process core 사전검증과 실제 숨김 Electron UI를 실행했다.
- `cd daemon; npx vitest run test/integration-local-json-setup-ui.test.ts test/integration-local-json-setup-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **5 PASS**,1.86s(tool63f5d5). 악성 DTO/권한 필드/프레임, 늦은 준비, CAS, 저장/재개방 회귀 포함.

## 관측

처음 metadata는 configured=false,revision=null,limits=null,available=false,restartRequired=false이고 설정/정책 row는 각각0이다. 화면의 제안 기본값은 **2 / 60000 / 65536 / 2048**이며 enable 체크는 꺼져 있다. 이 값의 화면 표시 자체는 DB 저장이 아니다.

실제 일반 목표를 준비해 승인 대기 상태를 만든 뒤 enable을 체크하고 저장 버튼을 눌렀다. `window.cue.localJsonSetup`→`cue:local-json-setup`→실제 core configure로 설정 revision1 하나와 모드 정책4개를 저장했다. limits는 제안 기본값과 일치하고 restartRequired=true,available=false를 유지했다.

UI의 준비/모드/승인 버튼은 비활성, what/envelope는 비움, resource pin은 먼저 준비하라는 상태로 초기화됐다. renderer의 비활성 버튼을 우회해 직접 실제 IPC prepare를 호출해도 core가 `local_json_restart_required`로 거부했다.

충돌 시험에서는 다른 보호된 main 호출이 revision1→2(비활성,maxInvocations3)를 저장했다. UI는 아직 revision1을 제출해 CAS 거부를 받았고 자동 read로 revision2를 다시 표시했다. 체크는 꺼지고 한도3으로 갱신되며 “저장하지 못했습니다. 최신 설정을 확인…” 상태를 표시했다. 이후 UI가 최신 revision2로 저장해 revision3이 됐다. 최종 설정3개/정책12개는 이 세 성공 저장의 역사적 row다. 충돌 실패는 별도 row를 만들지 않는다.

최종 capability_evidence/session_handle/orchestration_attempt/local_invocation_budget 모두0. 임의 modelId를 덧붙인 setup IPC도 거부됐다. 승인·실행을 누르지 않았고 provider/server/native executor/모델 요청은 없다.

실제 core를 닫고 같은 config/SQLite로 재개방해 revision3,enabled=false,변경 한도3과 나머지값이 일치함을 확인했다. 프로세스 내 restartRequired 플래그는 false로 초기화되지만 **available=false,ranking=not-performed**다. 저장과 재시작은 자격 검증이나 가용성 부여가 아니다. 재개방 확인은 main/core에서 했으며 새 renderer의 재로드 화면을 추가로 검증한 것은 아니다.

## 실제 화면

`setup-saved.png`와 `setup-conflict.png`를 직접 열었다. 전체 설정 패널, 고정 모델/endpoint, 네 모드의 동일 조합·순위평가 없음·설정≠자격 안내, 입력값, 저장 버튼, 재시작 및 충돌 상태가 읽힌다. 기존 준비와 승인이 비활성인 것도 보인다. 기본 내부1167px에서 가로 넘침 없음. warm capture 후 최종 PNG를 기록했다.

외관상 기존 공용 input 스타일 때문에 enable checkbox가 중앙에 놓이고 그 label과 다음 “최대 호출 수” label이 가까이 이어진다. 기능 판정을 막지는 않지만 향후 정돈할 수 있는 시각적 여지다. 실제 상태·값을 감추지 않는다. 좁은 화면·스크린리더·키보드 전체 접근성 감사를 수행하지 않았다.

`preflight.json`, `electron-result.json`에 읽기/저장/충돌/재개방 metadata, row 수, DOM, 제품 소스·PNG hash가 있다. 작업자는 QA script와 증거만 작성했고 사용자 작업 디렉터리가 아닌 검증용 임시 DB만 수정한 뒤 정리했다. 일반 앱 부팅/main 구현 및 실제 재시작 후 모델 자격 검증은 별도 범위다.
