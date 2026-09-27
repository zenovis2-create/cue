# Fixed model/checker measurement factory — maker record

완료 기준: factory-owned 버전별 파일 집합, 실제 compiled/source/app/SQL/package와 외부 runtime bytes, OS build/revision/architecture 측정. 임의 subset 입력 없음. 누락/변경/추가/삭제/reparse/outroot 실패 또는 digest 변화 검증. build+focused gate, 원인별 교정2 상한. eligibility 미발급.

## API / 범위
`createModelMeasurementSubject({installRoot,kind,nodeExecutable,powershellExecutable,sqliteNativePath,dependencyRoot})`는 frozen subject/subjectDigest/manifest/limitations를 반환한다. 경로는 host-owned 설치 관측이다. installRoot/daemon/src, daemon/dist/src, source+compiled migrations, app 실행파일/HTML/CSS, root+daemon package/lock, 실제 정책소스/P13문서, kind별 고정 실제 probe test를 측정한다. 추가된 app mjs도 자동 포함된다. 소스 executable/SQL의 compiled 상대 파일이 없으면 거부한다.

임의 caller 파일 목록을 받지 않으며 최대4096파일, 파일256MiB, 합1GiB, tree8192node 상한이다. 경로정규화/실제파일/reparse/root이탈을 확인한다. 파일 hash 전에 집합을 고정하고 hash 후 파일stat/디렉터리 inventory 변화도 확인한다.

실제 hostruntime은 process.execPath, 격리 Node는 host가 지정한 실제binary, PowerShell은 SystemRoot 고정경로로 제한한다. 고정 read-only registry query를 기존 process-launch 경계로 실행해 Windows build/UBR를 얻고 os.release/version/arch와 결합한다. SQLite native는 better-sqlite3 package 안의 실제node파일이어야 하며 package 전체 JS/CJS/MJS/JSON/node와 metadata를 포함한다.

별도 model/checker policy/probe manifest 파일이 없어 factory-owned 경로목록이 버전manifest다. probe 파일 hash는 의미적 probe PASS가 아니고 full checker M 자격은 별도다. 설치제어root의 신뢰, Windows/.NET/system DLL, 실제 provider process, native buildtoolchain은 별도TCB다. hostruntime EXE 측정은 전체 runtime 동적라이브러리/설치패키지 attestation이 아니다.

## 진단/교정
- 초기 probe script는 native filename better_sqlite3.node를 가정해 undefined를 전달했고 input validation이 거부했다. 실제 로드된 require.cache의 유일 SQLite .node 경로로 probe를 수정했다(제품변경 아님).
- 초기 external manifest의 bindings/file-uri-to-path 가정은 현재 better-sqlite3 13.0.3에서 실제 설치와 달랐다. 실제 npm ls --omit=dev는 별도 production 하위패키지를 표시하지 않았다. 교정1은 13.x 자체 loader closure로 제한했지만 package metadata의 node-addon-api 선언을 거부했다.
- 교정2: 실제13.0.3만 지원하고 node-addon-api ^8.0.0의 build-header 선언만 명시허용했다. 새 runtime 의존성은 unsupported 거부한다. 이 선언의 허용은 buildtoolchain attestation이 아니며 실제 shipped SQLite .node와 loader bytes는 측정된다. 가정한 loader를 가짜파일로 보충하지 않았다.

## 결과
- build exit0.
- 기존 helper/P13 포함 14 PASS(교정1 기준); 최종 제품소스 factory focused3 PASS3.26s.
- 마지막 dependency rejection/허용 test 추가 후 typecheck0 및 해당target1 PASS(나머지2미선택),654ms.
- 실제 compiled factory로 현재 설치273파일 측정 성공: actual-checker-manifest.json.
- snapshot subjectDigest 5c22128f88a5d238fe7b95f79d5e3f8f71c0822bb34e808a229e96b2cb32d2ca.
- 실제 OS win32, Windows11Pro, release10.0.26200,buildRevision26200.9168,x64.
- 실제 manifest는 해당 시점 소스/산출물 한정 역사적 관측이다. 이후 부모 작업으로 file closure가 바뀌면 재측정시 digest도 달라져야 한다.
- source-hashes.json에 최종owned2파일 해시. Qwen/provider 호출 없음. 독립 검토 전 maker evidence.
