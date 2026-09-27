# Read-only WFP collector implementation receipt

Implemented a bounded x64 diagnostic reader in `scripts/reuse/native/readonly-wfp-collector.cs` with a PowerShell compile/JSON wrapper. It queries collection state before subscribing, uses the SDK-correct `FwpmNetEventSubscribe2` / `FWPM_NET_EVENT3` pairing, copies bounded callback observations, and returns only `captured` or `unknown`. It grants no authority and makes no PID or package-drop inference.

The lifecycle permits one collection at a time. Failed or unverified unsubscribe, cleanup, or engine close retains the native references for process lifetime, poisons later collection, and returns `unknown`. Invalid paths, package SIDs, durations, or ports make zero native calls. Unattempted native result codes remain `uint.MaxValue`.

The ABI contract is grounded in the independent Windows SDK 10.0.26100 probe at `evidence/integrations/S1/20260913-readonly-wfp-abi/output.txt`. That probe measured Header3, Event3, capability-drop, subscription, and value layouts. The implementation additionally corrects the documented subscription pairing from the earlier plan: Subscribe2 receives Event3; Subscribe3 would receive Event4 and is not used.

## Verification

Command:

`node --test scripts/reuse/readonly-wfp-collector.test.mjs`

Result: 12/12 passed. The executable injected-native matrix covers collection disabled/error, bounded overflow, invalid requests with zero native calls, concurrent rejection, wait/unsubscribe/free/close failures, nonzero close quarantine, poisoned replay, ABI offsets, and IPv4 host-order loopback matching. `node --check` and `git diff --check` also passed.

Final SHA-256:

- `64124E666B773D7036DFE2F35FFE373BC02A28EC472A2D9756297A40089D5B61` — `scripts/reuse/native/readonly-wfp-collector.cs`
- `F9AB6527918EEEAD39BFEE85FDAD325260DBB391E80A28E92B1C3E0F447314F5` — `scripts/reuse/readonly-wfp-collector.ps1`
- `A2018C6BABDD0007B496B256A72B62254B758A30758B2ABC795E129188725FF3` — `scripts/reuse/readonly-wfp-collector.test.mjs`
- `291ADED231CC74AE4684BF4B010FDBE1D99682A95332DDA0066570C9E4A5EAC5` — `DONE-CONTRACT.md`

No live WFP query, subscription, worker, model, provider, network, elevation, setting change, or exemption was executed. The primitive does not establish that an observed event belongs to a protected one-process job; a later protected bridge must supply and verify that lifetime context.
