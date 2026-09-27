# 명시적 JSON 템플릿 — 독립 실제 Electron QA

판정: **시험용 host의 준비/UI 경로 PASS**. 제품 메이커와 별도 검토자가 확인했다. 제품 수정 없음. 실제 모델·native executor 호출·legacy launch·session 모두0.

완료 기준: 최신 `integration-json-template-core.test.ts`의 실제 host 구성 계약을 먼저 확인하고, 실제 core의 입력/모드/저장대상 preflight를 통과한 뒤 shipped preload/IPC/renderer로 준비한다. 공개 승인에 원문을 넣지 않으며 일반 모드의 우회·템플릿 전환의 낡은 승인·늦은 응답을 차단한다. 최대2회. 첫 proof PASS, 두 번째는 선택기까지 포함하는 화면 증거를 보강했으며 역시 PASS. 제품 소스8개 해시는 두 실행 사이 동일했다.

## 실행과 경로

- `npx vitest run test/integration-json-template-ui.test.ts test/integration-json-template-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 독립 **8 PASS**,2.22s(tool80e9e3).
- `node scripts/reuse/json-template-electron-proof.mjs`: real-core preflight + actual Electron **PASS**(toolff93c2).
- `node scripts/reuse/json-template-electron-proof.mjs --selector-capture`: 같은 조건과 선택기/승인 PNG **PASS**(tool8936d7). 첫 실행 결과·승인 PNG는 `*-attempt1`로 보존.
- 중간 PowerShell 편집 명령의 인용부 파싱 오류는 소스 편집/실행 없이 거부됐고 apply_patch로 처리했다. 제품 및 proof 실행 실패로 분류하지 않는다.

`createGeneratedJsonHost`를 최신 core 테스트와 같은 보호된 합성 subject/evidence/control-bundle로 구성했다. 이 합성 정보는 **실제 모델 자격이나 측정 결과가 아니다**. executor factory와 legacy launch는 호출 시 실패하며 호출횟수가0인지 확인했다. 원장은 실제 AppDaemon SQLite다. 실제 window.cue는 shipped preload가 제공하고 `cue:prepare-json`이 registerIpcHandlers와 core.prepareJsonTemplate/driver/generated-output-store를 통과했다. renderer API를 가짜 window.cue로 덮어쓰지 않았다.

## 검증 결과

- 기본 선택은 `general`. requiresExplicitTemplate host의 일반 목표 submit은 `json_template_required`로 거부되며 JSON 준비로 자동 전환하지 않는다.
- 명시적 JSON+value 선택은 정확한 templateId/inputText/autonomy3/selectionMode value를 보낸다. 실제 host에 전달된 run.template이 frozen이고 mode가 일치한다.
- 입력은 합성 한글·emoji·`</textarea><img …>`를 포함한 **71 UTF-8 바이트**. 실제 generated_output_target `formatted-json`의 inputSha256과 inputByteLength가 정확하고 store.readInput 바이트가 원문과 일치한다. 해시: `cc3d847c6e29aac83e6cbf933994ead58d50babf27f75db1b332886e6c6ab878`.
- 공개 준비 DTO에는 원문 privateMarker가 없음을 preflight로 확인했다. 실제 승인 plan/envelope/extent에도 privateMarker/한글원문이 없다. 계약에는 대상·생성/검사 단계·입력크기·입력 SHA·검사 지문과 출력한도를 표시한다. 사용자 자신의 입력 textarea에는 원문이 남으며 이는 공개 승인 DTO의 원문 유출과 구분한다.
- 원문의 HTML처럼 보이는 문자열은 입력 문자로 남고 img DOM0. renderer process undefined. 승인 문구는 금전비용미측정과 고정조합/모드별성능차이미검증을 유지한다.
- JSON→일반 전환으로 approve 비활성, 승인plan 숨김, envelope/what 비움, JSON input 비활성.
- 실제 core가 준비한 JSON 응답을 main에서 지연시킨 후 일반 모드로 전환하고 반환해도 승인/what이 되살아나지 않는다.
- 주입한 host unavailable 오류 후 일반 prepare 호출이 늘지 않고 승인 비활성 유지. 임의 path를 추가한 JSON IPC 요청도 거부된다.

## 실제 시각 증거와 한계

`json-template-selector.png`와 최종 `json-template-approval.png`를 직접 열었다. 실제 숨김 Electron 창을 warm capture한 PNG다. 선택기, JSON 입력, 모드, 봉투, 승인plan과 생성물 계약이 읽힌다. 입력 SHA/크기/검사 지문은 긴 문자열을 줄바꿈하고 생성물 세부목록은 내부 스크롤을 사용한다. 승인 실행을 누르지 않았으며 상태 영역은 준비 대기를 보여준다. 이 그림의 합성 `model`/`checker`, 반복 hash 문자는 설치된 모델의 실제 자격이 아니다.

실제 동작은 준비까지만 검증했다. 모델 변환 성공, 고정 checker 실행, 인수 성공, 파일 산출, provider 요청/비용 측정, 실제 승인 후 실행, 네이티브 격리의 재자격화를 증명하지 않는다. 기존 창의 좁은 화면/접근성 전체 검증을 여기서 반복하지 않았다.

원본 exact input은 임시 SQLite에 저장해 확인한 뒤 owned temporary root와 함께 정리했다. 최종 증거는 입력 hash/길이/대상메타데이터이며 테스트용 입력 문자는 screenshot에 보인다. `preflight.json`, `electron-result.json`, `selector-capture.json`에 DTO·단계·소스와 PNG hash를 기록했다. 소스 변경 후에는 이 결과를 역사적 검증으로 취급한다.
