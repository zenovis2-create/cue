# 독립 코드 검토 — local model transport

검토일: 2026-09-11 · 검토자: reuse_transport (구현자와 분리) · 최종 판정: **코드·fixture 검토 통과 (실물 자격 보증 아님)**

범위: `daemon/src/adapters/local-model.ts`, `daemon/test/integration-local-model.test.ts`. 직접 소스 수정 없음. 외부 모델/유료 요청 없음.

## 실행 증거

- daemon에서 `npm run build`: exit 0.
- daemon에서 `npx --no-install vitest run test/integration-local-model.test.ts --fileParallelism=false --maxWorkers=1`: exit 0, 13/13, 399ms.
- 추가 독립 probe: Node HTTP loopback 서버가 하나의 응답에 text delta + stop finish + `[DONE]`을 전송. 첫 `iterator.next()`로 text를 받은 직후 AbortController.abort를 호출하고 다음 두 이벤트를 수집했다.
- 실제 결과: 취소 이후 usage 이벤트, 그 다음 `terminal/status=completed/reason=stop/providerStopped=unknown`이 반환됐다. 예외가 발생하지 않았다. probe는 stdin Node module로 실행하여 프로젝트 소스 파일을 만들지 않았다.

## P1 — 버퍼에 남은 이벤트가 취소 이후 완료를 선언한다

`local-model.ts`의 `for (const event of parse(payload))` 루프는 yield 전에 AbortSignal을 검사하지 않는다. 네트워크 read가 이미 완료되었으면 fetch abort로 다음 이벤트 생성을 막을 수 없다. 사용자 취소 또는 소비자가 일시 정지한 사이의 timeout 뒤에도 성공 terminal을 전달한다. 기존 동시 취소 테스트는 서버가 terminal을 보내지 않은 경우라 이 경로를 잡지 못한다.

수정 요청: 매 이벤트 전달 직전에 내부 controller의 abort 상태를 검사하고, 같은 chunk의 text/finish/DONE이 버퍼링된 상태에서 첫 text 후 취소하는 회귀 검사를 추가한다. usage를 받은 다음 취소하는 경우에도 completed가 나오지 않아야 한다. 동일 pause 중 timeout도 같은 내부 signal 검사로 차단해야 한다.

이 결함이 해결되기 전 취소 계약 통과 또는 transport 채택 완료로 표시하지 않는다. 구현자의 수정 후 동일 probe/추가 회귀와 필요한 focused 테스트를 다시 검토한다.

## 나머지 범위와 보증 한계

확인된 구현: null 사용량 유지, 안전 정수/합계 검사, 성공과 length incomplete 구분, 모델 identity와 tool 호출 거부, 요청/응답 바이트·토큰·시간 상한, redirect 차단, 제한된 loopback endpoint, 자동 retry 없음. 요청은 tools를 보내지 않으며 실행 권한을 부여하는 경로가 없다.

서버 stop·M1~M3·모델 실제 identity·사용자 홈/환경 proxy/서버 외부 전송 부재는 이 코드 검토와 fixture의 보증이 아니다. actual providerStopped를 unknown으로 유지하는 것이 맞다. 실제 서버 기능/권한 검증은 별도 게이트이며 이 리뷰로 자격을 부여하지 않는다.

## 수정 1회 후 독립 재검토

구현자가 read 전과 각 yield 전에 내부 AbortSignal 검사를 추가했다. 기존 P1은 **해결됨**이다. 상기 최초 발견/수정 요청은 이력으로 보존한다.

- 저장소 루트 `npm --prefix daemon run build`: exit 0.
- daemon `npx --no-install vitest run test/integration-local-model.test.ts --fileParallelism=false --maxWorkers=1`: exit 0, **15/15**, 560ms. 동일 chunk text 이후 cancel 및 소비자 pause 중 timeout 회귀가 포함된다.
- 독립 loopback probe 재실행: 한 응답의 text/finish/DONE을 버퍼링한 뒤 **text 직후 취소** 및 **usage 직후 취소** 각각 다음 next가 `review cancel`로 reject하는 것을 assert로 확인했다. 두 경우 PASS, probe exit 0. 모델/외부 네트워크 호출 없음.
- 최종 리뷰는 아래 고정 파일 내용에만 적용한다. 제품 전체 테스트, provider 종료 및 M1~M3 측정 완료를 뜻하지 않는다.
- source SHA256: `ADEC850A783E94708946E1570BC653F1992977F97EC869CBC413FECE3BEE6A8F`.
- test SHA256: `2C41E3A892274D0992A50C1CB168118A918BCBC25096BF0BBDA00BB73467BC88`.
