# Hostile attribution fixtures

Done means table-driven, fresh-database fixtures demonstrate zero writes for foreign/nonfinal lineage, duplicate identities, unsafe or unequal partitions, and wrong cost class; a prepared batch whose lineage becomes stale during the transaction demonstrates complete rollback. The measured-facts focused suite must exit 0. Product source and dist remain frozen.

Attempt cap: two. Every pass runs `test/integration-evaluation-measured-facts.test.ts`. A genuine production failure is reported to root before any source edit; a second unresolved fixture failure is handed off.
