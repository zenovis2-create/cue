# Independent readonly coordinator transport review

Verdict: **PASS for the bounded offline coordinator correction**

The production coordinator now accepts the Windows CRLF form of the exact worker identity line with `\r?$`. The offline mocked coordinator test supplies `CUE_READONLY_PID=321;CREATED_FILE_TIME=12345678901\r\n`, observes `verifyProcessesDead([321])`, and then forces launcher exit 1. The result remains `failed` with null identity and cleanup references, so recognizing the PID does not promote failed execution or create authority.

The test also captures the coordinator's two process launches. It verifies the exact ACL PowerShell arguments and the exact launcher arguments ending in `-Command -`. The launcher stdin ends in byte `0x0a` and does not end in the two literal bytes `\\n`.

Both production PowerShell worker sites use the same fixed three-key environment: `SystemRoot`, `WINDIR`, and `PATHEXT=.EXE`. No caller PATH or broader environment is forwarded. This is a narrow executable-resolution correction for the readonly utility path.

## Diagnostic correction

My earlier report that the bootstrap emitted literal `\\n` was incorrect and is retracted. Raw source tail bytes are `39,92,110,96`: the single JavaScript `\n` escape evaluates to an actual LF. The bootstrap LF source was unchanged by this correction. JSON string escaping in my earlier inspection caused the misreading.

## Independent gates

From `C:\Users\User\cue\daemon`:

```text
npx --no-install vitest run test/integration-readonly-verifier-bootstrap.test.ts test/readonly-verifier-worker.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
```

Results: exit 0; **2 files and 2 tests passed**; TypeScript build and asset copy passed. These were offline mocked/pure tests. I made no native helper, readonly worker, model, or network call and did not rerun the full suite.

## Reviewed hashes

- `daemon/src/readonly-verifier-worker.ts`: `DC3136E8F6387B3C0D7A2DF8D164AB3D2261CBD968B42E0933EAD545D2D4294C`
- `daemon/test/integration-readonly-verifier-bootstrap.test.ts`: `E28F60477E6C0E9C361CCAC7FB2CEFA4CEEE79267B1284BE0E195315814215F1`
- `daemon/test/readonly-verifier-worker.test.ts`: `69A9ABB300A936B68741215088E511F3CC75243120728A8C4004F3197CFA0B43`

The direct native launcher gate remains separate; this review establishes only the offline coordinator transport behavior above.
