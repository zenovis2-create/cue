# 명시적 JSON template core 테스트

이 maker는 `daemon/test/integration-json-template-core.test.ts`만 구현했다. Core/driver 선언과 제품 기능은 부모가 구현하며 독립 검토자는 별도다.

실제 AppDaemon/core/orchestration driver/generated-output ledger를 함께 사용한다. Generated host의 자격/제어 pin은 synthetic fixture이며 executor는 호출되면 실패한다. Prepare만 수행하고 모델·네이티브·legacy launch는 모두 0회다.

5개 테스트에서 exact DTO 및 16종 잘못된 입력, 잘못된 UTF8/1MiB 초과/JSON syntax/정책mode/autonomy/getter/proxy를 거절하고 SQLite `total_changes()`도 증가하지 않음을 확인했다. 원 input bytes/hash/byte length는 실제 `readInput`으로 조회한다. `run.template`과 run은 frozen이며 서로 다른 두 준비와 정책 선택은 외부 DTO 변경에도 유지된다. 공개 PreparedGoal은 raw input이나 template을 노출하지 않고 metadata만 포함한다.

Host가 다른 input을 캡처하면 task/run/envelope/artifact/resource_run_pin/plan/step/requirements/target/local policy/count budget 총 11테이블의 행 수가 준비 전으로 복원된다. Host prepare 시 resource pin이 이미 존재했음도 확인했다. 실패 run의 승인은 거절되고 이후 유효한 준비는 성공한다. `requiresExplicitTemplate` host는 freeform을 거절하며 명시적으로 만든 기존 custom host의 freeform 준비는 유지된다.

Gate: `npm run build` exit 0, `npx tsc -p tsconfig.json --noEmit` exit 0. `npx vitest run test/integration-json-template-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **5 PASS**, 2026-09-11 21:45:01, 1.25s. 수정 가설 상한 2회: host flag의 `true` literal 추론을 고정했고, fixture count query의 잘못된 테이블 이름을 실제 `requirement_contract_binding`으로 고쳤다. 제품 코드는 수정하지 않았다.

최종 제품 source/test hashes와 독립 verdict는 review artifact에 기록한다. 이 테스트는 실제 모델 실행이나 현재 자격을 증명하지 않는다.
