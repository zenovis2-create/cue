# Independent readonly ACL preflight lifecycle review

Verdict: **PASS for the bounded offline ACL lifecycle scope**

The coordinator rejects an already-aborted request before any process spawn. Once the owned ACL observation process exists, abort, the fixed five-second observation trigger, combined stdout/stderr growth beyond 65,536 UTF-8 bytes, and a child `error` all enter the verified tree-termination path. The terminal flag is set before termination begins, so a synchronous late `close(0)` cannot convert failure into success. Settlement does not depend on receiving `close` after termination.

The five seconds bound the ACL observation phase before termination starts. It is not a claim that the entire call returns within five seconds: the synchronous, separately bounded process observation and termination work may extend total elapsed time.

After a successful ACL close, the coordinator rechecks the abort signal before creating runtime state or spawning the verifier. The regression aborts in that exact continuation window and proves there is still only one spawn. Spawn throw, child error, nonzero exit, stderr output, empty stdout, timeout, abort, and output overflow all prevent the second spawn and produce no identity or cleanup records. Late data/close events remain inert after terminal failure.

If verified termination throws, the coordinator rejects with `readonly_acl_termination_unverified`; it does not report clean termination or continue. This preserves the distinction between an observed failure and unverified cleanup.

The source retains the exact three-key host PowerShell environment (`SystemRoot`, `WINDIR`, `PATHEXT=.EXE`), the eight-key isolated launcher payload environment, the actual LF bootstrap, and CRLF PID parsing. No authority, native-helper, model, network, or live worker claim is derived from these mocked tests.

## Independent gate

From `C:\Users\User\cue\daemon`:

```text
npx --no-install vitest run test/integration-readonly-verifier-bootstrap.test.ts test/integration-readonly-verifier-acl.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: exit 0; **2 files and 13 tests passed**. The test matrix is offline and uses mocked child processes and fake timers where required. The maker's recorded build passed; this reviewer did not rerun a broader suite or native gate.

## Frozen hashes

- `daemon/src/readonly-verifier-worker.ts`: `F1E3371CBF5FA444756526E0401724BADD17997B99D9E8DE43F9F2A4E9E20CD4`
- `daemon/test/integration-readonly-verifier-acl.test.ts`: `5F685C517622C1D1DBEC9211DB4D5A4A6810DBE6E21454FDF52823906B74565A`
- `daemon/test/integration-readonly-verifier-bootstrap.test.ts`: `88EC1DA32E28917AC13C021760E577F80B860A5B44F74DAB3FCB277F27B06A18`

No blocker remains within this ACL preflight lifecycle scope.
