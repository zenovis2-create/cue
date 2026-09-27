# Module-free ACL correction: affected case passed

Only the test helper changed: `File.GetAccessControl(path).GetAccessRules(true,true,SecurityIdentifier)` replaces module-dependent Get-Acl. SID normalization and terminating errors remain. Launcher/client and prior evidence are unchanged.

Exactly one authorized execution, from `daemon`:

```text
npx vitest run test/integration-model-boundary-qualification.test.ts -t 'M2/M3' --reporter=verbose --fileParallelism=false --maxWorkers=1

 ✓ test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M2/M3 denied file operations plus same-listener host controls and no confined TCP success 3735ms

 Test Files  1 passed (1)
      Tests  1 passed | 2 skipped (3)
   Start at  17:58:01
   Duration  3.96s (transform 20ms, setup 0ms, import 35ms, tests 3.79s, environment 0ms)
```

Exit 0. Tool output chunk `1e7cb2`, 2026-09-11 local time. No full suite, Qwen request, firewall/global ACL/network policy mutation or additional native change.

Unique raw journal and source-bound aggregate:

- `controlled-qualification-7700edc6-1d9e-4245-ae1d-ce359d306b74.jsonl`
- `controlled-qualification-7700edc6-1d9e-4245-ae1d-ce359d306b74.json`

Measurements: PID 92496 matched the suspended token/Job readback (AppContainer, zero capabilities, flags 8200, process limit 1, sole member PID, no loopback exemption). Work/profile/actual Temp/outside create, append, overwrite and delete returned EPERM. Host inspected all four targets after child exit: original contents remained and new files were absent. Host pre/post package ACE readbacks for the three readable targets matched the actual package SID, with RX rights 1179817 and no mutation rights. Outside is unreadable to the child but host existence/content were independently checked.

Owned TCP listener 127.0.0.1:57100 received and echoed exact host pre/post nonces. The controlled child reported no connect/send success, ETIMEDOUT, and its unique nonce was absent from listener receipts. Process/root/profile cleanup was observed.

This is narrow fixed-client policy plus controlled TCP evidence. ETIMEDOUT is not relabeled as an OS access-denied errno and does not prove all protocols or provider-side isolation. M1 and diagnostic timeout cases were deliberately skipped in this execution; their preceding results remain historical. Independent `/root/cue_fit` review is requested before qualification/checklist updates.

Current SHA-256:

- Test: `b8366777c134b03ca0f10b179228e83d5a6c6446adc7976a73feb939021a16c9`
- Launcher: `5a2dc5c7019e6ddd5dfa44554056cfe7bfa5b18d068dbe29e58a28c1da973060`
- Client: `52129525e66e891068b15a1928a170ed7b6bb4dc35e7c6ba0afc4edb294eb015`
