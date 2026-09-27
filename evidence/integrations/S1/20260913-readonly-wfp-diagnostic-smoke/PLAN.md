# Read-only WFP diagnostic smoke contract

Done means a new, one-shot, host-owned smoke runner can execute the current hash-pinned generated WFP launcher once against the current sealed Node executable and fixed command `node -e process.exit(0)`. It records the raw PowerShell status/signal/error/stdout/stderr, exact parsed WFP diagnostic, optional launcher PID, cleanup frame, root identity/ACL equality, profile absence, owned runtime state, and dependency hashes. It never interprets a diagnostic event as network denial, permission qualification, identity authority, or production registration.

The actual invocation cap is **one** and is enforced by a fresh `wx` intent under `D:\Temp\User\Cue.ReadonlyWfpDiagnosticSmoke1`. There is no retry or reuse of any historical gate/manifest/marker. Offline preparation has at most two correction passes. Every preparation pass runs the Node fixture tests, syntax check, manifest/hash checks, owned-path absence check, and scoped diff check. Failure after two corrections is handed off.

The runner pins its own bytes, test, generated launcher, Node executable, process launcher, change-snapshot host/helper/manifest, process termination helper, and shared host-observation helper. It performs no work on import. `--run` is rejected unless every pin matches and both intent and owned root are absent; the intent is durably created before owned directories or PowerShell invocation.

The owned worktree contains one immutable sentinel. Runtime and sibling directories are distinct. Before launch the host records exact root identity and SDDL. After the bounded launch it always attempts bounded root/ACL/profile observation. A PID is verified dead only when an exact PID frame exists. Absence of a PID before WFP readiness is recorded as `workerPid:null` and never treated as worker-death proof; only the completed outer PowerShell process and launcher cleanup/root/profile facts are reported. Failure retains owned diagnostics. Only a complete benign exit may remove the owned root after all cleanup decisions; the final receipt is written afterward so a removal failure cannot leave a passed receipt.

Time bounds: ACL/profile observations 5 seconds each; launcher 30 seconds; generated WFP collection request remains fixed at 5 seconds. No listener or network connection is created. No WFP setting/query outside the generated launcher, elevation, loopback exemption, workspace write, model/provider, or policy change is allowed.

Preparation command:

```text
node --test scripts/reuse/readonly-wfp-diagnostic-smoke.test.mjs
node --check scripts/reuse/readonly-wfp-diagnostic-smoke.mjs
node scripts/reuse/readonly-wfp-diagnostic-smoke.mjs
```

The eventual root-owned command, only after independent preflight, is:

```text
node scripts/reuse/readonly-wfp-diagnostic-smoke.mjs --run
```
