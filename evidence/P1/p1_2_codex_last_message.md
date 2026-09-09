P1-2 프로브를 완료했습니다.

- **P1-1a = PASS**: clean `CODEX_HOME`에서 accept 명령이 exit 0, stdout `cue-probe-first`로 실행됐습니다. 기존 1223은 구조적 제약이 아니라 환경 오염 영향으로 판단됩니다.
- **P1-2 = FAIL**
  - outside decline: PASS
  - outside accept: **FAIL — worktree 밖 파일 실제 생성**
  - network denied: **FAIL — HTTP 200 실제 수신**
  - empty permissions: **FAIL — 빈 permissions가 허용으로 작동**
- hook/MCP/non-null agent role 이벤트는 모두 0건이었습니다.
- 임시 worktree와 outside 디렉터리는 모두 삭제됐습니다.
- 테스트 9건 통과, 루프 계약 점수 100/100입니다.

결론적으로 Cue가 canonical realpath 및 네트워크 경계를 직접 강제해야 합니다. Codex permissions는 보조 계층으로만 사용해야 하며, 빈 permissions 응답은 금지해야 합니다.

산출물:

- [P1-1a 판정문](C:/Users/User/cue/evidence/P1/P1_1A_VERDICT.md)
- [P1-1a 원장](C:/Users/User/cue/evidence/P1/p1_1a_ledger.log)
- [P1-2 프로브](C:/Users/User/cue/probes/p1_2_permissions.py)
- [P1-2 원장](C:/Users/User/cue/evidence/P1/p1_2_ledger.log)
- [구조화 결과](C:/Users/User/cue/evidence/P1/p1_2_result.json)
- [P1-2 판정문](C:/Users/User/cue/evidence/P1/P1_2_VERDICT.md)