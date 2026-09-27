# 고정 작성형 검색 평가 계약

이 자료는 2026-09-11에 이 평가를 위해 작성한 작은 authored evaluation이다. 실제 사용자 자료, production holdout, 독립 blind holdout이 아니다. 작성자는 현재 tokenizer와 기존 테스트를 본 상태이다. 결과를 본 뒤 corpus/질의/정답/제품을 수정하지 않는다.

완료 gate: `node scripts/reuse/knowledge-holdout.mjs`의 고정 평가 1회, 결과 JSON에 개별 결과·출처 검증·지표·소스 해시 저장, 독립 리뷰. 시도 상한 **1**. 품질 악화나 실행 실패도 그대로 기록하며 유리한 재평가는 하지 않는다. 제품/빌드/설치 변경과 모델/네트워크 호출 0.

## 평가 전 동결

- corpus.json SHA256 `B55FB2C1D05EC5079BC08C30827F24EEF98A2CA46724C94D6B141744CF2670CC`
- queries.json SHA256 `63122708BE063F8F721DA185D480D471E5DC19C7733D30A9E6C4F7EF9B3994B9`
- lexical.ts SHA256 `B1C26BAFC0A5671564A54DDEB0CE587D5B7F1422AD711FC56EAAC32B871B6E21`
- packages.ts SHA256 `E58BB3015FCB134DB84A88B9FA049DD4F7CB2FC2509719509D9531A3C5E3924A`

16문서/24질의: 18개 positive, 6개 negative. 한글 복합어, CamelCase/acronym/SQL 식별자, 정상 구문, 중복·모호한 관련 문서, 무관 질의, UTF-8 BOM/emoji를 포함한다. relevance는 사용 의도에 따라 고정한 문서 ID 집합이다. 특히 API 정의와 cache/사용 예제 문서는 모호할 수 있으며 intent 설명은 검색기에 주지 않는다.

## 비교와 지표

동일 자료와 query, k=3을 사용한다. baseline은 query 전체의 case-insensitive exact substring을 본문에서 찾으며 ID 사전순 상위 3개다. 이는 매우 약한 baseline이며 공백과 식별자 분해를 지원하지 않아 현재 tokenizer에 유리하다. 해당 개선을 BM25/embedding/기존 제품 대비 개선으로 일반화하지 않는다. 쉬운 무관 negative 6개는 실제 hard-negative 분포를 대표하지 않는다.

- macro recall@3: positive query별 `검색된 relevant 수 / 전체 relevant 수`의 평균. negative는 분모 제외.
- false-positive query rate: **전체** query 중 top3에 irrelevant 문서가 하나라도 있는 query의 비율.
- negative-query false-positive rate: relevant가 없는 query 중 결과를 반환한 query의 비율.
- 각 baseline/actual ID 목록, TP/FP/FN, query별 recall을 모두 기록한다.

실제 createResourcePackages로 임시 자료를 읽고 actual createKnowledgeIndex로 검색한다. 모든 actual hit의 원본 UTF8 byte slice/excerpt, 전체 원문 SHA256, manifest/revision/source/reference-only provenance를 검사한다. BOM은 원래 bytes에서 계산한다. 출처 URL은 example.invalid의 선언이며 원격 확인을 주장하지 않는다.

결과는 `evaluationComplete`와 별도의 `qualityGate`를 가진다. 품질 gate는 recall 증가 AND 전체 false-positive query rate 비증가 AND negative false-positive rate 비증가 AND 모든 출처 검사 통과이다. gate 실패는 제품을 수정하거나 정답을 바꾸는 근거가 아니라 그대로 남길 발견이다. 현재 컴파일된 모듈을 실제 실행하며 소스/컴파일 산출물의 해시를 기록한다. 해시 기록은 별도 재빌드 동등성 증명은 아니다.
