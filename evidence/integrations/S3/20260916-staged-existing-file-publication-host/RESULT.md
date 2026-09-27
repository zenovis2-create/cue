# Staged existing-file publication host result

The new adapter validates a driver contract against staged setup/authority,
running attempt and step, plan/run lineage, change set, and exact target bounds.
It registers only after a native execution-root identity check and reads exact
approved bytes through the native relative snapshot helper. Registration is
process-local, so reopening the database does not revive read authority.

Final authorization delegates the fully derived publication authority to the
trusted callback. Final execution is the existing native compare/write function.
The adapter grants no staging, candidate, provider, or configuration capability.
The driver and adapter share one contract-ID function.

Focused native tests pass 2/2 across exact read, authority delegation, expiry,
tampered ID/attempt/targets/bounds, duplicate/missing/traversal targets, and
unopened reads. Full no-emit compilation contains no errors from this unit; it
remains blocked by concurrent held-recovery source/tests recorded in the raw log.
The extracted public-driver real-Git fixture also passes 1/1: the production
adapter reads the distinct staged root, the driver publishes through the native
publisher, reconciliation removes the execution root, releases the lease, and a
fresh adapter over the same ledger cannot revive the process-local registration.
