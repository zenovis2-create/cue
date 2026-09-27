# Installed protocol observation

Done: record installed CLI version/help and a generated Codex stable JSON schema bundle; parse every generated JSON file, capture deterministic file hashes and identify the methods consumed by Cue. This is protocol observation only, not authentication, native isolation, model access or execution qualification.

Cap: two diagnosed collection attempts. Each pass checks process exit, output bounds, parseability and wrapper/executable fingerprints. No model prompt, login, credentials, server listener or external write. Root owns only this evidence directory.

Observed before capture: codex-cli 0.154.0 (exit 0, c56924); Claude Code 2.1.267 (exit 0, 0553bc). Codex wrapper SHA-256 0c149db80ed0bf442c810146b0ad0163b74982fe4542d673f56c354d7b8229cb; Claude executable SHA-256 23dde2a47cf1d7d9c4a2d96d21fa80ea9bfc872dfde0ee06e9982d2908603350. The Codex wrapper hash is not the native executable hash. No historical manifest pin is replaced.

Installed help confirms `codex app-server generate-json-schema --out <DIR>` with experimental fields opt-in; this capture omits experimental mode. Claude version/help alone does not establish a supported stream dialect.
