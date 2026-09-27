# 실제 작업 트리 정적 import 추출

2026-09-11 maker admission_impl. 제품 소스/설치/lockfile 변경 없음. `scripts/reuse/cue-source-structure-report.mjs`와 이 증거 폴더만 추가했다.

게이트: `node --check scripts/reuse/cue-source-structure-report.mjs`, `node scripts/reuse/cue-source-structure-report.mjs --self-test`, `node scripts/reuse/cue-source-structure-report.mjs` 모두 exit0. 첫 실제 실행에서 .d.mts를 일반 ts 모드로 지정한 오류가 나서 filename 기반 선언 grammar 추론으로 교정했다. declaration fixture를 추가한 뒤 통과했다. 단일 교정, cap2.

104개 실제 JS/TS 파일, 중복을 합친 관계212개. 소스 목록과 모든 읽은 파일의 내용 해시를 두 번 비교했다. 이 비교는 관측 사이에 바뀌었다가 원래대로 돌아오는 변경을 차단하는 OS snapshot은 아니다. 호스트 개발자 전용 도구이며 worker 권한이나 제품 내 source export를 추가하지 않는다.

파서는 설치된 Rolldown1.2.6 `rolldown/utils.parseSync`다. [공식 동기 JS/TS API](https://rolldown.rs/reference/Function.parseSync)와 [filename/선언 grammar 옵션](https://rolldown.rs/reference/Interface.ParserOptions)을 대조했다. 기존 TypeScript7.0.2는 JS AST API가 없었으며 추가 의존성은 설치하지 않았다. 파서 진입점/로드된 native binding의 실제 hash는 result.json에 있다. node_modules 내용은 출력하거나 조사하지 않고 승인된 hash만 계산했다.

고정 입력은 app, daemon/src이며 symlink는 skip 목록에 기록하고 루트 symlink는 거부한다. 제외 디렉터리로 내려가지 않는다. 파일256개/각1MiB/총32MiB, 디렉터리 entry8192개/import4096개/파일AST200000노드 상한 초과는 실패한다. 테스트는 실제 임시 파일에서 type import, 외부/비리터럴 구분, 선언 파일, 파일 변경, 목록 변경, junction skip, 부적합 이름 거부를 확인한다.

source.json과 HTML의 출처는 기존 IR 계약대로 source-declared-unverified다. result.json은 AST에서 관측한 정확한 import 문법/offset과 source-extension-counterpart-not-runtime-resolution을 별도 기록한다. app의 daemon/dist import는 source roots 밖으로 남기며 build 파일을 읽거나 실제 TS runtime resolution으로 추측하지 않는다. require는 이름의 lexical binding을 해석하지 않은 문법 관측이고, 비리터럴/외부/미해결을 숨기지 않는다. type/동적/require 관계를 실행 호출로 주장하지 않는다.

HTML은 기존 compiled IR/renderer/delivery로 생성했다. 아직 이 구조 산출물의 독립 코드 검토·브라우저/시각 검증은 받지 않았다. upstream CLI 검증은 미편입에 따른 N/A이며 clean Git revision, 실제 영향, 보안, 전체 AR02/03 완료를 주장하지 않는다.
