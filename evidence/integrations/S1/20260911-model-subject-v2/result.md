# Model subject v2 qualification manifest integration

완료 기준: fixed diagnostic source, collector source, 각각 실제test를 필수 manifest에 포함; 변경시 probe/enforcement hash변화, 누락시 failclosed; focused tests/build0. 교정상한2, 제품교정0.

Version cue-model-subject-files-v2. source model-boundary-probe.cjs 및 model-qualification.ts를 SOURCE_REQUIRED와 probe-source 집합에 등록하고 enforcementSha256에도 결합했다. 실제 integration-fixed-model-qualification.test.ts 및 integration-model-qualification.test.ts를 PROBES_COMMON 필수목록에 등록했다. 두 소스의 compiled 상대파일도 기존 closure 검사로 필수다. optional missingcollector fallback 없음.

- focused4PASS5.49s: 각신규 source/test 변경이 probeSuiteSha256을 변경, source 변경은 enforcementSha256도 변경. 신규4파일 및 compiled2파일 누락거부.
- collector담당 broker_review가 source/test landed 및 type오류수정/build가능 통지후 npm run build exit0.
- collector의 별도 실제native기능 gate는 담당자가 진행중이다. 이번 manifest integration 성공은 collector 자체의 독립 기능승인이 아니다.
- 이전 actual273manifest는 이전버전의 역사적관측이며 변경/재발행하지 않았다.
- 측정 및 자격발급/Qwen호출 없음. source-hashes.json은 이 유닛2파일 해시만 기록한다.
