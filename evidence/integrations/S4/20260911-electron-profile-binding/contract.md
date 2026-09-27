# Electron 프로필 바인딩 변경안 — 적용 전

현재 전체 회귀 freeze 때문에 제품·테스트·실행 스크립트에는 적용하지 않았다. implementation.patch는 검토용이며 테스트 PASS나 실제 프로필 격리를 주장하지 않는다.

## 완료 조건과 교정 한도

- 적용 전 대상 파일 SHA가 아래 기준과 동일한지 확인하고 다른 담당자의 변경이 있으면 패치를 조정한다.
- root 적용 신호 뒤 집중 프로필·entry ordering·기존 entry·P9 검사와 타입 검사를 실행한다. 실제 Electron 검사는 새 임시 경로에서 프로필 helper만 호출하며 모델·원장·앱 창을 만들지 않는다.
- 교정은 최대 2회. 실패하면 구체적 원인을 기록하고 새로운 가설로만 수정한다. 독립 검토 이후에만 준비 gate를 통과시킨다.

## 순서와 권한

`Electron + builtin-only helper 초기 TCB → guarded capture → loader 내부 동기 profile binding → app 정의 dynamic import → postassert → initializer`.

호스트 CUE_USER_DATA가 없거나 빈 문자열이면 기본 Electron 프로필을 유지한다. 값이 있으면 상대 경로를 resolve하고 미존재 디렉터리를 한 단계씩 만든다. 각 구성 요소의 파일·symlink·junction·canonical 불일치를 거부한다. 사용자 파일을 덮어쓰거나 설정/원장을 생성하지 않는다. 이미 app.isReady()이면 지정 프로필 바인딩은 거부한다.

userData는 지정 root, sessionData는 root/electron-session으로 설정하고 getPath 결과를 재확인한다. helper는 FS/path builtin만 import한다. 동시 적대적 디렉터리 교체나 OS 변조를 방어한다는 주장은 하지 않는다.

기존 qualification exact flag, actual Electron runtime 확인, legacy CUE_LIVE_RUN 거부, 초기화/종료 의미는 유지한다. qualification terminal summary에 보호된 profile receipt를 추가하고 최종 getPath와 같은지 확인한다. 경로는 CLI/evidence 전용이며 renderer에 새 권한이나 API를 노출하지 않는다.

## 적용 전 기준 SHA-256

| 파일 | SHA |
|---|---|
| app/start.mjs | DC44783D270EE849AF38C37D2944B992FD11E8151072715ACAB0D2B6CE323E94 |
| app/qualification-start.mjs | BD70B229631154AFD346C703743877AF3D39F6F694C21EFE24CC595B60A764B8 |
| daemon/test/integration-start-entry.test.ts | 4D35E7EF04840D71FC55C391250EF057196B45A13533BA897B5592B4FA284A17 |
| daemon/test/integration-qualification-start.test.ts | 876C3509A591B63949C0ADFEAF3D1136F9C027D3EBCACA48F87F90A9A3B6DDAA |

P9의 적용 시점 SHA도 다시 확인한다. 기존 테스트 두 개는 callback을 실행하지 않는 fixture이므로 기본 실패/runtime assertions는 유지하며 새 entry-order 검사에서 실제 callback 순서를 관찰한다.

## 후속 실제 gate harness 변경 계획 — 아직 미적용

qualification summary.profile과 workflow observer의 app.getPath('userData'/'sessionData')를 각각 새 owned data 경로 및 그 electron-session 자식과 비교한다. 상속 환경을 덤프하지 않는다. 두 phase에서 실제 Electron version을 확인하고 프로필 receipt가 없거나 일치하지 않으면 성공으로 기록하지 않는다. 기존 default-profile 격리 없는 harness는 실제 실행 금지 상태를 유지한다.

두 fresh 프로세스 사이에 빌드하지 않고 각 guarded generation을 확인한다. 스크린샷 실패가 collect/close 또는 원장 감사·백업을 건너뛰게 하지 않는다. 실제 실행 승인은 독립 검토 및 최종 source freeze 뒤 별도 root 결정이다.
