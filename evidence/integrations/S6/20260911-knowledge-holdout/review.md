# 작성형 검색 평가 독립 검토

판정: 결과 기록 및 산술 검토 PASS, 검색 품질 gate FAIL 유지. 품질 개선 완료로 체크하면 안 된다.

Reviewer /root/contracts_review. 평가 스크립트를 다시 실행하거나 검색기를 호출하지 않았다. 저장된 JSON과 원문 바이트를 읽어 해시/산술/인용만 독립 확인했다. 코드 수정, 모델/네트워크 호출 0. 단일 평가 상한 1을 유지했다.

## 결과 확인

16문서와 24질의는 고정 파일 및 스크립트 pin/results.bindings 해시와 모두 일치한다. 각 질의 ID/query/relevant는 고정 정답 파일과 일치하고, top3 ID 중복 없음, TP/FP/FN/recall 집계 일치한다. 모든 현재 bindings (compiled 파일은 바이트 해시만) 일치했다. 이는 평가 전에 동결했다는 계약과 결과의 일관성을 확인하며 독립적인 사전 타임스탬프 인증이나 새 빌드 동등성 증명은 아니다.

| 지표 | baseline | actual |
|---|---:|---:|
| positive macro recall@3 (18질의) | 5/18 = 27.78% | 18/18 = 100% |
| 전체 질의 중 하나 이상 오탐 반환 (24질의) | 2/24 = 8.33% | 4/24 = 16.67% |
| negative 질의 오탐 (6질의) | 0/6 | 0/6 |

이번 정답은 모든 positive가 relevant 문서 1개여서 5/18과18/18 표기가 macro recall과 같다. 다중 정답 평가로 일반화하면 안 된다. baseline 오탐은 q08,q18, actual 오탐은 q05,q06,q08,q18이다. 22개 actual citation의 ID 순서, 문서 SHA-256, BOM 포함 UTF-8 byteStart/byteEnd slice와 excerpt를 독립 재확인했다. provenanceChecksPassed=22와 일치한다. 원격 출처 진위는 검증하지 않는다.

qualityGate=false는 올바르다. recall은 증가했지만 전체 오탐 질의율 비증가 조건을 실패했다. evaluationComplete=true는 측정 완료이며 품질 통과가 아니다. 출처 검사는 코드에서 assert로 전부 성공해야 최종 qualityGate 계산으로 진행한다. 어떤 실패도 평가 완료로 바꾸는 fallback은 없다.

## 방법론 한계

- 작성자가 tokenizer/기존 테스트를 아는 작은 authored 자료이다. 독립 blind/production holdout이 아니다.
- exact case-insensitive 전체 query substring + ID순 top3 baseline은 공백/식별자 분해를 지원하지 않아 현재 lexical 구현에 유리하다. BM25/embedding/실사용 대비 개선을 뜻하지 않는다.
- parser와 cache 문서의 관련성은 작성한 intent 라벨이며 실제 사용자 판정이 아니다. easy negative 6개의 0건 결과는 실제 hard-negative 안정성을 입증하지 않는다.
- 기존 source fingerprint, results, corpus를 바꾸지 않고 실패를 유지해야 한다. 이후 다른 가설을 시험하려면 별도 사전 등록 평가 단위로 구분해야 하며 이번 결과를 덮어쓰면 안 된다.

독립 읽기 전용 Node audit exit0: bindings 해시, 정답/개별 집계, aggregate, 22개 byte/hash 인용, evaluationComplete=true 및 qualityGate=false assertion. 원래 평가 시각은 results에 2026-09-11T13:52:00.144Z–13:52:00.180Z로 기록되어 있다. 평가 재실행 0.

## 검토 해시

| 파일 | SHA-256 |
|---|---|
| scripts/reuse/knowledge-holdout.mjs | 8EAE85417AFE57EBA3E72E44FB51C8D7C3230EB80BA72E929FA83A912D9BE1D5 |
| evidence/integrations/S6/20260911-knowledge-holdout/contract.md | 5BFB386902E0D8C97535EDC6C21CA1D3424E114AEEFE2222DDB44CD9A3AB7D9C |
| evidence/integrations/S6/20260911-knowledge-holdout/corpus.json | B55FB2C1D05EC5079BC08C30827F24EEF98A2CA46724C94D6B141744CF2670CC |
| evidence/integrations/S6/20260911-knowledge-holdout/queries.json | 63122708BE063F8F721DA185D480D471E5DC19C7733D30A9E6C4F7EF9B3994B9 |
| evidence/integrations/S6/20260911-knowledge-holdout/results.json | E313DB123811EDFD67FA99285DF825BFE4AFC6B228ED1FE5D055D3F6342C40C1 |
