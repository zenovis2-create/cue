# Independent model-only boundary review

2026-09-11 · `/root/contracts_review` · verdict **FAIL / unqualified** for initial source snapshot below. Read-only production review; only this review artifact written. No server control, global firewall/loopback exemption, shared ACL edits, model request, or provider qualification.

Completion gate for this review: concrete Windows counterexample, source hashes, cleanup observations, and actionable bounded findings. Diagnostic cap: three distinct temporary fixture hypotheses; all three completed and cleaned their owned fixture directories. Do not repeat timeout increases as a correction.

| Source | SHA-256 |
| --- | --- |
| daemon/src/model-only-launch.ps1 | 9DC6FB83852AD0A39BE06D430E9AD670D6ED2B6BD825DFA6F351F32CDD392E79 |
| daemon/src/model-only-client.cjs | 5D46277164023F8139B40A26EE277D54AB97CBE9842EB1514B9B5EE1ACB80FD9 |
| daemon/test/integration-model-boundary.test.ts | CC94EC378EC45D94F3771C0AA9487B41F7CBABDA2AE425D3AB7E9B0AC6DA66C7 |

## Independent live findings

1. **M2 fails: actual profile write succeeds.** A temporary hash-pinned fixture launched through the real `-ProbeHarness` wrote `USERPROFILE/cue-review-marker.txt` and read back `synthetic-review`. Cwd write returned EPERM. The launcher exited 0 and reported both profile and task-root absent. A separate fixture held for 2.5 seconds after its write; the reviewer independently enumerated the host profile directory while the child was alive and found `cue-review-marker.txt` directly under the recorded profile root. Thus this is neither merely an internal success string nor an unverified path-redirection assumption.
2. **The current ACL mutation does not remove existing write grants** (`model-only-launch.ps1:125–134`). During that live write, host `.NET Directory.GetAccessControl(profilePath).Access` still showed the matching package SID with an explicit deny mask 852310, an explicit FullControl allow mask 2032127, and an explicit RX allow mask 1179817. The deny had not disappeared. The implementation only adds deny/RX rules; it leaves the existing writable allow. Removing/reducing writable package/capability allow grants on the owned ephemeral profile is a new correction hypothesis requiring actual remeasurement, not a proven remedy. Host management permissions and all shared ACLs must remain intact.
3. **TEMP ENOENT is not a permission denial.** The child sees TEMP rewritten to `<profilePath>/Packages/<profile-name>/AC/Temp`, while the launcher intended `<taskRoot>/temp`. Writing there returned ENOENT. A valid M2 probe must use an existing effective parent directory and require an access-denied result; nonexistent paths cannot pass the permission gate.
4. **The combined OS probe stalls before network.** An instrumented temporary fixture printed `before-child` immediately before `spawnSync(process.execPath, ['-e','process.exit(0)'], {timeout:1000})`; nothing after that call appeared. The real launcher then returned 113 with stop reason 258 after its 5-second wait. Network code was never reached. This localizes the blocked stage without claiming to know the internal Node/Windows cause. Use a separate child-launch probe with external PID accounting and distinguish spawn rejection, child termination, and timeout. Do not increase the timeout and label it a denial.

The three independent diagnostics respectively returned: (1) deadline 113 with partial trace; (2) exit 0 with profile write/read success; (3) exit 0 with host-observed profile marker and ACL snapshot. All three had empty launcher stderr and `taskRootAbsent=true`, `profileAbsent=true`. No broad test suite or build was repeated; the maker's 3-pass/1-fail focused report is not an independent passing gate.

## Other scope limits

The source correctly uses an explicit inherited-handle list for child stdin and merged stdout/stderr, non-inheritable parent pipe ends, capability count zero, suspended launch, Job active-process limit one, and a sanitized child environment. These are useful implementation mechanisms, not sufficient qualification evidence. Input rejection alone does not prove M1, and a capability declaration alone does not prove M3.

The fixed production client currently performs only bounded ping/protocol-error responses; it has no provider broker or model execution. The probe fixture is explicitly separate and hash checked. Normal completion/timeout/observed-parent-death cleanup does not cover hard-killing the launcher itself: that path still lacks an independently owned profile/root cleanup guardian. Full Qwen/llama-server filesystem, egress, billing, and cancellation guarantees remain unknown. No M1/M2/M3/P evidence references may be issued from this failing snapshot.

Primary documentation consulted: [Microsoft AppContainer implementation](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer), [Microsoft handle-list attribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute), and [Microsoft Edge AppContainer sandbox](https://blogs.windows.com/msedgedev/2017/03/23/strengthening-microsoft-edge-sandbox/). The ACL correction above is explicitly an inference from source and live behavior, not a claimed Windows fix validated by documentation.

## Parent correction snapshot: independent recheck

Verdict remains **FAIL / unqualified**. The initial findings above remain historical. Current launcher SHA-256: `51BF4048DA382BDD13EA981C8858285B722886A4824E8137B805D2838F6B0F4E`; test SHA-256: `DDA575FAFD74DACC519769398E2ED2488688A85082EE8E14579A46C19161303D`; fixed client unchanged (`5D46277164023F8139B40A26EE277D54AB97CBE9842EB1514B9B5EE1ACB80FD9`).

Independent command from `daemon`: `npx --no-install vitest run test/integration-model-boundary.test.ts -t 'same launcher denies' --reporter=verbose --fileParallelism=false --maxWorkers=1`. Exit 1; one selected test failed, three filtered/skipped. Its actual OS results were:

```json
{"newWork":"EPERM","appendWork":"EPERM","overwriteWork":"EPERM","deleteWork":"EPERM","profile":"ALLOWED","tempExists":true,"temp":"ALLOWED","outside":"EPERM","child":"UNKNOWN","network":"ETIMEDOUT"}
```

The synchronous child-probe hang no longer prevents the fixture from completing, but `UNKNOWN` still does not prove child-launch denial. `ETIMEDOUT` does not prove pre-egress boundary rejection. The effective TEMP now exists and its successful write demonstrates an additional M2 failure.

One separately authorized, bounded live DACL diagnostic used a temporary hash-pinned fixture to write synthetic markers to the actual profile and TEMP, then hold for 2.5 seconds. Host enumeration found both `cue-review-marker.txt` and `Temp/cue-review-marker.txt` physically present while the child was alive. Host `.NET GetAccessControl` showed both folders had protected DACLs (`AreAccessRulesProtected=true`), preserved host/System/Administrators FullControl, and **both** package-SID RX/Synchronize and explicit package-SID FullControl ALLOW entries with object/container inheritance and propagation None.

The corrected source removes S-1-15 rules before adding RX and invokes that operation before `CreateProcess`. Writable package grants nevertheless exist in the live child phase. Profile initialization during launch is a plausible cause; this reviewer did not measure the exact moment the grants appear and does not claim that timing as fact. A new design must verify the effective ACL at the execution boundary, potentially after suspended process creation and before resume, or use a trusted initialization barrier if grants appear later. Repeating prelaunch ACL changes without measuring that transition is not a verified remedy.

The diagnostic launcher exited 0 with empty stderr. Both marker-containing profile and task root were independently confirmed absent after completion, and the temporary fixture directory was removed. No implementation changes, further correction attempts, server control, shared ACL changes, or broad test/build runs were performed. Hard-killed launcher cleanup and full provider qualification remain unknown.

## Suspended reseal correction: read-only retention decision

Current launcher SHA-256: `DC44CEB886DBFA1D76BAEBEBBF1AA08D22ED7DDD58460FA2576CC2BBD2B43547`. Test and client hashes remain `DDA575FAFD74DACC519769398E2ED2488688A85082EE8E14579A46C19161303D` and `5D46277164023F8139B40A26EE277D54AB97CBE9842EB1514B9B5EE1ACB80FD9` respectively.

Parent requested source/evidence inspection only: **no further live probes, tests, build, retries, or production edits** were performed in this review pass. Maker evidence `post-create-seal.md` reports the focused suite at 16:44:04 as **1 PASS / 3 FAIL** after two bounded timing/ACL-conversion hypotheses. Native paths reject `client_write_grant_restored:AC:<package-SID>:FullControl` before resume. This is maker-reported execution evidence, not an independently rerun test result.

Source ordering at launcher lines 77–90 is now suspended `CreateProcess`, Job assignment, required synchronous host `Action`, ACL reseal/readback, then `ResumeThread`. Any readback exception bypasses resume and reaches the existing termination/handle-cleanup finally block. Therefore **retain the fail-closed guard**: it prevents executing the known-writable configuration observed in previous snapshots. Reverting merely to recover the earlier ping test would reinstate the demonstrated M2 failure. This retention decision is about stopping unsafe execution; it does not make the native feature functional, qualify the candidate, prove cleanup after hard launcher kill, or convert failing tests into passes.

The readback verifies protected ACLs, rejects reparse entries, and rejects writable S-1-15 allow rules throughout the owned root/profile trees. It remains a conservative precondition check, not an exhaustive OS effective-access proof. The claim that CreateProcess restores grants is still a hypothesis: the latest failure after resealing also admits an ACL construction/persistence explanation, and no exact grant-transition timing has been established.

Recommended next bounded design decision, if further work is assigned: construct an exact fresh DACL for owned ephemeral paths from an explicit host-management allowlist plus package RX, then apply/read back raw native security descriptors using `SetNamedSecurityInfo`/`GetNamedSecurityInfo`. Compare desired and actual SID/mask/inheritance values **before any process exists**, rather than repeating inherited-rule removal or moving the same seal call again. This would distinguish ACL construction/persistence from launch-time changes; it is a proposed measurement, not a validated remedy. Do not alter shared ACLs, expand package permissions, relax EPERM/EACCES criteria, or infer M1/M3 success from UNKNOWN/ETIMEDOUT. A further failure requires a different boundary backend decision, not another timing retry.
