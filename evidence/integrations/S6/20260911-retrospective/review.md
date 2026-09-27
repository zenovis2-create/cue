# S6 회고 저장소 및 core 연결 독립 검토

판정: PASS — 현재 해시에 묶인 제한된 저장소/core 계약. 제품 전체 완료, 실행 자원 정리, acceptance 또는 외부 공유의 승인이 아니다.

독립 checker: /root/contracts_review. Maker는 store /root/reuse_pure, core 및 migration 등록 /root. 제품 소스 수정 0, 모델/네트워크 호출 0. 완료 기준은 해당 소스 읽기, 실제 SQLite store/core 집중 테스트, noEmit 타입 검사, compiled 023 migration 해시 일치이며 수정 가설 상한 2 중 0 사용. 현재 startup QA 동결을 준수해 build 재작성은 하지 않았다.

## 검토 결과

- retrospective.ts:8 입력은 정확한 own data 필드만 복사하며 proxy/getter/추가 필드를 거부한다. create는 안전한 run/task/attempt/recovery V2 컬럼만 SELECT한다(:77–82). 원시 goal, artifact, verification, 자유형 오류·hypothesis는 읽지 않는다.
- 각 배열 1024행과 전체 UTF-8 payload 1MiB 제한을 초과하면 삽입 전에 실패한다. IMMEDIATE transaction이 읽기와 삽입을 묶고 동일 draft/run 재생은 쓰지 않는다. 외부 transaction rollback은 초안도 되돌린다.
- 023의 UPDATE/DELETE/중복 INSERT trigger가 REPLACE까지 거부한다. read는 저장된 snapshot에서 전체 canonical body와 projection digests를 재구성하며 현재 run의 불변 task/envelope 연결을 대조한다. 현재 task 상태/cleanup 변경은 과거 관측을 덮어쓰지 않는다.
- summary는 acceptance=not-assessed, authority=reference-only, sourceHashScope=safe-column-projection을 유지한다. recoveryRecords는 recovery_attempt_v2 행 수이고 전체 legacy recovery나 성공을 추론하지 않는다. 반환값은 재귀적으로 동결된다.
- core:320은 실제 daemon.db로 store를 구성하고 :928/:931의 두 보호된 API가 이를 직접 사용한다. 생성은 approval/session/attempt/acceptance 권한을 부여하지 않는다. 실제 core prepare/reopen/getter 거부 및 replay 검증을 통과했다.

제약: SHA는 안전한 컬럼 투영의 무결성 확인이지 원본 artifact 또는 적대적인 전체 DB 재작성에 대한 인증이 아니다. 역사 기록은 지속적으로 현재 상태를 재검증하는 live verdict가 아니다. 이번 변경은 보호된 core API이며 IPC/UI 공개나 공유를 구현했다고 주장하지 않는다.

## 독립 실행

cwd: C:/Users/User/cue/daemon

```text
npx --no-install vitest run test/integration-retrospective.test.ts test/integration-retrospective-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
2026-09-11 22:36:08 KST — 2 files, 7 PASS, exit 0, 1.38s
npx --no-install tsc -p tsconfig.json --noEmit
exit 0
```

core는 기존 compiled store와 실제 openLedger 자동 migration을 사용했다. dist 소스는 읽지 않았고 migration 파일은 SHA만 비교했다. source와 compiled 023 SHA가 일치한다. 테스트는 격리된 임시 원장만 수정했다.

| 파일 | SHA-256 |
|---|---|
| daemon/src/resources/retrospective.ts | D2E26F27FF0DD6EA73F463C1DA4BF11A3D6021C2D7B3961A4932B5F4ABA405CE |
| daemon/migrations/023_retrospective.sql | 92341CFBE2D1F2CF059D19C9F17C2CD1DDC4F64F1D2D2C8D0B74347BCBB87BE5 |
| daemon/dist/migrations/023_retrospective.sql | 92341CFBE2D1F2CF059D19C9F17C2CD1DDC4F64F1D2D2C8D0B74347BCBB87BE5 |
| daemon/test/integration-retrospective.test.ts | AE0495B1C7AA6090FB660BB3F579121F06AAD76F8837A2E49B37C518A1B5E427 |
| app/core.mjs | B7D6BAC7BF1AA2F16E1E07CCBEAFC48A5269733799A4032362EBD3A685314C48 |
| app/core.d.mts | 60ECB218DFD6877FB9692C1B194AECFC1B4FE3900BBBFC514A7FD50D1E0A19F2 |
| daemon/test/integration-retrospective-core.test.ts | 4B56FC03D0CD3B0F3EE8B019EA6FD48443E0BDEE45F1884B6B07C08E7C825C7A |
| daemon/src/ledger.ts | 9F13E7DEB3D8C05215DAA8B18D525042204FDB881113C68A7C88D247B2E31DC0 |
| daemon/scripts/copy-assets.mjs | E8A4CE2B14F4C08655801D538AE1A0F634DF115E3475F0250C3D635899CC7E2A |
