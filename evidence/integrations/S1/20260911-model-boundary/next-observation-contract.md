# Next observations for unresolved child/network probes

Status: planned; no eligibility evidence issued. Parent research on 2026-09-11. Guardian implementation is a separate active unit and must finish before launcher changes for these observations.

The existing negative probe observes child `UNKNOWN` and network `ETIMEDOUT`. Neither alone proves denial. Repeating it with a broader accepted error list would not improve evidence. The next unit should inspect effective OS enforcement on the exact owned child, then correlate controlled negative operations with that policy and process ownership.

Microsoft documents that `JOB_OBJECT_LIMIT_ACTIVE_PROCESS` limits concurrent processes; exceeding the limit terminates the attempted association. Breakaway permission is a separate flag. This suggests checking the actual Job's limit, breakaway flags and exact membership rather than inferring the native cause from Node's generic error. This is an inference about a useful measurement, not proof that the current child probe was blocked for that reason. [Job limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information).

Microsoft documents network capability requirements for AppContainer, and default loopback blocking with an explicit exemption mechanism. Therefore an effective-token/capability observation plus a read-only exemption check is relevant to the pending network gate. A timeout remains inconclusive without enforcement evidence. [Launching AppContainer](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer), [IPC and loopback exemptions](https://learn.microsoft.com/en-us/windows/apps/develop/communication/interprocess-communication).

Proposed bounded inputs/outputs:

- Input: host-owned process handle, creation identity, Job handle and generated package SID; never a model-supplied PID or policy declaration.
- Output: actual AppContainer status/SID and capability set, actual Job flags/active limit/member identities, read-only exemption result, controlled probe outcome and cleanup observations bound to source hashes.
- Missing access, process exit/race, unsupported API or identity mismatch yields unknown. No global firewall/audit/exemption changes and no writes to shared ACLs.
- These observations do not establish the separate llama server's identity, privileges, loaded dependencies or network behavior. Existing local provider scope remains explicit.

Reuse research is examining Microsoft's `microsoft/mxc` source before adding more custom boundary code. Package adoption, extraction, licensing and runtime compatibility are undecided. No new launcher behavior or test exception is authorized by this note alone; a concrete implementation must have its own bounded tests and independent review.
