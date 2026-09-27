# 역사적 소스 snapshot 비교 구현

2026-09-11 maker admission_impl. 소유 변경: daemon/src/reports/comparison.ts, daemon/test/integration-report-comparison.test.ts, scripts/reuse/cue-source-comparison-report.mjs 및 이 증거 폴더. app/renderer와 원본 source-structure/source-matrix 산출물은 변경하지 않았다. 모델/네트워크/새 의존성 호출0.

검증: daemon `npm run build` exit0; `npx --no-install vitest run test/integration-report-comparison.test.ts --reporter=verbose` 5 PASS,21:38:51. root `node --check scripts/reuse/cue-source-comparison-report.mjs` 및 실제 스크립트 실행 exit0. 테스트는 pinned source/result 바이트·원래HTML/IR receipt 변조, 무변경, 동일경로 해시 변경, 노드 추가/삭제·관계 endpoint 변경, 악성 label 탈출·CSP를 확인한다.

비교 입력은 104파일/212관계 및109파일/224관계의 실제 보존 source.json이다. 고정 source/result 파일SHA를 먼저 확인하고, 재구성한 canonical IR의 hash/bytes와 원래HTML의 hash/bytes를 과거 receipt와 대조했다. renderer가 바뀌었으므로 과거HTML을 현재 renderer로 다시 생성해 같은 것으로 주장하지 않는다. 입력핀은 로컬 보존 자료의 byte identity이며 전자서명·현재 source 검증·clean Git 증명이 아니다.

결과: 노드5개, 관계12개, 파일17개 차이. 파일 목록은 같은 경로에서 내용hash만 바뀐 항목도 before/after SHA와 함께 표시한다. 요약은 최대12개 경로순 파일 변경을 보여주며 잘린 나머지와 전체 변경·양쪽 원본 노드/관계는 native details 안에 보존한다. 스크립트/외부asset/IPC 없이 고정style SHA CSP를 사용한다. 문서의 source-declared-unverified와 역사snapshot 표시는 유지한다.

산출물 cue-source-comparison.html: SHA256 `790f86cbdf038a61f4eca3cf4b742d6e9ed34b2fac985ee8e9f093292b157aef`,95898bytes. 소스 `259D522D854BC9EB4F0149513637F75E008170C5391AC0519D7F2240C821D00E`, 테스트 `113D69328160E94058243FC22E3E0227B61B90BFFC1341AF3DEDA478FCFD43BB`, 스크립트 `AA73C47361DA53CF8C8011E7F348C4E04D2FD7225452B1B067290EA80D356B5C`.

독립 코드 검토와 실제 브라우저/시각 검증은 후속 게이트다. 현재 runtime 동작·안전·성능·영향을 판정하지 않으며 전체 S7 완료로 처리하지 않는다. 파일은 별도 호스트 개발자 증거 폴더에 exclusive 임시작성·fsync·readback 후 교체했으며 directory crash durability는 보장하지 않는다.
