# Independent actual diagnostic gate review

Status: **FAIL / CLOSED.** The single authorized attempt was consumed. Native status 72 means only that the diagnostic recorder could not persist a valid diagnostic; because no diagnostic file exists, no failing stage or underlying cause is established.

## Preserved evidence

- Intent: `7E2DE267F438115AC07D2EAE17824F9333246442EEDAE2B96E99E8D84383DE18`
- Expected: `D35E7471AE88D94C8C946053C42E9C29A6C10B200533139092143D975387F3A3`
- Result: `F424960825546DE53C38DE8FB59A234603A0491698DCDC93654156F350F9AA85`

The intent binds the frozen diagnostic client `64BFCA108AFF18D020001962C32027468C0F658420B54B8F27632704E2B16CB9`, repaired launcher `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`, owned root `D:\Temp\User\Cue.ReadonlyVerifier.DiagnosticGate1`, and one-launch cap. The expected receipt binds nonce `092c2e3b7ba5d28b54665173c7f8f2a88487d18c799d07d73c4d18db837ec9f1` and command-line SHA-256 `69249c805cbe3a8e682dc735cba6434727f371b55b199a9bd6db654752872719` before launch.

## Actual observations

- PID 113624 was created at FILETIME `134337348988486463`. Launcher status was 72 with no signal, spawn error, or stderr.
- Stdout contains exactly one nonce-bound exit-72 frame and exactly one cleanup frame. The cleanup frame reports restored ACL, absent profile, and root identity `f575486a9f486ade:fe200001000024010000000000000000`.
- The terminal receipt correctly records `passed:false`, `observed:null`, `diagnosticExists:false`, and `diagnostic:null`. Exit 72 is diagnostic-persistence failure; it does not qualify diagnostic evidence and does not identify `evaluation`, `setup`, `port`, `socket`, `callback`, or `result-write`.
- Independent bounded observation confirmed PID 113624 is dead, the exact named AppContainer profile count is zero, and the current root identity equals both receipt identities.
- Independent `Get-Acl` returned the exact pre/post SDDL retained in the receipt. The runtime directory is empty; neither `diagnostic.json` nor the worker `result.json` exists.
- The three initial worktree files remain byte-exact: `existing.txt` (`AAA8D3C8...C424C`), `delete-me.txt` (`61975955...15A04`), and `rename-me.txt` (`9E84869D...C35E`). No permission-test side effect is established.

Status 72 combines all recorder-context, hostile-field/serialization, and exclusive-write failure paths. Absence of the diagnostic prevents distinguishing them. It does not show that the probe operations or user command ran, and no filesystem or network permission result may be inferred.

The owned root remains retained. This audit performed only exact receipt/file reads, PID and profile queries, `Get-Acl`, and the pinned read-only root-identity observation. It performed no launch, retry, cleanup, profile mutation, model, provider, or network operation.
