# v0.1 출시 불가 — R-1의 P1-3 원문 판정 기록이 없어 출시 게이트가 FAIL이다.

전체 회귀 검증은 `165 passed / 5 skipped`이며 원문은 `release_test_output.log`, SHA-256은 `35e9f1a138c2d346f9daa24e20eb25b9fe4fcf3fd6fe264c3e006b29bf3b6332`다. R-3·R-4·R-6·R-9는 단위 대역이 아니라 실제 Windows 프로세스로 실행했다.

남은 PARTIAL 3건은 승격하지 않았다.

- P3-16: 네트워크 탐지·즉시 중단만 검증; syscall 수준 강제 미검증.
- P4-2: Windows에서 worker `cwd`의 독립 OS 확인 불가.
- P6-3: 실제 Buzz 전달 미검증; 외부 상태 변경 금지에 따라 live relay를 실행하지 않음.

R-1은 `evidence/P1/`의 기존 원문을 검사한 결과 P1-1과 P1-2 기록은 있으나 P1-3 판정 원문이 없어서 FAIL로 남겼고, 누락 증거를 만들어내지 않았다. 나머지 R-2~R-9 및 I-1~I-6은 PASS다.
