# 선택 설명 DTO 독립 검토

판정: PASS — 소스 수준의 historical projection 단위. Reviewer /root/contracts_review, maker /root/reuse_pure. 제품 소스/빌드 수정0, native/model 호출0. 완료 기준: strict store 소비, bounded projection, legacy/invalid 구분, private/pathlike 정보 제외, 읽기 무변경, 집중 gate와 타입 검사. 독립 교정 요청0/상한2.

## 확인 결과

- orchestration.ts:54–78은 createAttemptDecisionStore.read만 사용하고 현재 runId를 대조한다. 동일 attempt는 호출 내 cache에서 공유한다. 현재 관측·selector·재실행 callback이 없다.
- 저장된 값은 recorded, 봉인된 legacy만 legacy-not-recorded, missing/corrupt/계보 오류는 invalid, 시도 없는 단계는 not-started다. catch가 invalid를 legacy나 정상 선택으로 바꾸지 않는다.
- monetary는 저장된 mode/reason/score, local은 고정 run policy mode와 fixed-pair-eligible/not-performed를 보여준다. authority는 historical-explanation-only이며 현재 admission/cleanup/acceptance를 부여하지 않는다. local eligibility 문구는 이 authority 아래의 과거 선택 이유이다.
- 후보 assessments는 strict store 전체 검증 후 최대50개 사본만 공개한다. totalAssessments/truncated는 전체 원래 개수를 유지한다. selectedId는 별도여서 상위50개에 없는 선택도 잃지 않는다. 배열/항목/exclusions 모두 freeze.
- selectionId는 128자 opaque 영숫자/dot/underscore/hyphen만 공개하며 path/URL형은 null. raw payload, private source/estimate/reservation은 새 DTO에 포함하지 않는다. 기존 stage/history의 별도 식별자 필드 전체를 재설계한 보안 감사는 아니다.
- 단계와 과거 시도 양쪽에 같은 설명 DTO가 연결된다. UI display/새 IPC 추가는 이 단위에 없다. 읽기 total_changes 불변, runtime start 추가0, unknown cleanup와 acceptance unverified 유지가 실제 SQLite fixture에서 확인됐다.

## 독립 게이트

```text
cwd C:/Users/User/cue/daemon
npx --no-install vitest run test/integration-selection-explanation.test.ts test/integration-observation.test.ts test/integration-local-observation.test.ts test/integration-observation-core.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-12 00:58:32 KST: 5 files/49 PASS/exit0/5.04s
npx --no-install tsc --noEmit -p tsconfig.json
exit0
```

동일 타입 검사 명령에 guard 경고가 있었지만 이번 새 변경 단위의 필수 gate는 exit0으로 실행됐다. 더 반복하지 않았다. Maker의 type fixture 교정 이력은 result.json에 보존한다.

신규 source-import projection 테스트4개가 실제 새 DTO를 검증한다. 기존 driver/core 테스트는 현재 compiled code를 사용할 수 있으므로 이것만으로 신규 compiled propagation을 입증했다고 하지 않는다. 부모가 다른 단위와 조율한 build 이후 실제 앱 연결 확인은 별도다. 실제 UI/모델/최종 workflow 완료 주장 없음.

## 현재 SHA-256

| 파일 | SHA-256 |
|---|---|
| daemon/src/ui/orchestration.ts | 1CAD6FC8623D1C07F1AFB2CF64C17C8BB22A200BC7C9A30B181292ECC48F701D |
| daemon/test/integration-selection-explanation.test.ts | CB0CBC818EB71C92122AAE1F9D38CD1189D80C290F889DF84D585C4012293E81 |

## Compiled propagation 후속 독립 감사

판정: PASS (maker 실행 증거 + 좁은 source/hash 감사). 기존49 독립 gate를 반복하지 않았다. integration-local-driver.test.ts:13은 실제 dist UI projection을 import한다. :56 이후 fixture는 실제 app driver의 prepare/approve/start 및 같은 ledger의 producer/checker 두 시도를 실행하고, :70에서 그 DB를 compiled projection으로 읽는다. 양 stage의 recorded/local-invocation/not-performed/정확한 selectedId/historical authority와 total_changes 불변을 assertion한다.

Maker compiled-result.json은 해당 local-driver4 PASS/exit0를 기록한다. 독립적으로 현재 test와 compiled projection/engine/attempt store4해시 및 기존 projection source/test2해시가 각 result 기록과 모두 일치함을 확인했다. dist 소스 내용은 읽지 않고 hash만 검사했다. 독립 native/모델/build 실행0, 추가 테스트 실행0.

실제 앱 seam은 app/core.mjs:11의 compiled readOrchestrationSnapshot import와 :948의 completionCard projection 호출이다. driver.snapshot에 selection 필드가 있다고 추론하지 않는다. 이번 fixture는 compiled engine/store/projection 연결이며 실제 renderer 표시·live admission·전체 workflow 성공 증거는 아니다. 이전 source-only 한계 중 compiled projection 연결 부분이 이 후속 증거로 보완됐다.

후속 test SHA B6CBFCBB13D4761AC50BA73767DA34B52255A06013FCF7175F6B51BEF9DB0C49.
Compiled projection SHA F431A4DEA55E3874953ED25EDBF4D92B63E77A204A31CE4C4FDABEA1977C788F.
Compiled engine SHA 10AA7D3FAE3776110071BC4A5368E4A279946371FD3D1AB8BEF30E577094BBE4.
Compiled attempt store SHA 4AF74009279333247D54B55AA5D74F5CA22DC7C7E26903540376CCAD0CF5FF1C.
