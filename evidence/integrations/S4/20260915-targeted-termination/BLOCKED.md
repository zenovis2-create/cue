# Maker result — BLOCKED after cap 3

No product source or build output changed. The new Windows process test used all three planned corrections.

1. Pass 1: target tree termination and immediate sibling PID liveness succeeded, but the controller-authored heartbeat did not advance.
2. Pass 2: heartbeat ownership moved to the grandchild, but the fixture encoded literal backslash-n bytes, so line counting remained constant.
3. Pass 3: heartbeat changed to byte-size measurement. Target death, sibling controller/grandchild liveness, and sibling heartbeat advancement passed. The remaining assertion required the target audit closure to equal exactly the two explicitly created PIDs. Actual closure was `{95368,50336,113148,69012}` while the explicit controller/grandchild set was `{95368,113148}`. The extra PIDs were descendants attributed by the production observation. The test failed before checking only that sibling PIDs were excluded.

The next distinct correction would assert that the closure contains the explicit target identities and excludes both exact sibling identities, while retaining all additional observed descendants in the receipt and requiring them dead. Exact two-PID equality is not a valid process-tree contract. The attempt cap is exhausted, so that change and another OS run were not performed.

Final focused run: 4 existing files passed, the new file failed; 9/10 tests passed. All spawned processes and owned temporary roots were cleaned by the test finally path.

Hashes:

- test: `7381466ECD805B8C94AB095E61B90D5414831476368C95CB0CE7B477CC6BBE07`
- PLAN: `9192262B239A36A71689206F848772D8DAA995AEEF67BF36E73967C77AAEE1C5`

This does not close A03, S4-06, provider termination, or actual parent-death proof.

