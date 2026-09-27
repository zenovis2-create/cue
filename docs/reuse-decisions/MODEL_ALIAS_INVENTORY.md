# 사용자 모델 별칭 inventory

조사일: 2026-09-12 · 상태: **정적 관측 목록, 전부 비활성**

이 목록은 `docs/INTEGRATION_SPEC.md`의 사용자 원문 별칭 12개를 한 번씩 보존하고 canonical API model ID가 1차 근거에서 확인된 경우에만 연결한다. `resolved-inactive`도 설치, 계정 entitlement, 가격, 기능, 자격, 선택, 실행 가능성을 뜻하지 않는다. registry는 policy·selection·admission·price·rank·entitlement·dispatch에 권한을 주지 않으며 잘못된 대소문자나 공백을 fuzzy match하지 않는다.

| 사용자 원문 별칭 | 상태 | 공급자 | canonical model ID | 판정 근거 |
|---|---|---|---|---|
| `gpt 5.6 sol` | `resolved-inactive` | OpenAI | `gpt-5.6-sol` | [OpenAI Models](https://developers.openai.com/api/docs/models)의 표시명과 ID |
| `terra` | `inactive-unresolved` | `null` | `null` | [OpenAI Models](https://developers.openai.com/api/docs/models)는 GPT-5.6 Terra와 ID를 연결하지만 공급자·제품군이 빠진 원문 `terra`를 standalone API alias로 정의하지 않음 |
| `luna` | `inactive-unresolved` | `null` | `null` | [OpenAI Models](https://developers.openai.com/api/docs/models)는 GPT-5.6 Luna와 ID를 연결하지만 공급자·제품군이 빠진 원문 `luna`를 standalone API alias로 정의하지 않음 |
| `6 astra` | `resolved-inactive` | OpenAI | `gpt-6-astra` | [OpenAI GPT-6 Astra model page](https://developers.openai.com/api/docs/models/gpt-6-astra) |
| `claude opus 5.0` | `resolved-inactive` | Anthropic | `claude-opus-5` | [Anthropic model ID 규칙](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)은 major-version release에서 minor segment를 생략하며 Opus 5 ID를 명시 |
| `sonnet 5` | `resolved-inactive` | Anthropic | `claude-sonnet-5` | [Anthropic Models overview](https://platform.claude.com/docs/en/models/overview) |
| `haiku` | `inactive-unresolved` | Anthropic family only | `null` | 공식 목록에는 Haiku 4.5와 과거 Haiku 세대가 있어 버전 없는 원문을 하나의 ID로 연결할 수 없음 |
| `fable 5.1` | `resolved-inactive` | Anthropic | `claude-fable-5-1` | [Anthropic Claude Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview) |
| `gemini flash 3.8` | `resolved-inactive` | Google | `gemini-3.8-flash` | [Google Gemini models](https://ai.google.dev/gemini-api/docs/models) |
| `qwen 3.8 27b (로컬)` | `resolved-inactive` | local llama.cpp server | `qwen38-27b-unc` | [저장된 `/v1/models` 및 응답 증거](../../evidence/integrations/S1/20260911-qwen-live/result.json)의 서버 광고 ID |
| `grok 4.6` | `resolved-inactive` | xAI | `grok-4.6` | [xAI Grok 4.6](https://docs.x.ai/developers/models/grok-4.6) |
| `muse 1.3` | `inactive-unresolved` | `null` | `null` | [Meta의 공식 발표](https://research.meta.ai/blog/introducing-muse-spark-1-3)는 **Muse Spark 1.3**과 Meta Model API 배포를 확인하지만 이 페이지는 요청 원문에 대응하는 canonical API ID를 제공하지 않음 |

OpenAI resolved 행은 현재 협업 환경의 `gpt-5.6-sol`·`terra`·`luna`·`gpt-6-astra` label에서 추론하지 않았다. 공식 API 모델 문서가 완전한 표시명과 ID를 직접 연결하는 경우만 사용했으며, bare `terra`와 `luna`는 그 기준을 충족하지 않아 미해결이다. Claude Code 2.1.267의 저장된 help는 `fable`, `opus`, `sonnet` 입력 예시를 보여 주지만 역사적 로컬 CLI 선언일 뿐 계정 entitlement나 현재 API 가용성 근거로 사용하지 않았다.

로컬 Qwen 행은 서버가 광고한 opaque ID에만 연결한다. 저장된 메타데이터에 27,320,697,856 parameters와 Q3_K Medium 표시가 있어도 `qwen 3.8 27b`라는 마케팅 이름이나 특정 weight 계보와 동일하다고 검증된 것은 아니다. 이 행의 `qualification`과 `enabled`는 false이며 entitlement·price·capabilities는 unknown이다.

`muse 1.3`은 공식 제품명이 `Muse Spark 1.3`인 후보와 닮았지만 요청 원문에는 `Spark`와 공급자가 없고 공식 발표 페이지에 canonical API ID가 없다. 제3자 catalog나 블로그가 제시하는 slug는 mapping 근거로 사용하지 않았다. `haiku`도 현재 세대로 자동 이동시키지 않는다.

구현은 [model-alias-registry.ts](../../daemon/src/model-alias-registry.ts)에만 있으며 기존 integration catalog, policy, selection, engine, Electron import graph에는 연결하지 않는다. 상세 claim digest는 [S0 source claim 증거](../../evidence/integrations/S0/20260912-model-aliases/source-claims.json)에 기록하고 [결정적 generator/verifier](../../daemon/scripts/model-alias-source-claims.mjs)가 canonical LF JSON과 kind별 digest를 재생성·검사한다. 독립 검토 전에는 체크리스트 31번을 직접 닫지 않는다.
