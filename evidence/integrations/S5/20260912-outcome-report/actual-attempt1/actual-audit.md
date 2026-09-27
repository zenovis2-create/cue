# S5 report actual attempt1 독립 실패 감사

판정: FAIL — 실제 화면 QA 미완료. Reviewer /root/contracts_review. 기존 artifact만 읽고 SQLite backup을 readonly로 재개방했다. Electron/모델/helper/native 재실행0, 제품 수정/build0. 실패를 성공으로 바꾸거나 attempt를 재사용하지 않았다.

## 보존된 결과

실행 proof SHA17B447E72152EFD78119219A8E07E68F945CE23B0DB5600A94D04C4E2894199D와 현재 원본 일치. runner exit1/closed, final-verdict passed:false/childPassed:false. child PID21988, backupVerified:true/removed:true/parentErrors:[]다. timeout.json은 phase=report-window만 기록한다. failure.json은 proof:60의 finally debugger.detach에서 Object has been destroyed를 기록한다. 넓은 report-window 단계만으로 rAF 대기가 근본 원인이라고 확정할 수 없다. detach가 종료 시 원래 오류를 가릴 수 있어 남아 있는 오류를 곧바로 최초 원인으로 취급하지 않는다.

보고서 export는 도달했다. artifact.json의 delivered HTML 7433 bytes/SHA5cd556c061ad7aa5c9dd8310b35056ff6307d3146dd03ce60e250a7c01320b8f와 저장된 outcome-report.html을 독립 대조했다. 이는 파일 전달 성공이며 browserEvidence/visualReview는 원래 not-run이다. PNG0, checks.json 없음이므로 전체 화면/마지막 count/fetch/current-guard/읽기무변경 assertions를 통과했다고 주장하지 않는다.

저장 HTML의 details JSON을 비실행 DOM으로 읽어 separate-read-transaction, baseReportDigest9b5f13e68e7bfdeef9fc3c8989e6394e251efa18cf0913abbb8ef5fae9cc7aff, evaluation-input-only/outcome unknown/quality null/elapsedMs null을 확인했다. CSP에 script/connect/default none이 선언되고 script element0이다. 이는 저장 문서 검사이며 실제 창 렌더/스크립트 차단의 동작 증거를 대신하지 않는다.

## 백업/정리 및 한계

readonly backup은 integrity_check=ok, SHA695690826616cd6797a86074b0cddefdb13f1de361869b9be3e809a4f27b7ce5이며 result receipt와 일치한다. 독립 counts: task1/run1, orchestration_attempt/session_handle/native_execution_identity/approval_event/acceptance_final 모두0. 준비된 합성 목표/정책/계획만 있으며 실행 성공/인수는 없다.

before/after selected-source manifests가 일치한다. 이것은 선택한 파일의 비교이며 전체 installation 최종 guard check가 끝났다는 증거가 아니다. profile-binding에는 실제 userData/sessionData 일치가 기록됐다. 종료/닫힘/backup/소유 root 삭제는 final receipt에 기록됐고, 독립 lstat에서 정확한 owned root가 ENOENT임을 확인했다. 일반 프로세스 전체 부재나 임의 사용자 데이터 정리를 추론하지 않는다.

남은 attempt2 준비는 별도이며 본 감사는 실행 승인이 아니다. 후속 proof는 좁은 단계 기록과 정리 오류가 원래 실패를 가리지 않는 처리를 검토해야 한다. 제품 코드 변경 없이 성공한 기존 proof를 반복하거나 과거 실패 evidence를 덮어쓰면 안 된다.

## 주요 증거 SHA-256

| 파일 | SHA-256 |
|---|---|
| final-verdict.json | C7C80A4E0EEA24A3D45088D2D2D167A4863476EA468060D3A6C46D139E0A63A2 |
| runner.json | 513C8BDA8FDBF09419CCC4745793146A2276D9F04E5418E61C4D5D6CA1C41ED7 |
| failure.json | CB02B7B3F054CD1FEC04A19981F45E4080558CDAA82B5991B1767D222E1828B3 |
| timeout.json | 9BE7332B2403E4CD2F7F2187841182B9D3107A45F6467D101EFA59E9B7377DF0 |
| result.json | 394BB0C5993FF33D2339413A856F2D8897BF181EE5A6797EB74EFE4D4B4B99D2 |
| artifact.json | BA292F5D7047E1F3CB95BBB7B515BEB7198B04F423A1C19D13988FA3E6662F77 |
| outcome-report.html | 5CD556C061AD7AA5C9DD8310B35056FF6307D3146DD03CE60E250A7C01320B8F |
| ledger-backup.sqlite | 695690826616CD6797A86074B0CDDEFDB13F1DE361869B9BE3E809A4F27B7CE5 |
| before.json | 2F19164DD185BDEDEAFC6EBE0EC15065D2EBAD376A0D263951A923AEDB1D0351 |
| after.json | 2F19164DD185BDEDEAFC6EBE0EC15065D2EBAD376A0D263951A923AEDB1D0351 |
| owned-state.json | 9235DEFF160A5DD69B0D0BA339ED6A9E3F994EEDC283C5B6E49336740FBA8F6F |
