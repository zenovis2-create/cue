# Independent partial-restoration/reopen review

Verdict: CLEAR for the bounded test design, pending the root's final combined raw gate.

The extracted fixture preserves the original two driver cases and invokes its
configuration callback before driver preparation. The hostile test uses two real
Git targets and real native publication, then injects a factory-hash-bound,
deterministic reconciliation schedule: the first native restoration commits and
the second contends after an explicit divergence. It proves cleanup is not called,
records unknown cleanup, retains the lease, withholds the receipt, and leaves both
committed publication rows intact. After closing and reopening SQLite, a new driver
has no prepared in-memory entry, refuses start with `driver_prepare_missing`, and
does not publish, reconcile, or clean again.

This is a SQLite reopen and new driver in the same process. It is not an OS crash
or process-restart test. Source pins and final combined gate results are to be
appended by root after freeze.
