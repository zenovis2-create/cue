# Migration046 definition integrity correction
Independent ledger reviewer reproduced same-name no-op trigger accepted by startup. Names/count are insufficient.
Done: compare SQLite canonical schema produced from shipped046 in isolated in-memory reference to actual three tables/fourteen triggers; fresh/reopen pass and altered same-name trigger/table fail; build0; independent reviewer.
Cap2. Every pass focused migration+publication tests; new diagnosed hypothesis on failure. Preserve preimage. Only root-owned ledger.ts and new migration-definition test; no other migration edits.
Reference workspace lease table supplies the trigger attachment only. No user data copied or external execution. Strict schema text equality intentionally invalidates altered schema, not a defense against compromise of code/migration bytes themselves.
