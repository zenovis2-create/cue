# Native identity commit — actual no-model QA PASS

2026-09-12. Independent QA executor; product sources were not edited. [Proof](../native-proof.mjs) was reviewed by root before this single invocation. [Result](result.json), [raw execution observations](executions.json), [cleanup](cleanup.json), [SQLite backup](ledger-backup.sqlite), [backup receipt](backup.json), [owned state](owned-state.json).

The command `node evidence/integrations/S1/20260911-native-identity-commit/native-proof.mjs --run` exited 0 in 7.16 seconds. Exactly two native executors ran: one model client with a fixed host generator, and one deterministic JSON checker. The generator was called once; no provider or global fetch call occurred. Both exclusive fsynced per-kind intent markers remain outside the attempt directory, preventing an attempt-directory retry from resetting this allowance.

Before the model transport yielded its first response, a separate read-only SQLite connection read and hashed the committed identity row. Targeted PowerShell/.NET process inspection independently matched all three stored PID/FileTime pairs while live:

| Process | PID | UTC Windows FileTime |
| --- | --- | --- |
| Launcher | 49160 | 134336130990995969 |
| Client | 92996 | 134336131016038901 |
| Guardian | 42716 | 134336130997984266 |

[Pre-response receipt](model-before-response.json) SHA-256 `2F04DCF54756DF1730A153DCB727E179D03A7DE2A40C4023F7B68DFCBBD61F39`. Both completed executors' recorded DTOs matched their raw protected host/client frames. The model returned the known fixed text, and the JSON checker returned `pass`. Checker live start times were not independently sampled; its durable identity, raw frames, deterministic result and cleanup were checked after execution. This does not independently prove checker authorization ordering beyond the separately reviewed implementation.

All six exact PIDs were absent afterward: model 49160/92996/42716 and checker 62980/52076/9112. `lstat` returned ENOENT for each exact task root, AC path and parent profile directory. Other errors would have remained unknown. No broad process/profile search or unknown-profile deletion occurred. Successful cleanup observations were retained without repeating them in finalization.

The consistent `VACUUM INTO` archive contains two identity rows and passes SQLite integrity checking. Backup SHA-256 `CEBD4069DD268DF8C6E1154A24593158FCCC5BDF8CD6F6A91DBF31E236DFB140`. The original owned temporary directory was removed only after every dispatch intent had its identity and cleanup evidence and the archive was verified.

[Selected before hashes](before.json), [after hashes](after.json), [final hashes](final-manifest.json) and [reviewed build comparison](reviewed-hashes-check.json) all passed. These cover the selected adapter/control/store/envelope/checker-core source and compiled files, proof script and Node executable; they are not full installed-generation or arbitrary write/revert prevention evidence. Final result SHA-256 `C33F39AAC401AB8763029E1EAC34A42E92EDADA1CF812D84A0E308E31CFFDBE9`.

No orchestration attempt, capability qualification, acceptance decision, Qwen request or paid call was created. Session/run fixtures exist for native ownership lineage. No additional execution is authorized by this PASS; historical live failures remain unchanged.
