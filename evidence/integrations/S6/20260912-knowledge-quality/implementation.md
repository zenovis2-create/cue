# S6 Unit 1 — authored bilingual retrieval quality gate

작성일: 2026-09-12

## 범위와 사전 고정

이 결과는 고정된 소규모 authored fixture의 검색 품질만 측정한다. 실제 사용자·production 검색 품질, remote source 진위, 파일 내용의 secret 의미 탐지를 주장하지 않는다. 모델/provider/native process/network/user home은 사용하지 않았다. 기존 `20260911-knowledge-holdout`의 immutable FAIL 자료와 체크리스트는 수정하지 않았다.

편집 전 done은 다음으로 고정했다: baseline 1회와 deterministic normalized token-proximity ranking 가설 1회, 매 pass에서 fixed quality test와 기존 knowledge regression test 실행, recall 개선·양언어 기준·FP 비증가 중 하나라도 실패하면 `lexical.ts` 변경을 버리고 unit FAIL 기록.

| 고정 입력/소스 | SHA-256 |
|---|---|
| `corpus.json` | `8ed7d28d86b2efd1bc97389116e170b9d4c6e9cd37e8551d01e32646e1e36af4` |
| `queries.json` | `067b9de02cdbd75709d275a48972f6eb24881ee3248bf4c5f05fc697b8c3f9a8` |
| `contract.json` | `5b47f8a21bac64156def50b7cce95ba8da76b1ad09c4986ca71cdd11684c7254` |
| baseline `lexical.ts` | `b1c26bafc0a5671564a54ddeb0ce587d5b7f1422ad711fc56eaac32b871b6e21` |
| final `lexical.ts` | `d09c6ddd9b37748f22124e4179140f7f751eefe828f7b0b7597a583925ced5d1` |
| quality test | `528322048c377742d670e7a076e55a102bc14750d1d90324efedc3adfb941b4e` |

Corpus와 queries SHA는 contract에 사전 고정했고 baseline 실행 뒤 relevance, fixture, threshold를 변경하지 않았다.

## 측정 결과

Baseline은 제품 수정 전 `S6_QUALITY_BASELINE=1`로 정확히 1회 실행했고 contract의 frozen 값과 일치했다. 제품 가설은 붙여쓴 한국어 질의와 띄어쓴 문서 구절을 같은 정규화 구절로 다루고, 모든 질의 토큰의 문서 내 span이 작을수록 높은 점수를 주는 하나의 deterministic phrase/proximity 방식이다. 동점은 기존 package/resource key 순서를 그대로 사용한다.

| 측정 | baseline | final |
|---|---:|---:|
| macro recall@3 | 0.8181818181818182 | 1.0 |
| English macro recall@3 | 0.8 | 1.0 |
| Korean macro recall@3 | 0.8333333333333334 | 1.0 |
| all-query FP queries | 9 | 9 |
| negative-query FP queries | 2 | 2 |
| true positives | 11 | 15 |
| false-positive hits | 15 | 13 |
| false negatives | 4 | 0 |
| provenance/UTF-8 byte checks | 26 | 28 |

Final은 contract의 macro recall@3 `>= 0.95`, English `>= 1.0`, Korean `>= 0.91`, all-query FP `<= 9`, negative FP `<= 2`를 모두 통과했다. 반환 hit마다 선언 source, revision, manifest/content SHA, `reference-only`, `declared-not-remote-verified`, 원본 UTF-8 byte slice와 frozen 결과를 검증했다. 기존 strict snapshot/proxy/accessor/bounds와 stable tie regression도 통과했다.

## 검증

- `$env:S6_QUALITY_BASELINE='1'; npx --no-install vitest run test/integration-knowledge-quality.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — PASS, baseline 1회.
- `npx --no-install vitest run test/integration-knowledge-quality.test.ts test/integration-knowledge.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — PASS, 2 files / 7 tests.
- `npx --no-install tsc --noEmit -p tsconfig.json` — PASS.
- `npm run build` — PASS.
- owned source/test/fixture 대상 `git diff --check` — PASS, 진단 0.

판정: `evaluationComplete=true`, `qualityGate=true` (authored fixed fixture 범위에 한정).
