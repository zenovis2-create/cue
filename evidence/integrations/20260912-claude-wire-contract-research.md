# Claude wire contract research — 2026-09-12

판정: **limited(공식 문서 기반 설계 근거만) / 생산 어댑터·parser 코드 편입·활성화 defer**. 실제 CLI/auth/model 호출, 설치·패키지 다운로드, 제품 변경 없음. 기존 synthetic fixture7PASS는 실제 protocol PASS가 아니다.

## 출처와 버전 범위

계약 근거는 세 항목으로 제한한다.

1. [고정 공식 TypeScript SDK 저장소](https://github.com/anthropics/claude-agent-sdk-typescript/tree/80eebc4881da2f11140deb6114f4bceff8da704a): root tree는 examples/scripts/문서 등을 보여주며 이번 열람에서 실행 parser나 배포 SDK 타입 원본을 확보하지 못했다. README는 Commercial Terms 적용을 설명한다. 이 SHA는 CLI binary나 npm 배포 tarball의 SHA가 아니다. 재사용 가능한 permissive parser를 찾았다고 주장하지 않는다.
2. [공식 TypeScript 참조](https://code.claude.com/docs/en/agent-sdk/typescript): **이동하는 현재 문서**, 조회 2026-09-12. 웹 도구는 HTML 크기/markdown MIME 때문에 읽지 못해 같은 공식 URL의 `.md`를 메모리에서 읽고 네 메시지 절만 확인했다. 파일/패키지 설치 없음. SDK/CLI 버전별 필드 조건이 혼재한다. 문서가 v0.3.267와 v2.1.267의 관계를 일부 필드에서 설명해도, 우리 설치파일의 provenance를 증명하지 않는다.
3. [공식 output streaming 문서](https://code.claude.com/docs/en/agent-sdk/streaming-output): **이동하는 현재 문서**, 조회 2026-09-12. 이벤트 종류와 assistant/partial의 실제 공존 순서에 대한 근거다.

추가 역사 대조: R-02에 고정된 CLI SHA536a2e23d9e28586f81f17b3535281b5f2995a70의 공식 root tree도 읽었다. CLI parser 구현을 얻은 것은 아니며 이 조사에서 그 tree를 wire schema의 근거로 쓰지 않는다. CLI reference도 탐색했지만 최종 계약 근거에는 사용하지 않았다. [기존 R-02](../../docs/reuse-decisions/R-02.md)의 라이선스/버전 기록은 그대로 역사적 범위다.

## 확인한 필드 계약

다음은 TypeScript 참조의 요약이며 전체 schema 복사나 설치 버전 보장이 아니다. 정확한 식별자 발췌는 필요한 19개로 제한한다: `uuid`, `session_id`, `model`, `claude_code_version`, `apiKeySource`, `permissionMode`, `message`, `parent_tool_use_id`, `error`, `aborted`, `usage`, `modelUsage`, `total_cost_usd`, `stop_reason`, `terminal_reason`, `permission_denials`, `num_turns`, `structured_output`, `capabilities`.

| 메시지 | 관측된 공식 계약 | Cue 영향 |
|---|---|---|
| 초기화 | 세션/이벤트 identity, CLI 버전/선택 모델, cwd, 도구/MCP 상태, 인증 출처 및 권한 모드, customization 목록 등이 있다. 능력 목록은 확장 가능한 집합이다. | fixture처럼 네 필드만 exact 허용하면 정상 init도 거절한다. 원문은 비공개 host 검증 입력; 경로·인증 출처 UI 노출 금지. 허용 능력만 의존하고 미지 능력을 권한으로 해석하지 않는다. |
| assistant | SDK wrapper의 세션/부모 연결 및 메시지 객체, 선택적 오류/중단 표시가 있다. 메시지 객체에는 모델·content·stop reason·usage가 포함된다. | wrapper identity와 내부 message identity를 분리해 추적. 중단 표시/오류를 정상 텍스트 결과로 승격 금지. |
| partial | 원시 API stream event를 SDK가 세션/이벤트 identity와 함께 감싼다. 전체 텍스트가 아니라 delta다. | wrapper를 벗긴 raw API event와 혼동 금지. host attempt/session 및 message/block 상태 연결 필요. |
| result | success/error union. 세션/시간/턴수/stop/permission denial, 합계 usage 및 모델별 accounting, 선택 구조화 출력 등이 있다. 오류 subtype은 최대턴·실행오류·예산·구조화 재시도 한도 등을 구별한다. | subtype 한 필드만으로 성공 금지. 미지원/중단/도구지연 terminal은 별도 처리; schema는 버전으로 고정해야 한다. |

공식 참조는 main-loop usage와 query pipeline의 모델별 누적 통계를 구분한다. streaming input에서 후자는 누적이므로 여러 result를 더하면 중복 계산한다. 비용 합계는 추정치이며 청구서가 아니다. 누락/해석 미확정은 unknown으로 유지한다. [TypeScript 참조](https://code.claude.com/docs/en/agent-sdk/typescript)

## 실제 순서: synthetic assumption 폐기

부분 메시지를 켜도 완성 assistant와 final result는 계속 온다. 블록마다 완성 assistant가 발생하고, 같은 응답의 여러 블록은 같은 내부 message identity를 공유한다. 문서의 흐름은 메시지 시작 → 블록 시작 → delta 반복 → **완성 assistant** → 해당 블록 종료 → 다음 블록 → 메시지 수준 갱신/종료 → 필요하면 도구/다음 턴 → 최종 result다. [Streaming 문서](https://code.claude.com/docs/en/agent-sdk/streaming-output)

따라서 다음은 Cue 설계 추론이다.

- assistant와 partial을 양자택일로 거절하거나 둘을 문자열에 모두 append하면 안 된다. delta는 provisional 출력으로, 완성 block은 대조/정합성용으로 처리하고 identity+block 연결로 중복을 방지한다.
- 단일 block index0만 가정하지 않는다. 모델 전용 경로는 도구 block을 인식 후 거절해야 하며, 모르는 구조를 텍스트로 통과시키면 안 된다.
- final result text가 모든 assistant/delta의 단순 연결과 동일하다고 문서에서 보장하지 않는다. 그 등식을 성공조건으로 만들지 않는다.
- canonical JSON.stringify byte equality/고정 property 순서는 공식 계약으로 확인되지 않았다. 실험의 canonical JSON 제한은 실험에만 남긴다. UTF8/JSONL 크기·개수/EOF 보호만 이전 가능하다.
- 수신 순서는 host ordinal로 기록하며 공급자 timestamp만으로 재정렬하지 않는다. SDK API iterator의 문서 흐름을 CLI stdout의 버전별 완전한 보장으로 승격하지 않는다.

## 확보하지 못한 것

설치된 native CLI의 정확 hash와 배포 SDK 타입/parser 일치, 고정 버전 전체 raw-event union, 취소 직후 queued/residual event 처리, hooks/system 부가 메시지의 제한모드 동작, 필요한 auth 수단은 미확정이다. 공개 root에 원본이 안 보인다는 사실만으로 저장소 어디에도 없다고 단정하지 않는다. 이번 범위는 tree와 공식 문서 열람이며 tarball/credential/CLI introspection은 하지 않았다.

현재 자료로 literal field allowlist를 생산에 고정하거나 permissive unknown-pass parser를 만들지 않는다. 다음 단위의 시작 조건은 별도 허용된 **정확 SDK 배포 버전·무결성·타입 및 parser provenance** 확보와 라이선스/인증 경로 검토다. 실제 타입을 정당하게 의존할 수 있으면 재사용을 우선하되, SDK가 가진 launch/env/취소 소유권을 Cue의 sole process boundary와 결합할 수 있는지 별도 확인한다. Commercial Terms 소스를 일반 OSS처럼 복사하지 않는다.

## 실제 adapter seam 판정

현 runtime의 HostCandidate.launch → AdapterExecution 형태는 사용 가능하지만, 이것이 wire 호환성이나 네트워크 자격 증명은 아니다. cloud CLI의 직접 네트워크 사용은 현재 no-network model client 경계와 다르다. 도구를 끈 옵션만으로 M1/M2/M3을 통과시키지 않는다. provider broker와 격리 client 대안은 별도 아키텍처이며 Claude Code CLI 지원과 동의어가 아니다.

**Adopt 없음. Limited는 문서 근거와 Cue의 bounded framing 테스트 재사용 후보에 한정.** 생산 parser/SDK 편입/실제 실행/registry 자격은 defer. 다음 계획은 source-pinned schema 매핑표 및 assistant+partial 정합성 테스트부터 시작하며 지금 fixture를 생산 adapters로 되돌리지 않는다. 사용자의 두 실모델 gate 한도는 소비하거나 우회하지 않았다.
