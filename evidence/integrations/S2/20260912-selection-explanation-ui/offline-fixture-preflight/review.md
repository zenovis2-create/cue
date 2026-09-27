# Corrected fixture preflight

Command `node fixture-preflight.mjs` exited 0 in 0.7255492 seconds (tool chunk 608426). This was Node-only, not Electron or a native executor. [Result](result.json) and [checks](checks.json) pass.

The sole fixture correction transitions its owned prepared task from awaiting_approval to running after policy binding and before direct compiled engine start. It matches the existing engine test fixture. This is explicitly synthetic activation, not user approval; no product guard changed. Original fixture SHA `9639FF0D27238B6BB902E0518AF93C42C3DEB935199F9F1E08A93E1E1E409F41` is preserved in `../stored-fixture.attempt1.mjs`, alongside all Electron attempt-1 failure artifacts.

Real core and compiled engine/store/projection produced two immutable decisions from local and TEST monetary policies. Both synthetic runtime starts returned denial. Counts: tasks/runs/attempts/selection rows each 2; approval/session/native identity rows each 0. Core completion reads matched stored projection without SQLite changes. Both remain unverified acceptance with unknown cleanup. Fetch calls were 0; no adapter/helper/provider was constructed.

SQLite backup integrity is ok, SHA `d23b67c9a7c152360127db035d8bdd1652bcebe7ceb95fba1c99629d9f2b811a`. Core closed and only owned root `D:\Temp\User\cue-selection-preflight-fVxuG8` was removed with actual absence verified. Selected before/after bytes matched; this is a bounded snapshot, not full installation qualification. No Electron screenshot or UI pass follows this result.

Remaining actual Electron attempt 2 requires final renderer review, source/build freeze and explicit root signal. Current proof hashes:

- electron-proof.mjs: `09EC00CF5FFC8A2305AE85E7ABC8801ABF7E24A0E3BD872E35756C35926F3CC2`
- scenarios.mjs: `4392DAED501A1F4CFE2C8724D7A5FBCCE3FB13AC0806A73FDF199237883B1B97`
- corrected stored-fixture.mjs: `2430EB1DB770456EAC8486AB02B9ED3337CE692A9873F8A1F67CF0D580F1F275`
