# Maker result

- Pass 1: 13/14. Historical read passed; the fresh-capture assertion reused an occupied measured-fact tuple and was correctly intercepted by replay conflict.
- Pass 2: 14/14. The fresh-capture assertion directly exercises `createHandoffAccountingStore.prepare` after receipt revision 2 is appended and receives exact `handoff_accounting_handoff` refusal.
- Final build: exit 0.

Historical projection reads validate the exact captured receipt and handoff without querying the current maximum receipt revision. Prepare and commit retain the current-latest check.

Pins: source `F4AEFDFD192EF28F110F793EBD66D83A5715F2E51C65C393E484F71935CC8072`; compiled JS `AE7EE25E692BB8756C7FDBFC097182F3507EE7C779136E920456C50A83394718`; compiled migration 045 `5224355DBF7FDA9157520B4A450FED275B441FE522F88EABA759FA81D935A248`.
