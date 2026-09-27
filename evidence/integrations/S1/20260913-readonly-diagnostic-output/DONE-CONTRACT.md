# Done contract: explicit diagnostic output binding

Done means a new offline-tested diagnostic client accepts exactly `port`, `nonce`, and a host-bound Windows absolute runtime root in argv. It validates a 64-character lowercase-hex nonce and a bounded, NUL-free absolute runtime path, then uses only that argv path for exclusive `result.json` and `diagnostic.json` writes even when environment `TEMP` differs. The isolated eight-key environment contract is unchanged elsewhere.

The client preserves the original permission attempts and reviewed single-shot staged wrapper. Diagnostic success remains exit `71`. When diagnostic persistence fails, the closed stages map to fixed reserved exits `80` through `85`; those exits reveal only the wrapper stage and never establish permission or command authority. Missing or malformed output and diagnostic/result coexistence remain fail-closed.

Attempt cap: two evidence-based corrections. Every pass runs the real client wrapper with injected filesystem/network/process behavior, covering different environment TEMP, exact host output, invalid/missing path and nonce, every stage-specific write-failure exit, the prior staged matrix, hostile values, single-shot behavior, exclusive writes, and coexistence rejection. It also runs Node syntax checks, historical client hashes, and scoped diff checks.

No native child, AppContainer, model, provider, credential, or network operation is authorized by this unit. It does not establish the actual child-effective TEMP.
