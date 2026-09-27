# Independent regression fixture review

Root independently ran the eight affected fixture suites after migration 039 reopen was repaired. The durable report `focused-fixtures.json` records 55/55 tests passing across eight files, exit 0. The original baseline remains failed.

Reviewed changes preserve production contracts: cleanup rejection is tested using session drift instead of deleting an immutable identity's referenced session; required evidence policies bind fixture inputs and targets; dependent stages now have terminal handoff lineage; pre-025 history is seeded under its actual historical schema before applying later migrations. The bounded history test still excludes the oldest attempt from its 50 entries and counts the unresolved attempt globally; scalar cleanup flags without integrity evidence remain unknown in the UI.

The independent-connection claim test passed unchanged in this run, but its earlier `database is locked` failure has no demonstrated root-cause fix. It remains a possible timing-related regression to monitor in the final full gate. No production admission, foreign-key, handoff, or acceptance check was relaxed by these fixture changes.

The focused gate started no model/provider calls. Native cleanup fixtures used their existing owned local test boundaries. This is not broad S0-S7 completion or a substitute for the final full gate.
