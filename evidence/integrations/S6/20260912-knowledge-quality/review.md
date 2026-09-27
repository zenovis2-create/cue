# S6 Unit 1 — 독립 bilingual quality review

판정: **PASS**. 이 판정은 18문서/15질의의 authored fixed fixture에만 적용된다. 실제 사용자 검색 품질, production/semantic retrieval, 원격 source 진위, 파일 내용의 secret 의미 탐지에 대한 증거는 아니다.

## 동결·순서·변경 이력

구현자의 요약 수치를 신뢰하지 않고 파일 바이트, 파일 시각, 로컬 실행 event, 보존된 baseline source preimage와 현재 제품을 대조했다. UTC 순서는 corpus/queries 작성 `2026-09-12T01:23:13`, contract 작성 `01:24:26`, quality test 작성 `01:25:22`, baseline test process `01:25:28`, 단일 product patch `01:26:23`, final 2-file test `01:26:30`, tsc/build `01:26:39`, receipt 작성 `01:27:22–01:27:32`다. Event log에는 baseline 명령 1회, `lexical.ts` patch 1회, final 명령 1회가 있고 baseline 뒤 fixture/relevance/threshold 수정은 없다. 파일 creation/last-write 시각도 이 순서와 일치한다. 이는 로컬 실행 추적이며 외부 timestamp authority나 독립 서명은 아니다.

Contract의 corpus/query pin은 현재 바이트와 정확히 일치한다. 18개 corpus ID는 유일하고, 15개 query ID도 유일하며, relevance ID는 모두 존재하고 중복이 없다. 구성은 positive 11(EN 5, KO 6), negative 4, CamelCase/숫자 식별자 2, 명시 hard-negative 2다. Relevance는 결과에서 생성되지 않고 baseline 실행 전 queries에 기록되었다. 다만 사람이 작성한 intent label이며 blind 사용자 판정은 아니다. 특히 `parser cache`와 `승인 정책`을 empty-relevance hard negative로 정의한 것은 이 계약의 의도적 기준이지 일반 relevance 사실이 아니다.

Baseline source는 product patch 직전 읽기 event의 원래 7,549바이트를 복원했고 SHA-256 `b1c26bafc0a5671564a54ddeb0ce587d5b7f1422ad711fc56eaac32b871b6e21`와 일치했다. Final diff는 이 preimage에 대해 정확히 하나의 deterministic phrase/proximity 변경이다: token end offset 추가, 공백으로만 이어진 한글 token의 compound match 추가, 일치 token-position span bonus 추가. 기존 `packageId + NUL + resourceId` 동점 정렬은 그대로다. 별도의 scorer, fallback, model/embedding 또는 threshold-dependent 분기는 없다.

## 독립 재계산

동일한 frozen corpus/query/k=3에 baseline preimage와 현재 compiled product를 각각 실행하고 query별 ID에서 TP/FP/FN을 다시 합산했다.

| 측정 | baseline | final | gate |
|---|---:|---:|---:|
| TP / FP / FN | 11 / 15 / 4 | 15 / 13 / 0 | 관찰값 |
| macro recall@3 | 0.8181818181818182 | 1.0 | >= 0.95, baseline 초과 |
| English macro recall@3 | 0.8 | 1.0 | >= 1.0 |
| Korean macro recall@3 | 0.8333333333333334 | 1.0 | >= 0.91 |
| FP가 하나 이상인 전체 query | 9 | 9 | <= baseline 9 |
| hit이 있는 negative query | 2 | 2 | <= baseline 2 |

Contract에 적힌 baseline과 receipt의 confusion/recall 수치는 독립 결과와 모두 일치한다. Final은 recall 기준을 모두 충족하고 FP-query 및 negative-FP-query를 baseline보다 늘리지 않는다.

## 제품 경계와 회귀

Source inspection과 7개 실제 테스트에서 다음을 확인했다. 모든 hit은 선언 source/revision/manifest SHA/content SHA와 `authority: reference-only`, `sourceVerification: declared-not-remote-verified`를 보존한다. BOM 복원은 원래 byte length와 SHA가 함께 증명될 때만 허용되고, excerpt는 원본 UTF-8 byte slice와 일치한다. Hit/result 배열은 frozen이며 반복 검색과 동점 key 순서가 안정적이다. Strict frozen plain-data 검사, proxy/getter/accessor 회피, duplicate identity, content integrity, package/document/byte/token/query/limit bounds도 기존 회귀에서 통과했다. 새 diff는 이 경계를 완화하지 않는다.

기존 `20260911-knowledge-holdout/results.json`은 여전히 `evaluationComplete=true`, `qualityGate=false`이며 review에 기록된 다섯 파일 해시가 모두 그대로다. 새 authored v2 PASS는 그 FAIL을 덮어쓰거나 PASS로 재라벨링하지 않는다.

## 실행 gate

- `daemon`에서 combined Vitest: PASS, **2 files / 7 tests**. 독립 관찰 final은 TP/FP/FN `15/13/0`, provenance/byte checks 28.
- `daemon`에서 `npx --no-install tsc --noEmit -p tsconfig.json`: PASS.
- `daemon`에서 `npm run build`: PASS.
- owned source/test/fixture `git diff --check`와 trailing-whitespace 검사: PASS, diagnostics 0.

## 현재 해시

| 파일 | SHA-256 |
|---|---|
| `daemon/src/knowledge/lexical.ts` | `d09c6ddd9b37748f22124e4179140f7f751eefe828f7b0b7597a583925ced5d1` |
| `daemon/test/integration-knowledge-quality.test.ts` | `528322048c377742d670e7a076e55a102bc14750d1d90324efedc3adfb941b4e` |
| `daemon/test/integration-knowledge.test.ts` | `a231fc55a086c0da6db70437207ceb669aebf2f4887d5cbd02924f6bbba2ca31` |
| `contract.json` | `5b47f8a21bac64156def50b7cce95ba8da76b1ad09c4986ca71cdd11684c7254` |
| `corpus.json` | `8ed7d28d86b2efd1bc97389116e170b9d4c6e9cd37e8551d01e32646e1e36af4` |
| `queries.json` | `067b9de02cdbd75709d275a48972f6eb24881ee3248bf4c5f05fc697b8c3f9a8` |

기존 holdout hashes: contract `5bfb386902e0d8c97535edc6c21ca1d3424e114aeefe2222ddb44cd9a3ab7d9c`, corpus `b55fb2c1d05ec5079bc08c30827f24eef98a2ca46724c94d6b141744cf2670cc`, queries `63122708be063f8f721da185d480d471e5dc19c7733d30a9e6c4f7ef9b3994b9`, results `e313db123811edfd67fa99285df825bfe4afc6b228ed1fe5d055d3f6342c40c1`, review `7404870dc2871c0819e9d9fa265b7f7ebcbcbbe69ffe45c18726abc3b93053c2`.
