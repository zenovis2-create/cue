# A03 public-driver targeted Stop actual receipt

Both authorized actual OS attempts are consumed. Neither produced a passing closure result. Product/source pins remained byte-identical throughout.

Attempt 1 launched two owned executions but looked them up by workflow run IDs while the runtime map used persisted attempt/owner IDs. It failed before the identity assertions and its cleanup hook exceeded the original 10-second bound. The changed hypothesis bound each workflow to its real `orchestration_attempt.attempt_id`; independent review cleared that correction.

Attempt 2 reached the selected-run Stop. The injected cancel callback increments its counter before `terminateVerifiedTree` and child-close completion. The test waited only for that counter, then immediately evaluated the target death oracle. It observed at least one original PID/creation pair still live and failed at line 106. The fixture cleanup subsequently completed without a hook failure. Post-run observation found no matching current owned roots or heartbeat fixture processes, but this later name-filtered observation is not a substitute for the in-test exact identity assertion.

The run therefore does not prove the A03 targeted-Stop condition. It also emitted no durable raw per-run identity frame, so those identities cannot be reconstructed from the logs. Billing/provider behavior remains unknown; no provider or model was invoked. No retry is authorized.

- attempt 1 result SHA-256: `FC0465B0CDBC84E3395C43C10080F9A32A392C222898D46D6B58B2B28FA71EBF`
- attempt 1 log SHA-256: `B1914092392A61467D9C7F6A89649D7CAD8C0ADFB838CC60165E5017C45E2338`
- attempt 2 result SHA-256: `48C35B9C321AFD0A2A60B728313362A7A2D297AB3F8106280709351D7EE90A3B`
- attempt 2 log SHA-256: `07AAB4EACAFC559B860D4D09EADBDA26F5BDE7AB0AB87EB5CCD6B60A6029B3B7`
- final executed test SHA-256: `09E7E5BE38CF0F82B83A098618D500D9A5B45A52AA7565D45746C6E0468C5080`
- executed driver SHA-256: `2ED110D994E22910CD9B95DEAF5D7A0167C033165C6A41CD7512221277A050F0`
- process-termination source SHA-256: `D4ABCF16496838E8D2D279CC9D9C2E1DECB0063AA7C433BE98E2499020987F6C`
- process-termination dist SHA-256: `34375676C3688BE459E03009BF55F130E7794A9576F166D662BA9E4518AEB93A`
