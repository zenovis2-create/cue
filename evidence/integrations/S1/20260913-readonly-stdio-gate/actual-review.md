# Independent actual stdio gate review

Status: **FAIL / CLOSED.** The one authorized attempt was consumed. The worker process started but returned exit code 1 without a worker result, so the read-only boundary contract did not pass and this gate authorizes no retry.

## Preserved receipts

- `intent.json`: `449D368A09EA855F543D43E301F230FFBB87D1ABE1E34A5FC2A3B7D36ACC6C74`
- `expected.json`: `88EAA9280A6375F018A94468E5046F78DA546776598EC5B429CDC57F8958EF51`
- `result.json`: `60ADD686BDEF03221F05A79D9737C0C0DBA97C4B6623C5F141E9F71623AD942F`

The intent binds the frozen launcher `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`, owned root `D:\Temp\User\Cue.ReadonlyVerifier.StdioGate1`, and `maxBoundaryLaunches: 1`. The exclusive expected receipt contains nonce `d52249450146d361a2a9f6ae0534fb0301ff195035958f45968cd16a3d0bb17c` and command-line SHA-256 `1616f2a2739bdf3200489071f65b8ae0676ef99ea1f7a9a0cfb345aeabdbdcc7`. The same values are retained in the terminal diagnostics.

## Actual observations

- Launcher status was 1 with no signal, spawn error, or stderr. Its bounded stdout contains exactly one PID frame for PID 67984 with creation FILETIME `134337335491769901`, exactly one nonce-bound `CUE_READONLY_EXIT=1` frame, and exactly one cleanup frame.
- The cleanup frame binds the expected nonce and exact root identity `f575486a9f486ade:6122000100004a000000000000000000`; it reports `aclRestored:true` and `profileAbsent:true`.
- The terminal receipt reports `passed:false`, `nativeStatus:1`, `workerPid:67984`, `cleanupFrameCount:1`, `acceptedConnections:0`, `observed:null`, restored ACL, profile count zero, and unchanged fixtures. An absent worker result cannot satisfy the gate.
- Independent bounded read-only observation confirmed PID 67984 is dead and the exact named AppContainer profile count is zero.
- Independent root identification returned the same volume serial and file ID as both pre/post receipt identities. Independent `Get-Acl` returned the exact SDDL retained in both successful ACL observations.
- The runtime directory exists and is empty. The owned root remains retained for diagnosis.
- The worktree contains only the three initial fixtures with their expected bytes: `existing.txt` = `unchanged` (`AAA8D3C8...C424C`), `delete-me.txt` = `delete` (`61975955...15A04`), and `rename-me.txt` = `rename` (`9E84869D...C35E`). No created or renamed output was observed.

This result is materially different from the earlier `0xC0000142` startup failures: the launcher emitted a real PID and an exit frame for status 1. It does not prove that the probe test actions ran, because `observed` is null. It establishes neither project read nor runtime write nor any filesystem/network denial. It also does not identify why the worker exited 1.

The audit used only receipt/file reads, an exact PID existence query, an exact profile query, `Get-Acl`, and the pinned read-only root-identity helper. It performed no launch, retry, cleanup, profile mutation, model, provider, or network action.
