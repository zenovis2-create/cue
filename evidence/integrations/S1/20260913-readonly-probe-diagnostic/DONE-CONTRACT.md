# Done contract: staged read-only probe diagnostic

Done means a new diagnostic probe client preserves the original permission attempts while a single-shot wrapper records a nonce-bound, exclusive diagnostic for failures in the closed stages `evaluation`, `setup`, `port`, `socket`, `callback`, and `result-write`. `evaluation` begins at the wrapper's body entry; CommonJS parsing and module loading before that entry remain unobserved. The record contains only a fixed version, stage, 64-character lowercase-hex nonce, and bounded typed error name/code; it contains no message or path. `result.json` is also exclusive. Missing or malformed result data, or coexistence with a diagnostic, never establishes permission authority.

Diagnostic persistence uses fixed exit `71`; diagnostic-write failure uses fixed exit `72`, does not retry, and cannot replace an existing file. The fixed port remains `48193`; the nonce is a second fixed argv value rather than an environment expansion. The historical probe client and gates remain byte-identical.

Attempt cap: two evidence-based implementation corrections.

Every pass runs `node --test scripts/reuse/fixtures/readonly-verifier-diagnostic-client.test.cjs`, `node --check` on source and test, hashes the historical probe client, and checks the scoped diff. The test must execute the production wrapper with injected filesystem/network/process behavior and cover evaluation, setup, port, socket, callback, result-write, malformed or oversized errors, duplicate recording, and diagnostic-write failure.

No native child, AppContainer, model, provider, credential, or network call is allowed. On failure after the cap, stop and hand back to root.
