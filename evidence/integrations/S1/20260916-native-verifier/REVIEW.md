# Native verifier independent review

Date: 2026-09-16 (Asia/Seoul)  
Reviewer: `provider_installation72`, independent of maker `native_verifier75`  
Verdict: **NOT CLEAR — production verifier cannot reach the model**

## Reviewed scope

- `daemon/src/adapters/integration-executors.ts` — SHA-256 `821316758DD6E8F0E621F3EC11E4D3F14E2076A5A34545B58F8FFCB4335016F0`
- `app/native-implementation-host.mjs` — SHA-256 `6FF88E426BA7E1E73706CED0E5B42CC38AE5FC4DACBC69D52CCE902D171F288B`
- `app/native-implementation-host.d.mts` — SHA-256 `741E1B147880F13EA2F3E4BF3A50B1C829B7048184D9B1DC39A04CAE6988C153`
- `daemon/test/integration-native-verifier.test.ts` — SHA-256 `5C4A9E5ADCC6FBCD66874B66B57F7C9E2647DA053048F3798CF78957FC7214E3`
- Maker `PLAN.md`, relevant controller/runtime and worker-enforcement source.

Root reported the coordinated shared build at exit 0 and the three-file focused gate at 12/12. I did not repeat the shared build or make provider/model/network/local calls. Source remained read-only. At review time the maker directory contained `PLAN.md` but no `RESULTS.md`; this verdict relies on the root-reported gates plus direct source inspection.

## Stop-ship finding

The new verifier is not executable through the real production runtime:

1. `createNativeImplementationHost.stage` emits `allowedActions: []` for the verifier (`app/native-implementation-host.mjs:194-195`).
2. `createCodexVerifierCandidate` correctly rejects any nonempty action or egress list before invoking its backend (`daemon/src/adapters/integration-executors.ts:132-139,250-260`).
3. The default backend is `launchHostCodexRun`. Before starting the RPC turn, it unconditionally calls `captureSnapshot('before')`, which routes a PowerShell command through `launchAppContainerWorker` (`daemon/src/host-codex-runtime.ts:327-350,353-359`).
4. `launchAppContainerWorker` synchronously throws unless the same envelope contains the `command` action (`daemon/src/worker-enforcement.ts:210-221`).

Consequently, an empty-action verifier launches the host controller but its `done` path fails during the required before-snapshot, before `rpc.run` can contact the model. The empty list does provide a real denial boundary: model tool requests also route through this worker and cannot execute. It simultaneously denies the runtime's own required snapshot workers, so it does not produce a usable read-only verifier.

The focused tests do not expose this conflict. Both positive paths inject `launch` functions that return an already successful `RunningHostCodexRun` (`daemon/test/integration-native-verifier.test.ts:18-30,40-55`). They verify composition, role rejection, lifecycle plumbing, and the pre-launch nonempty-action rejection, but never call `launchHostCodexRun` with the verifier envelope.

Done requires one production-path test proving that a verifier can complete through the real controller while every attempted model workspace tool remains denied. The design must separate controller-internal read-only verification/snapshot authority from model-requested tool authority, or use a verifier runtime that requires no workspace worker. Merely adding `command` would make the current `cue_workspace` command and `write_text` operations reachable and would violate the claimed empty-action/read-only boundary.

## Contracts that did pass source review

- The typed verifier candidate is distinct from the implementation candidate and advertises only runtime role `model`.
- Native host admission rejects equal candidate IDs and equal auth references (`app/native-implementation-host.mjs:98-110`). Runtime authorization binds `model`/`verify` to the verifier candidate and `implementation`/`implement` to the writer.
- Optional verifier installation binding uses the verifier executor's exact binary, provider identity, catalog record, subject, and evidence functions. An installation descriptor without an executor is rejected.
- The legacy opaque candidate route remains available only when no executor is supplied and still requires model-role support. This compatibility path does not itself manufacture qualification; catalog/observation/policy checks remain caller evidence and are not a universal qualification claim.
- The executor preserves durable session identity, cancellation, activity, usage, and subject/evidence hooks and rejects writable verifier envelopes before calling the injected backend.

These bounded contracts do not overcome the production runtime incompatibility. No authenticated, entitled, qualified, or universally supported provider workflow follows from this batch.

---

## Correction re-review

Date: 2026-09-16 (Asia/Seoul)  
Final verdict: **CLEAR for the bounded corrected native verifier seam**

The initial NOT CLEAR verdict above is retained as failure history. The maker changed hypothesis rather than widening the verifier envelope:

- `createCodexVerifierCandidate` alone injects `verificationMode: 'read-only-result'`. The strict caller-facing `runtimeOptions` allowlist does not accept that field, so a goal, model response, or ordinary binding input cannot select the mode.
- `launchHostCodexRun` accepts the mode only when both action and egress lists are exactly empty. It skips workspace snapshots, runs the common controller/RPC/teardown lifecycle, and leaves `goalVerification.passed` false.
- A completed, nonempty terminal response with zero model tool attempts produces the narrow transport reason `read_only_result_received`. The verifier adapter alone maps that reason to adapter completion; it does not turn it into workspace-change verification or requirement acceptance.
- Every model workspace tool request still routes to the common worker. With the empty action list the worker refuses before launch. The attempted-call ordinal prevents a later controller response from being accepted as a read-only transport result. The real boundary test observes zero worker sessions and no worktree artifacts.
- Empty terminal output remains `model_not_completed`, and nonempty authority is rejected synchronously. Default workspace-change mode retains its before/after snapshots and existing behavior.
- The mode does not alter Stop, durable session identity, activity callbacks, usage reporting, controller containment, or ordered teardown.

The corrected Windows tests call the real `launchHostCodexRun` entry with a local fixture controller rather than replacing the top-level launcher. Evidence records the corrected focused gate at 15/15, the post-review compatibility gate at 7/7, TypeScript no-emit exit 0, coordinated build exit 0, and the separate host/controller regression at 28/28. `focused-results.json` is a durable successful 7-test receipt with SHA-256 `D18380F92E3148E476B913C4BF8E94D54E2F25FD525DFFDFF978B29C55782365`.

Final reviewed source identities:

- `daemon/src/host-codex-runtime.ts`: `377D7D7C6BE2BDF77CD66796B0FC66861DE28552CBA3AF72274BF79FD23BBB92`
- `daemon/src/adapters/integration-executors.ts`: `79E1E4F8F18E602958B932542538C5185DF8F9FF26CB5BDF744E3C54A6B58577`
- `app/native-implementation-host.mjs`: `13BDA3920257F5F2DE51AA2815A6B315A5D84D4491DE64ED55F51EEE2C94AEC0`
- `app/native-implementation-host.d.mts`: `741E1B147880F13EA2F3E4BF3A50B1C829B7048184D9B1DC39A04CAE6988C153`
- `daemon/test/integration-native-verifier.test.ts`: `5F298C42B0DFDCB7174497B10EFAD14350DCB7B35188B86AE161FB3119AD332F`

The final host keeps candidate independence at the relevant boundaries: canonical candidate ID, installation/subject evidence, selected runtime role, authorization tuple, execution session, cancellation, and downstream acceptance. It correctly permits two distinct candidates to use the same exact approved account reference; a second paid subscription is not an isolation requirement.

This clearance establishes a tool-free native verifier transport and composition seam only. It does not authenticate or qualify a provider, validate the semantic correctness of the model response, establish billing truth, make this host the default deployment, or prove a universally qualified implementation workflow. Existing independent acceptance remains authoritative.
