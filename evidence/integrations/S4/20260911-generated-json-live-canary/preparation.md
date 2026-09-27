# 실제 JSON workflow 카나리 준비

## 자격 성공 후 workspace 배치 실패와 제한 재개

실제 기록 `D:/Temp/User/Cue.GeneratedCanary.nA3zyG/result.json`은 checker/model M1–M3 live 자격과 cleanup 성공을 담고 있다. 모델 qualification request `43a8c064-e97d-4676-9d88-3293b5db034c` 1회가 소모됐다. Workflow는 core의 보호 상태 디렉터리와 worktree 중첩 검사에서 시작 전에 거절됐다. 기존 DB나 결과를 이동·삭제하지 않았다.

별도 승인된 layout 수정(진단 상한 2회)에서 `--resume-qualification-root`를 추가했다. 실제 temp 내부의 예상 root, 정확한 이전 실패/result/request, workflow attempt 0, 현재 source digest와 실제 persisted live capability/freshness를 확인한다. 자격 collector를 다시 호출하지 않고 원 DB를 열며, worktree와 새 resume evidence를 각각 형제 디렉터리에 생성한다. 원 측정 시간은 보존하고 재개 검증 시간은 별도 필드로 기록한다. 기존 result.json은 덮어쓰지 않는다. 누적 요청 상한 2회 중 workflow 요청 1회만 남았다.

`--validate-resume-only` 오프라인 검증 exit 0, 결과 `D:/Temp/User/Cue.GeneratedResume.Koxxod/result.json`, 상태 `resume-offline-setup-validated`/passed false. 실제 core가 형제 worktree를 허용하고 host setup이 가능함을 확인했으며 prepare/execute/model/profile 호출은 없었다. 이후 원 측정 시간 필드 보존만 보완했고 node syntax exit 0. 최종 스크립트 SHA `baea4b56c054eb0964f59f3b5b1f0ba6bc4654458ddd80096ff6d4a8fcf0f4bc`. 남은 실제 workflow 호출은 root 실행 지시를 따른다. 자격 maxAge 600000ms는 연장하지 않는다.

## 최초 실행 시작 실패와 별도 수정

Root의 첫 라이브 스크립트 invocation은 Node 24 module linking 단계에서 종료됐다. `module.exports = Object.freeze(...)` 형태의 CJS checker를 named import한 app host가 원인이며, script body/DB/profile/model 요청 이전의 startup 실패다. 이 invocation의 모델 요청은 0회다. Vitest 변환은 이 문제를 드러내지 못했다.

부모가 승인한 별도 상한 2회의 진단 범위에서 app host를 default CJS import + destructuring으로 수정하고, 실제 Node 하위 프로세스로 compiled dependency graph를 import하는 회귀 검사를 추가했다. Checker 소스와 실행 권한은 변경하지 않았다. `npm run build` exit 0, focused host tests 11/11 PASS (실제 Node subprocess import 포함), 직접 `node --input-type=module -e "await import('./app/generated-json-host.mjs')"` exit 0. 이 수정 후 이전 subject digest는 재사용하지 않으며 root가 재측정한다. 후속 라이브 카나리는 아직 실행하지 않았다.

- 상태: 실행 전 준비. 작성자는 모델 요청 및 스크립트 실행을 하지 않았다.
- 스크립트: `scripts/reuse/generated-json-live-canary.mjs`
- SHA256: `82795df61269c72ca768ca4ac5823cc188efb2ed8b5f7201db7bba14f4b56262`
- 검사: `node --check scripts/reuse/generated-json-live-canary.mjs`, exit 0.
- 독립 API 감사: broker_review 담당. 마지막 지적은 증거 export 오류가 close/result 기록을 건너뛰는 문제였으며, guarded export와 실패 상태 기록으로 수정했다. 이 수정의 진단 상한은 2회다. 검토자는 별도 review artifact에 최종 판정을 기록한다.

실행 전 전체 회귀 종료, 동결한 소스의 신규 Node 프로세스 측정, 독립 검토와 root 실행 지시가 필요하다. 이 측정은 Node controlled canary에만 유효하며 Electron 기본 앱 자격이 아니다.

첫 오프라인 측정은 추정한 `build/Release/better_sqlite3.node` 경로 ENOENT로 모델 호출 전에 실패했다. 별도 환경 경로 finding으로 상한 2회의 수정 범위를 승인받아, 메모리 SQLite를 열고 닫은 뒤 `require.cache`의 실제 native 경로를 해당 패키지 실제 경로 내부에서 정확히 하나만 찾도록 변경했다. 모호한 후보는 거절한다. 수정 후 syntax 검사 exit 0.

Root의 재측정은 모델/프로필 실행 0회로 완료됐다. 실제 native는 `daemon/node_modules/better-sqlite3/prebuilds/win32-x64.node`. Checker subject `c69bda8144618bd5e576f06c28b7ade19b9ddf5795f250d2c45b15157d9b013e` (290 files), model subject `61f8f8f2c2defa0c1b057245dd14738c518dea33b251702077fe4181bc4968f3` (289 files). 자격 collector 및 workflow는 아직 실행하지 않았다.

계수는 비금전적 `LOCAL_CALL` 2단위의 workflow 실행 상한이다. 모델 자격 요청 1회와 실제 workflow 모델 요청 1회를 합쳐 전체 시도 누적 Qwen 요청 상한은 2회다. 실패 후 자동 재실행하지 않는다. 전달 여부가 불명확한 요청도 소모된 것으로 취급하고 root가 기존 증거를 확인한다. 자격 native checker는 먼저 실행한다. 타이밍 180000ms는 설정 상한이며 성능 측정치가 아니다. 품질 추정 및 최소값은 모두 0으로 가성비나 품질 개선을 주장하지 않는다. 알 수 없는 청구는 예약을 유지한다.

SQLite, worktree, 원시 증거는 프로젝트 밖의 별도 임시 디렉터리에 보존한다. 실제 승인/실행/산출물/검사/cleanup/acceptance를 검증하며 fixture executor나 임의 PASS를 주입하지 않는다. 증거 export 실패는 성공으로 보고하지 않으며 종료 정리를 계속한다. 현재 문서는 실제 성공 증거가 아니다.
