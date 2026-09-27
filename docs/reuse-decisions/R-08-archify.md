# R-08 — Archify 제한 채택과 읽기 전용 보고서 계획

2026-09-11 · 결정: **limited**. 전달 계약과 안정된 ID 기반 비교 원칙을 참고한다. 고정 CLI/렌더러/스킬/브랜드·폰트 자산은 편입하지 않는다. 이 기록은 S7 완료나 Archify 검증 통과 기록이 아니다.

## 고정 근거와 경계

검토 revision: `18911058008f17dc065af23a2cdc9bfeff6d3f7a`. 현재 main의 기능 설명을 이 revision의 보증으로 사용하지 않는다. 설치·upstream 코드 실행·모델 호출은 하지 않았다.

- [MIT 라이선스](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/LICENSE): Archify/Cocoon AI 저작권과 MIT 조건 확인. 나중에 코드를 복사한다면 원문 고지를 보존해야 한다.
- [제3자 고지](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/THIRD_PARTY_NOTICES.md): 브랜드별 조건과 JetBrains Mono OFL이 별도로 존재한다. 이번 자체 보고서는 브랜드 마크/내장 폰트를 가져오지 않는다.
- [CLI](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/bin/archify.mjs#L61-L68): `runNode`가 `spawnSync`를 사용한다. [architecture renderer](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/renderers/architecture/render-architecture.mjs)는 shared CLI 및 자산 계층을 가져오고 process argv를 읽는다. 조사한 진입점은 부작용 없는 문자열 렌더 API로 바로 교체할 수 없다.
- [선언형 스키마](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/schemas/architecture.schema.json), [delta](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/delta/architecture-delta.mjs#L53-L105): 구조 입력과 렌더를 분리하고 안정된 식별자로 정규화·비교하는 원칙을 채택한다. Cue IR은 별도 schemaVersion과 출처를 갖고 Archify 호환이라고 표시하지 않는다.
- [전달 계약](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/references/delivery-contract.md): 동일한 입력/산출물 bytes의 hash, 실패 시 이전 산출물 보존, 결정적 검사·브라우저 증거·시각 검토의 분리를 참고한다. upstream deliver/visual-check를 실행하지 않았으므로 해당 결과는 **not-run**이다.

## 현재 접점과 대안

`daemon/src/reporting.ts`는 완료/차단 텍스트와 인수 상태를 반환한다. 이를 유지한다. `daemon/src/ui/orchestration.ts`는 원장 transaction에서 승인 plan digest, 정책, 단계/시도, 예산 불확실성과 역사적 인수 기록을 투영한다. 첫 보고서의 관측 입력은 이 읽기 전용 투영을 재사용한다.

| 대안 | 판단 |
| --- | --- |
| 고정 Archify CLI 전체 호출 | 현재 자식 프로세스 경계와 충돌하므로 보류 |
| renderer 및 자산 묶음 이식 | import 부작용/출력/자산/업데이트 경로의 별도 검증 필요, 이번 단위에서 제외 |
| Cue 소유 IR + 순수 offline HTML | 작은 경계로 구현 가능. 기존 원장 투영 재사용, 외부 코드 복사 없음 |

이 선택은 측정된 개발비 절감이나 시각 품질 우수성을 주장하지 않는다.

## 구현 상태 — 기반 모듈 검증, 전체 S7 미완료

부모 승인 후 IR/HTML 기반 모듈이 build 및 독립 테스트 5개를 통과했다. 후속 `reports/delivery.ts`는 호스트가 소유한 고정 폴더에서만 bounded report ID를 받아 입력/HTML 재검증, exclusive 임시 파일, fsync, readback hash와 rename을 수행한다. 실패 주입과 경로/junction 거절 테스트 12개가 통과했다. 폴더/상위 경로를 비신뢰 프로세스가 변경할 수 없다는 호스트 전제가 필요하며 일반 파일시스템 sandbox를 제공하지 않는다. Windows 디렉터리 metadata의 crash durability는 보장하지 않는다. 앱 연결과 합성 원장 산출물의 브라우저/시각 검증은 후속 증거로 통과했다. 실제 source 추출은 미완료이고 upstream CLI 검사는 현재 선택에서 N/A다.

소유 파일: 신규 `daemon/src/reports/ir.ts`, `daemon/src/reports/html.ts`, `daemon/test/integration-reports.test.ts`만. 기존 reporting/main/IPC에는 연결하지 않는다.

1. **AR-01 관측 보고서:** `readRunReport(db, runId)`는 같은 읽기 transaction 안에서 기존 observation DTO와 승인 plan의 의존 관계를 가져온다. 누락 plan은 null. 단계 상태는 observed, 의존 관계는 planned로 명시하며 관측된 호출 순서를 추론하지 않는다. run/plan/policy digest와 bounded 단계·시도 이력, 잘린 이력 표시를 포함한다. raw payload/경로/credentials/자유형 활동 상세를 노출하지 않는다.
2. **AR-02 구조 입력:** 호스트가 제공하는 제한된 source snapshot(명시적 revision, repo-relative path, 내용 hash, 선언된 nodes/edges)을 검증·정규화한다. 파일 내용을 자동 추론하거나 임의 경로를 읽지 않는다. source-declared 관계와 observed runtime 관계를 혼동하지 않는다. source hash는 구조 의미의 진실성을 입증하지 않는다. 실제 Cue 구조 추출/고정 소스 검증은 후속 단위다.
3. **AR-03 비교:** 같은 report kind/identity의 안정된 ID를 비교해 added/removed/changed만 출력한다. 서로 다른 run/repository 또는 provenance 종류의 비교는 거절한다. 전후 digest를 보존하고 성능·영향·보안 판정은 생성하지 않는다. 승인 보조 그림은 actual approved plan 관계만 사용한다.
4. **HTML:** 순수 `renderReportHtml(ir)`가 고정된 스타일과 escaped 텍스트를 가진 self-contained 문서를 반환한다. 스크립트/링크/외부 자산/네트워크/IPC 없이 `default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` CSP와 hash로 허용한 고정 style만 사용한다. system font, 문서 내 정적인 관계 목록/도표와 접근 가능한 표를 제공한다. 악성 ID/텍스트는 문자로 표시한다.
5. **전달 경계:** 정규 IR bytes와 HTML bytes의 SHA-256/크기를 반환한다. 별도 delivery factory가 호스트의 고정 출력 폴더를 캡처하며 호출자는 경로를 지정하지 못한다. 원자적 파일 교체와 실패 시 last-good 보존, 별도 무권한 앱 보고서 창 연결은 검토를 통과했다.

## 완료 게이트와 한계

매 교정마다 daemon에서 `npm run build` 및 `npx --no-install vitest run test/integration-reports.test.ts --reporter=verbose` exit 0. 최대 2회 교정, 실패 시 새 가설 또는 범위 재계획. 실제 SQLite에서 observed/planned 분리, retry 이력/unknown 비용/인수 미확인, canonical hash, 악성 HTML 탈출 방지, CSP, ID 충돌/무효 연결, source provenance 비교 거절을 시험한다. 산출물 hash를 묶어 독립 검토를 요청한다.

후속 [전달 검토](../../evidence/integrations/S7/20260911-report-delivery/review.md)에서 원자적 교체와 실패 시 last-good 보존을, [앱 검토](../../evidence/integrations/S7/20260911-report-app/review.md)와 [실제 Electron/시각 검토](../../evidence/integrations/S7/20260911-report-app/electron-review.md)에서 동일 원장의 합성 상태 표시와 별도 창을 확인했다. 현재 선택에는 upstream CLI가 없으므로 자식 프로세스·upstream deliver/visual-check는 **N/A(미편입)**다. 보존된 산출물의 upstreamValidation:not-run은 실행하지 않았다는 사실이며, 이를 PASS로 바꾸지 않는다. 나중에 CLI를 편입하면 해당 게이트를 다시 적용한다.

AR-02 실제 source 추출과 코드 revision 근거 검증, 실제 구조/비교 산출물은 남아 있다. 현재 표/관계 목록과 선언 소스 fixture만으로 다이어그램 요구 전체를 충족했다고 보지 않는다. 순수 모듈이나 제한된 앱 fixture 통과만으로 S7 전체 체크를 완료하지 않는다. 그림은 실행 권한·작업 완료·실제 안전·효율의 증거가 아니다.
