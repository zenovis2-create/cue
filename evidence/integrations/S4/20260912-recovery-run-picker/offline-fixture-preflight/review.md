# Genuine protected-host fixture preflight

`node fixture-preflight.mjs` exited 0 in 6.9700789 seconds, tool chunk 587ca8. Syntax check also passed. [Result](result.json) passed; this was Node-only and consumed no Electron attempt.

The genuine installation generation was captured before dynamic core and protected-host imports. The unmodified protected host executed one listRecoveryRuns and one listNativeIdentities call. [Checks](checks.json) show exactly the two intended workflow parents, both no-recorded-identities; the foreign-workspace run and explicitly linked child were excluded. Identity records were empty and SQLite total_changes was unchanged across both reads. Full current-generation assertion and selected before/after manifests passed.

Fixture writes remain explicitly synthetic: four task/run rows and one compiled-store claim with structural child link, no native identity/session/approval. Neither arbitrary stage JSON nor the fixture's running state proves execution provenance or user approval. No observe/helper/provider/adapter/Electron invocation occurred; fetch calls were zero.

Backup integrity is ok, SHA `122bd864417c97f9091b804916c955c0b6cd96a0b5ed28c3d791731651089b61`. Core closed and only owned root `D:\Temp\User\cue-picker-preflight-e1nEwB` was removed with actual absence verified. Errors are empty.

No fixture correction was needed. Electron proof remains SHA `31DEB1294807F59FF80A19624D611949CCCE0886FCB8C5B09310AD91F54CAF06`; Node preflight SHA `3502E75BD0E0C41B5DD536B46F0674B043BF419ECECDDDE8D8159A49F594C3B2`. Actual Electron proof still awaits explicit root run signal; this receipt is not UI PASS or current execution qualification.
