# Independent actual WFP diagnostic smoke review

## Verdict

**Receipt audit PASS; the one-shot smoke itself FAILED closed.** The only authorized actual invocation has been consumed. I did not rerun the command, query native state, or clean retained files.

Root's retained command receipt records tool `eef0cc`, the exact command `node scripts/reuse/readonly-wfp-diagnostic-smoke.mjs --run`, exit 1, and 3.2904422 seconds. `result.json` records `passed:false`; this is not a successful WFP, isolation, denial, permission, registration, identity, or qualification result.

## Frozen closure and binding

- All 14 dependencies pinned by `gate-manifest.json` still match their SHA-256 values after the run. This includes the runner, test, generated launcher, sealed Node executable, process launch/snapshot/termination components, native snapshot manifest/helper, observer and its eager inputs, process observer, and diagnostic parser.
- Runner SHA-256 is `70E6E582997446762C994A67E5948F896E18E43B381B723481875FBBFBAAC966`; manifest SHA-256 is `8891477DB9D48B939858129AB35698EC91F10D48CB2B2F60EAED8B1CB7DDE5D2`; generated launcher SHA-256 is `F5E03DE26E29B95DC42A012F280E8B37A1A1E76CF2A02B54D2ECF4F5557EB9D3`.
- Intent, manifest, and result agree on version, attempt, maximum invocation count, owned/worktree/runtime/sibling paths, all executable/helper paths, and the intent/expected/result destinations. Expected and result paths have no binding drift.
- The expected launcher and executable hashes match the manifest. The expected nonce and root identity match the cleanup frame and post-run root identity.
- The durable intent remains present, as does the failed gate's owned root `D:\Temp\User\Cue.ReadonlyWfpDiagnosticSmoke1`. Its current direct children are exactly `runtime`, `sibling`, and `worktree`; the sentinel content remains `unchanged`. No cleanup authority follows from this review.

## Observed facts

- The launcher completed with status 1, signal null, and error null. Its stdout contains exactly one created-process frame for PID `50324` and creation FILETIME `134337527360204843`, one nonce/root-bound WFP frame, and one nonce/root-bound cleanup frame. There is no exit frame.
- The WFP frame is strictly `state:"unknown"`, `overflow:false`, with no events. The stderr contains the readable English cause `observation lease refused`. Other localized stderr characters contain Unicode replacement characters, so the retained decoded string is not evidence of lossless original stderr bytes.
- The read-only post-run process observation reports PID `50324` absent. Because no live process with that PID remained, the runner records worker death observed. The observer returned no creation FILETIME for an absent PID; this evidence does not qualify any other PID, prove whole-job death, or establish a resumable identity.
- ACL observations before and after both completed with status 0 and are byte-identical. The cleanup frame reports ACL restored and profile absent for the expected nonce/root; the separate profile check completed with status 0 and count 0. The post-run root identity matches the expected identity, and the sentinel is unchanged.
- The native diagnostic provides no event and no captured state. The retained failure identifies only a generic observation-lease refusal. It does not isolate a WFP return code, including `GetCode 5`, and cannot support a WFP-denial or permission conclusion.

## Static source recheck

The active S7 snapshot remains `e7e6ec66888470447a791cb29456e100039822cf55a4b54f5193afb4b1be683b`. All 165 recorded JS/TS files rehash without mismatch. Its source basis also remains current at HEAD `8e2afa6366e3af62f7115b2c67be799130f8dfdf`, scoped status SHA-256 `F92A56E2B4DFF01AE35B124EC94AC964D2A08DC4CECC3CAEDE7F399CF2523F1F`, and 127 entries.

The retained evidence supports a bounded failed launch, exact diagnostic/cleanup framing, unchanged root/ACL/sentinel observations, profile absence, and absence of the created PID at post-observation time. Host non-resume is a policy inference from the failed result and retained intent, not native identity or whole-job authority.
