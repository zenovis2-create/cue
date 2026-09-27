# 고정 JSON 검사기 실제 격리 실행

## 완료 기준과 범위
- `npm run build` exit 0.
- compiled adapter에서 실제 AppContainer child를 실행하여 pass/fail/unknown 계산, 원본 hash 연계, 독립 cleanup observer의 verified-clean 확인.
- carrier 상한/역할/취소/잘못된 프로토콜과 기존 broker·native observer·hardkill 회귀 통과.
- 교정 가설 상한 2. 추가 결함은 독립 검토 후 재계획하며 임의 반복하지 않는다.

## 실제 결과
- build exit 0.
- `npx vitest run test/integration-isolated-json-checker.test.ts test/integration-isolated-local-model.test.ts test/integration-model-boundary-observation.test.ts test/integration-model-boundary-hardkill.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 4 files, 10 PASS, 25.09 s.
- 초기 native 실패: fixed require 중 `node:fs:2745`의 `binding.lstat(base,...)` 출력. 원본 `initial-native-diagnostic.json` 보존. dependency realpath가 staged RX 범위 밖 ancestor를 조회하는 문제로 분류.
- 교정 1: json-checker 정적 선택에만 `--preserve-symlinks` 추가. 기본 model argv 변경 없음. 실제 계산 성공으로 gate 개선.
- 교정 2: .NET SHA 대문자와 JS SHA 소문자 test 기대값 일치. 제품 계산 실패가 아니며 비교 정규화 후 3 checker tests PASS.

## 프로토콜 및 제한
`createIsolatedJsonCheckerExecutor({db,nodeExecutable,nodeSha256,resolveBinding,timeoutMs})`는 model 역할 전용. host binding은 per-attempt owner/envelope/inputBytes/outputBytes다. 요청은 argv에 들어가지 않으며 bounded stdin으로만 전송한다.

1. client에 check 프레임(고정 contract, request/attempt ID, input/output base64).
2. 고정 client가 bytes hash를 붙인 checker_request 반환.
3. host가 정확한 ID/hash를 확인하고 authorize_check 고정 ack.
4. child가 패키지 고정 core를 실행하고 checker_result 반환.

native carrier 한 프레임 1 MiB. 따라서 base64 두 payload 합산 상한은 core 각각 1 MiB보다 작고, launch 전에 거부한다. core 개별 제한은 그대로다. 잘못된 canonical JSON 입력의 verdict unknown 및 잘못된 결과의 verdict fail도 **계산 실행 자체는 succeeded**다. 원래 요구사항 acceptance는 별도 host 책임이며 이 모듈은 완료 판정/자격 publication을 제공하지 않는다.

기존 owned piped launch·AppContainer cap0·Job max1·suspended token readback·guardian을 재사용한다. client/core는 고정 packaged 경로에서 새 전용 root로 복사 후 hash 검증, read-only seal한다. 사용자 지정 module/path/URL/명령은 받지 않는다. client-only 결과이며 providerStopped/billing과 별도 admission은 unknown이다. 새 Qwen 호출 없음.

## 소스 SHA256
- client F0A5FE10E9C3E689D9529ED6197FB2FCD1995DC9C2C35D2A259F216F38584484
- adapter 4CF6B4A376BAC01EFB63EAE40EFFBFD5AC893EC980AE5A58DB13F1A3F586AA98
- launcher DA326DA897BE4C131AD8499F48B581771D6ABEA236097BEFCF639F1918AB0441
- focused test 07B3C55F35AB90BDBF099F6BB52263BF6F05913EA5BD031661774FB995E2724F
- fixed core 34AB9E98F097710643694446E8DEE97D5FB2F2BE437D0206F734148A443CFBDC

독립 검토 전 maker 실행 기록. 기존 native qualification/실제 Qwen canary는 각 당시 해시 한정의 역사적 기록이며 새 실행 자격으로 자동 승계하지 않는다.

추가 최종 회귀: npx vitest run test/p4.test.ts test/p45.test.ts test/integration-model-boundary-qualification.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 : 3 files, 21 PASS / 3 SKIP, 36.67 s. 단일 owned spawn 경계와 현재 launcher의 기본 model native 관측 회귀 통과. 검사기 admission publication은 별도 미구현.

## 독립 검토 finding 교정: 바이트 snapshot
새 독립 계약 finding으로 Buffer.from(caller Uint8Array)가 own valueOf를 호출할 수 있음을 확인했다. native timing 교정과 별개의 bounded 교정(상한2)이며 1회 수정으로 완료했다.

core와 같은 intrinsic buffer/byteOffset/byteLength getter를 적용하고, 실제 ArrayBuffer 위 새 native Uint8Array를 복사한다. Proxy/SharedArrayBuffer/detached는 launch 전 거부한다. 실제 compiled child 테스트에서 input/output의 own valueOf와 buffer/length/offset accessor 호출0, 원래 bytes SHA 일치를 확인했다. proxy trap0 및 session0을 추가 검증했다.

- build exit0.
- focused checker 4 PASS,9.13s.
- final adapter SHA81F976C364CCCAF26A67C1B1F6E67A18FC610500E0500051F910FF2BF3AC1D66
- final focused test SHA57AE5096F1D43417D1EA9A9FE13EB80A355846CF54F6CBA941C6A56751ED708F
- client/core/native launcher 소스 변경 없음. 앞선 회귀는 해당 동일 native 소스에 대한 기록으로 유지한다.
