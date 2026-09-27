# S5 outcome report actual attempt2 독립 감사

판정: PASS — 준비된 합성 workflow 보고서 내보내기와 제한된 실제 Electron 화면. Reviewer /root/contracts_review. 저장 증거/원본 proof 읽기, PNG3개 직접 열람, 백업 readonly SQLite 검사만 수행했다. 추가 Electron/native/helper/model 실행·제품 수정/build0. attempt1 FAIL 기록은 불변으로 남는다.

## 결과와 소스

final-verdict passed:true/childPassed:true/exit0/closed/backupVerified/removed, parentErrors없음. owned PID52552 종료0 기록, 정확한 owned root를 독립 lstat하여 ENOENT 확인. 원 proof B32E46E3FB7EDBC3A0272C83A846B3C1CEC610F603AB858BA43F4A750C3DC107 및 fixture 현재SHA가 before 기록과 일치한다. before/after 전체 selected manifests 동일이며 실제 파일 경로 항목을 현재 bytes와 대조했다. 별도 executable identity 값은 before/after 일치만 확인했고 바이너리를 다시 측정하지 않았다.

Guard digest f207152acabb50b4538b0cc7af84694132726884c3ebca254dc0734c2066145d가 guard.json/checks에 일치하고 guardCurrent:true다. 이는 proof가 실제 설치 guard를 마지막에 확인한 기록이며 새 reviewer 자격 발행이 아니다. 현재 backend와 compiled source는 selected manifest에 포함돼 일치한다.

## 보고서 및 DB

HTML7433 bytes, SHAac735b5ee94367112d0a7a96581518637557d064003912ac105c19293ebc5a50은 artifact receipt와 일치한다. inspected details의 baseReportDigest0387b5d812027c71694d6e6220104e1ad1dcb423614c5cc3c2b503ed945c851f는 실제 original reader의 checks 값과 일치한다. proof는 export 뒤 original report digest/total_changes/DBserialize hash 불변을 assertion한 뒤 최종 checks에 도달했다. 별도 읽기 snapshot relation, evaluation-input-only, pending task의 outcome unknown/quality null/elapsedMs null/acceptanceRef null을 확인했다. 숫자 성과·가격·실행 성공을 만들지 않는다.

백업 SHA1dfb3f30debd30feffca27360785d148c2ef638705431480f9d7df7d6a0be500와 result 일치, readonly integrity_check=ok. 독립 counts task1/run1, orchestration_attempt/session_handle/native_execution_identity/approval_event/acceptance_final 모두0. 원래 합성 준비만 존재한다.

## 화면과 격리 설정

3 PNG를 직접 확인하고 checks의 각 SHA와 대조했다. notice.png는 별도읽기/원본digest/한국어 권한제한 설명, unknown 결과와 nullable 측정을 보여준다. outcome.png와 null-measurements.png는 동일 SHA로 정확히 같은 화면이며 서로 다른 증거3개라고 세지 않는다. 총2 unique views에서 평가 입력 전용/승인대기/미확인 비용/quality·elapsedMs null/not-convertible 및 sourceDigest가 읽힌다. 화면 전체 보고서 구조나 다른 창 크기까지 검증했다고 하지 않는다.

checks는 javascript=false/nodeIntegration=false/preload=false, inspection은 node/cue undefined/scripts0/overflowfalse, CSP script/connect none이다. 테스트 관찰은 privileged QA CDP를 통해 수행했으며 일반 문서 JS를 활성화한 것이 아니다. fetchCalls0이며 실제 모델/helper/executor 호출 증거는 없다.

## 실패 이력과 제한

attempt1은 report-window timeout 뒤 finally detach에서 destroyed 오류가 남았고 PNG0/최종checks없었다. attempt2는 page rAF await 제거, host100ms settle, 좁은 phase 및 guarded detach 후 성공했다. 이것이 관찰 경로 가설을 뒷받침하지만 attempt1 broadphase만으로 정확히 rAF에서 멈췄다고 소급 확정하지 않는다. 두 실제 QA attempt 상한은 모두 소비됐고 성공 반복은 하지 않는다.

읽기 감사 자체의 첫 hash 반복은 before.json의 fixture alias를 파일 경로로 오인하여 ENOENT가 났다. 별도 alias 매핑을 확인해 fixture/proof를 실제 경로로 대조했으며 평가/프로세스 재실행은 없었다. 이 오류는 제품 QA 실패가 아니다.

이 PASS는 prepared synthetic report 표시이지 S5 실제 품질/시간/금액 측정, 정책 비교/승격, 실제 모델 workflow/cleanup/acceptance 성공이 아니다.

## 주요 증거 SHA-256

| 파일 | SHA-256 |
|---|---|
| final-verdict.json | A4CEA787734DD64CB74B4B86906CADD08F0E8BC35C146A251A0844B2113FB65B |
| checks.json | 644F16589E2A8CFCF59882BC0AA9C2335F93868D5F7ED8362C56B5AAE0DBA049 |
| result.json | 071EC4B0D8455CDFF3466CBE1968D1DFF4FD96639428587AF4568709BE580AA9 |
| artifact.json | 1B03F78C02DC520F7E888761C7AA756E30F5B85F8869ACB395401900DA4A1CBA |
| inspection.json | D6A0FF16AD9AF9E8FCA8B07667A2B8D6AFE3FE809DC921AEDC4A45F26F46EFB7 |
| ledger-backup.sqlite | 1DFB3F30DEBD30FEFFCA27360785D148C2EF638705431480F9D7DF7D6A0BE500 |
| before.json | 07ACF99EE935CA545AE6958F8DD77ED383CD8D6D2C8506DD2E6D7B849C1C920B |
| after.json | 07ACF99EE935CA545AE6958F8DD77ED383CD8D6D2C8506DD2E6D7B849C1C920B |
| notice.png | 11EE8081DA465E737CED280CFE6958A0E554465879717D68ACF86A2BD1BD8E29 |
| outcome.png | D52E4B8E9B326BA981CEE7181A5EDC82D313F885777F76FC07FF06C27314CD02 |
| null-measurements.png | D52E4B8E9B326BA981CEE7181A5EDC82D313F885777F76FC07FF06C27314CD02 |
| owned-state.json | 4F8321921293F8929CF9AC5481CD7031C53DF95EEF963FA797FA854B3BAE9443 |
