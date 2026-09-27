# Offline evaluation follow-up — FAILED realm adapter

The guarded offline run reached the primary evaluation form but timed out waiting for registration. Failure/result/backup are preserved. Guard and cleanup errors were empty; core closed and only owned root `D:\Temp\User\cue-evaluation-followup-preflight-mzri1N` was removed. Backup integrity ok, SHA `e66c8dfe2cf371e97ba33c15d37b903291e82d77a611aa48a3797399b48e2da8`. No Electron/model/helper/native executor ran.

Read-only source diagnosis and pure IPC probe (tool chunk 4ec441, exit 0) reproduced a missing Electron serialization step in the JSDOM adapter. A raw JSDOM observe DTO has a foreign Object prototype and is rejected by the real strict setupRecord check with IPC setup input denied. structuredClone of the same DTO passes schema validation and reaches the normal no-prepared-run unavailable branch. The probe had no core or database and performed no mutation.

The intended minimal correction is cloning offline IPC inputs into the host realm, matching actual Electron structured cloning. It does not relax product validation or modify the actual Electron proof. No replay has been run; the correction and next offline output directory await root authorization. This is independent of the already corrected legacy-policy fixture prerequisite.
