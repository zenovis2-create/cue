# Compiled fixture declaration correction
Root requested after a later typecheck revealed TS7016: build emits JS without matching declarations. The test now imports the same compiled path dynamically and annotates its module shape with typeof the source module. Runtime path unchanged; no production or tsconfig changes.
Current test SHA256: 3F7A22FF637759A19FE3331CA24911D4BDE1CABA47C2D7DA962CCC094528FB6F
Gate: typecheck exit0; combined local-driver4 + picker IPC2 =6PASS. Prior reviewed assertion semantics unchanged; root/reviewer notified.
