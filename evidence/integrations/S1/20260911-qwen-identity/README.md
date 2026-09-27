# 로컬 Qwen 읽기 전용 identity 측정

2026-09-11 · `pwsh -NoProfile -File scripts/reuse/qwen-identity.ps1` 최종 exit 0 · 상태 observed · 10,572ms.

포트 8085의 127.0.0.1 리스너 소유 PID 69712와 시작 시각이 전후 일치했다. `/v1/models`에 `qwen38-27b-unc`가 있었고 `/props`의 허용 필드에서 같은 별칭, 슬롯 1개, 슬롯 context 147456을 관측했다. 이 값은 서버 자기신고이며 실제 전체 context 성공 시험은 아니다.

| 대상 | 읽은 바이트 | SHA256 | 전후 size/mtime |
|---|---:|---|---|
| 포트 소유 프로세스 실행 파일 | 9,216 | `f620cde4258c202b6b149004643dbd90124d708cee042a8b65397b69777887ec` | 일치 |
| 명시된 model 인자의 GGUF 파일 | 13,223,069,536 | `b4c9721ab6ed1b7d1d1863b8f43e2fbce6a88dab39ea4333d2e74a7ad69580fe` | 일치 |

원본 파일 경로와 프로세스 시작 시각은 로컬 `identity.json`에만 기록했다. 원시 commandline/환경/템플릿/시스템 프롬프트는 출력하거나 저장하지 않았다. 초기 측정은 정규식으로 모델 경로를 추출했으며, 아래 수정 이력의 네이티브 argv 재확인에서 같은 경로임을 확인했다. 추정 경로 탐색은 하지 않았다.

4MiB 고정 버퍼로 SHA256을 계산하고 전체 120초 예산을 블록마다 검사했다. 이는 blocking read 사이의 협력적 시간 검사이며, 단일 read가 정지하는 상황의 강제 hard timeout은 아니다. 첫 시도는 CIM read-only CommandLine 속성을 비우려다가 해시 시작 전 중단했다. 수정 1회로 CIM 객체를 로컬 변수에서 해제하는 방식으로 바꿔 재측정했다. 서버 중지·실행·설정 수정·모델 다운로드·유료 요청은 없었다.

보증 한계: 실행 파일은 9,216바이트로 작으며 이 해시가 전체 로드된 DLL/런타임/서버 구현을 포괄한다고 해석하지 않는다. 추가 shard/adapter/projector는 확인하지 않았다. 디스크 파일 해시가 현재 로드된 메모리와 동일하다는 증거도 아니다. size/mtime 일치는 원자적 파일 snapshot 보증이 아니며 읽는 동안 바뀌었다가 복구되는 변화를 모두 잡지 못한다. 이 결과는 **M1/M2/M3/P 자격·실제 정지·외부 전송 부재를 증명하지 않는다**.

재현 script SHA256: `39a7516a393af693770b2dde6e6ac047ee223feb8560045c09d77cc64c379c9d`.

## 독립 리뷰 뒤 parser 수정 이력

위 측정에 사용된 원래 script는 정규식으로 모델 인자를 찾았으므로 따옴표로 묶인 alias 내부의 `--model` 문자열을 잘못 인식할 수 있었다. `identity.json`과 당시 script hash는 역사적 측정 증거로 그대로 보존한다. 이 문서의 원본 hash를 현재 수정본 hash로 바꾸지 않는다.

두 번째 코드 수정에서 Windows `CommandLineToArgvW`로 토큰을 분리하고 정확한 `-m`, `--model`, `--model=value`만 처리하도록 변경했다. 모델 인자가 없거나 중복/빈 값이면 미확인으로 처리한다. 네이티브 Windows 파싱 의미를 따르며 Unix single quote 문법이나 닫히지 않은 따옴표의 별도 rejection을 주장하지 않는다. REST 조회도 `-MaximumRedirection 0`으로 리다이렉트를 차단한다.

`pwsh -NoProfile -File scripts/reuse/qwen-identity-parser.test.ps1`의 오프라인 15개 검사 exit 0. quoted path, quoted alias 속 가짜 옵션, escaped quote/backslash, exact option/prefix, duplicate/missing, equals 형식을 포함한다. 실제 commandline은 출력/저장하지 않고 새 parser의 추출 경로가 원본 metadata의 모델 경로와 같은지만 확인해 true를 기록했다. PID 시작 시각도 일치한다. 13.2GB 파일의 재해시는 수행하지 않았다.

현재 수정본/테스트 hash와 원래 evidence hash, 재확인 결과는 `parser-correction.json`에 분리했다. 수정 횟수는 총 2회이며 자격 보증은 여전히 부여하지 않는다.
