# 생성 결과물 승인 UI — 실제 Electron fixture 확인

- 완료 명령: `node scripts/reuse/generated-approval-electron-proof.mjs` → exit 0. Electron 44.2.0, 새 renderer 파일 로드, 숨김 창, Node 접근 불가. 자식 실행은 60초 이내 종료하도록 제한했다.
- 실제 폼 제출로 고성능 모드를 전달하고, 승인 대상·요구사항·생성 단계·검사기·버전·입력 120바이트·출력 상한 1048576바이트·세 종류 64자리 지문이 DOM에 그대로 표시되는 것을 검사했다.
- 128자 대상 ID와 64자 해시는 줄바꿈되며 페이지/행의 가로 넘침은 없다. 원문 입력 및 비밀 sentinel은 document body에 없다.
- 계약 없음, legacy 응답, prepare 실패에서 대상 패널과 이전 행을 제거했다. 세 경우 모두 제출 모드는 유지되며 실패에서는 승인 버튼이 비활성화된다.
- `electron-generated-approval.png`를 직접 열어 확인했다. 계약 설명·검사기·바이트 한도·입력 지문이 읽히고, 긴 ID가 잘리지 않고 줄바꿈된다. 계약 목록은 기존 세로 스크롤 영역이며 마지막 지문은 내부 스크롤 아래에 이어진다. 전체 지문 보존은 DOM 검사로 확인했다.

두 번의 proof 수정: 첫 시도는 executeJavaScript의 최상위 await 문법 오류로 실패하여 async 함수로 감쌌다. 두 번째는 fixture ID가 128자 계약 한도를 넘었으므로 정확히 128자로 수정했다. 제품 소스 변경은 없다. `electron-failure.json`은 두 번째 실패의 이력이며 최종 판정은 `electron-result.json` 및 `electron-process.json`이다.

PNG SHA-256: `cf01ebb53d0817fdc51c035ad343b712820159045bb6678d173d9b590c3aec33`.
renderer SHA-256: `66041cb0c8bcd3d87a70943b51f78b952cb27ee9842e4f19b2ea2c071d5d96f0`.

범위는 실제 Electron 렌더러에서 fixture API 응답을 표시하는 UI 증거다. 실제 preload/IPC, 모델 실행, 기본 dispatch 연결, 인수 성공이나 모델 자격 증거가 아니다. Qwen 호출은 없었다.
