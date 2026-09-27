# R-01/R-03 단일 요청 transport fixture 결과

- 기록일: 2026-09-11, Windows PowerShell, Node v24.18.0.
- 기준 git HEAD: `8e2afa6366e3af62f7115b2c67be799130f8dfdf`. 실험 파일은 이 HEAD 위 미커밋 변경이다.
- 명령: 저장소 루트에서 `node --test scripts/reuse/model-transport.test.mjs`.
- 최종 exit code **0**, tests **18**, pass **18**, fail **0**, duration **301.5959ms** (Node test runner). 메모리/CPU/GPU 사용량은 미측정.
- adapter SHA256: `77D5835FEE99A96BAF87017D5EFAE99458D3B702E060453E9ECB62BB2CD42A28`.
- test/inline fixture 정의 SHA256: `B5014C3B2E3581CEF3019486BE3837EB567B88E5B9139EF445D1EC795B06C9BF`.
- 외부 package 설치/SDK 호출/모델 호출/비밀 읽기 없음. Node HTTP 서버가 127.0.0.1 임시 포트에서 fixture를 제공했다. 출력을 작성한 뒤 추가 fixture 수정 없이 위 hash를 측정했다.

## 실행 내역

최초 pass exit 1: 18개 중 8개 통과. 종료 finally에서 abort 이후 reader.cancel이 AbortError로 거부되어 정상 결과와 원래 protocol 오류를 덮었다. 가설 수정 1회: 이미 abort된 transport의 cancel 예외를 분리하고 reader lock을 해제했다. 동일 검사 재실행 결과 18/18 통과. 초기 결함을 숨기지 않으며 수정 횟수는 최대 2회 중 1회 사용했다.

## 통과한 검사

1. SSE UTF-8 분할·CRLF·다중 data·사용량·성공 terminal.
2. Ollama NDJSON 관측 usage와 unknown usage 분리.
3. JSON 파손 거부.
4. partial stream EOF 거부.
5. finish만 있고 DONE 없는 응답 거부.
6. finish 없는 DONE 거부.
7. length 종료를 성공으로 취급하지 않음.
8. model identity 불일치 거부.
9. tool request 거부.
10. 음수 usage 거부.
11. 미완성 줄도 총 response byte 상한 적용.
12. HTTP 429 실패·자동 재시도 0.
13. redirect 거부·두 번째 요청 0.
14. 사전 abort 시 요청 0.
15. 헤더 전 timeout 이후 fixture 서버에서 socket close 관측.
16. 첫 delta 후 한 요청 취소·다른 병렬 요청 완료·취소 socket close.
17. 원격/URL 인증/query endpoint 거부.
18. NDJSON 파손·부분·error·tool 응답 거부.

## 판정과 한계

**오프라인 모델 전용 transport 기준선 실험만 통과. 외부 SDK/parser는 아직 실험하지 않았으므로 adopt/limited 아님.** 구체적 지원은 OpenAI-compatible chat completions SSE 부분집합과 Ollama chat NDJSON 부분집합이다. Responses API, full SSE 표준(예: CR 단독 분리), resume/reconnect, 실제 모델 identity·메모리·과금·provider 정지는 검증하지 않았다. terminal의 providerStopped는 항상 unknown이다.

Cue daemon/Electron에 연결하지 않았다. P13 M 자격, 원장 재시작/중복, 사용자 홈/프로세스/환경 proxy 경계 계측과 실제 서버 클라우드 fallback 부재는 미검증이다. 이 테스트의 timeout/socket close는 Windows Node fixture에서의 client transport 정리 증거이며 실제 모델 추론 종료 증거가 아니다. 독립 검토는 별도 진행하며 이 기록 자체는 자가 승인으로 사용하지 않는다.
