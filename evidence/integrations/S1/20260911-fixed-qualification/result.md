# Fixed qualification client — native maker record

완료 기준: production controlBundle과 fixed diagnostic hash를 결합한 별도 native qualification 경로. 임의probePath/code/module 금지, model/checker 동일 실행recipe와 production client/core staging, 실제filesystem denial+Job causal event 및 정상production/cancel/hardkill 회귀. 진단별 교정2 상한; 최초 gate5PASS, 현재 교정없음. 자격발급은 별도 collector/independent judgment다.

## Native API
별도 -QualificationHarness. 기존 ProbeHarness와 혼합금지. 생산 controlBundle,clientKind,diagnosticClientSha256,qualificationOperation 필수. 진단 스크립트는 패키지 고정 model-boundary-probe.cjs만 선택한다. broker모드는 받지 않는다.

request JSON은 cue-boundary-probe-v1 protocol과 operation(process-limit 또는 filesystem-network). process-limit은 이 두 필드만 허용한다. filesystem-network는 outsideFile,port,nonce를 추가한다. outsideFile은 hostTEMP/Cue.Qualification.<1..64 alnum-hyphen>/outside.txt의 canonical existing nonreparse sentinel만 허용한다. listener는127.0.0.1고정, port1..65535,nonce alnumhyphen1..128. 이는 hostcollector전용입력이며 사용자workspace/auth파일 입력권한이 아니다.

filesystem probe는 taskRoot/host-ready를 최대6초 기다린다. host는 nativePID 확인 후 profile/probe-existing.txt 및 실제profile/Temp/probe-existing.txt를 seed하고 ready를 쓴다. qualificationHoldAfterExit:true이면 childexit 후 CUE_MODEL_PROBE_WAIT=host-inspection을 출력하고 최대5초 동안 taskRoot/host-inspection-complete를 기다린다. timeout은 기존 finally/guardian cleanup을 거친다.

## recipe와 보고
production client는 production-client.cjs로 별도staging되어 pin검증되며 executing client.cjs는 fixed diagnostic hash로검증된다. checker core도 기존 verification/json-format-checker.cjs로 함께복사/검증한다. suspended seal/reverify, actualtoken/job/exemption,guardian,stdio handlelist는 기존경로다. model은 기존flags, checker는 동일 --preserve-symlinks추가recipe다.

native boundary는 controlStatus=qualification-pinned, recipeVersion=cue-client-recipe-v1, productionClientSha256, diagnosticClientSha256, executing clientSha256, core/guardian/bundle hash와 staticflag를 구분한다. 기존 production executor matcher는 qualification-pinned를 거부한다. old ProbeHarness는 계속 diagnostic-unpinned이며 새 pin authority로승격하지 않는다.

## 실제 결과
- build exit0.
- fixed qualification5PASS15.32s: 양kind Job ACTIVE_PROCESS_LIMIT message3/count1/PID연계, 양kind filecreate/append/overwrite/delete EPERM/EACCES 및 hostpostexisting unchanged/newfileabsent, hostTCPpre/postnonce와 childnonce미수신, 실제cap0/token/job/exemption 관측.
- missingpins/unknownoperation/임의probePath/잘못된diagnostichash/비fixtureoutside를 실제child PID 이전 거부.
- TCP timeout은 OS errno/전체network protocol deny의 증명으로 변경하지 않는다. 기록은 controlled same-listener observation이며 full provider boundary 자격아님.
- 새 client/probe hash는 source-hashes.json. NoQwen/providercalls/globalpolicy/ACL변경. 독립검토전 maker record.

기존 measurement factory의 probe manifest에 새 테스트/collector를 등록하는 작업은 별도후속이다. full compiled/source file closure에는 newclient가 자동포함되지만 이 사실만으로 probe semantics 또는 자격이 성립하지 않는다.

최종 production 회귀: npx vitest run test/integration-isolated-json-checker.test.ts test/integration-isolated-local-model.test.ts test/integration-model-boundary-hardkill.test.ts test/integration-model-control-bundle.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 : 4files16PASS29.00s. 총21PASS/build0. 제품수정교정0회.
