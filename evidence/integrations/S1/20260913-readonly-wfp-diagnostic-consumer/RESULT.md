# Read-only WFP diagnostic consumer result

Status: parser/worker implementation frozen; consumer completion awaits the separately owned authority/boundary integration gate and shared build.

- Command: `npm exec vitest run -- test/readonly-wfp-diagnostic.test.ts test/integration-readonly-wfp-bootstrap.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
- Initial bounded result: exit 0, 2 files and 6 tests passed. A later root-requested success-path expansion produced 8 passes and 2 failures: both assertions expected `outcome:'succeeded'` but received `outcome:'failed'` (command output chunk `3252df`). The suspected cause was incomplete real identity-store session authority in the temporary fixture. After aligning the returned and persisted session owner/handle fields, the same two assertions still failed with 8 passes and 2 failures (chunk `da210b`), so that cause remains unproven. Those incomplete cases were removed rather than retained as a false passing gate; the independent checker now owns dedicated real-authority and boundary tests and will trace the swallowed production-side rejection. No product limitation or final completion claim is made from the initial six.
- Parser: `17feaa78fedc90da1e3f6143ca4fa82fe7d096586fea85508cad9abc2b0fff69`
- Worker: `6b2c1083201285179009e5bd87106c592cec9a47966a1b5ba82f2519196c2206`
- Unit test: `8e3b78b9e2f89288ac275af1a1bf39fbbbb0611d72332d4f54172b727b65e5b6`
- Bootstrap integration test: `931d5381432270ba33bbb528018035a5b36d11ac6fe379116f70dc52d10bad07`

The parser enforces the exact frame and event keys, one bound nonce/root frame, canonical UInt64 strings and base64, integer widths, 64-event and 4096-byte App ID limits, 512 KiB JSON bound, and deep immutability. Invalid input becomes an empty unknown diagnostic. Valid bounded events may remain informational under `unknown`; captured state requires the existing worker outcome to have succeeded.

The worker adds only `wfpDiagnostic` to its returned result. Identity, cleanup, database, and acceptance conditions are unchanged. Integration verifies a syntactically valid captured frame accompanied by PID and cleanup output plus failed exit is downgraded to unknown and produces zero authority rows. No native, WFP, provider, or model API was invoked.
