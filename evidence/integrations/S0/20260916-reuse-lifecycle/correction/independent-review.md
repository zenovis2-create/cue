# Independent correction review — selected reuse basis

Verdict: **CLEAR for the two previously blocked consumer defects.** No R-03 through R-06 parent item closes from this bounded fixture consumer.

`readSelectedReuseBasis()` now consumes the host-selected R-04/R-05/R-06 catalog rows, requires one exact row for each ID, binds each selected revision to its first selected source hash, verifies every selected source byte reference, and verifies the R-04/R-06 manifest or R-05 decision descriptor. Its revision is the canonical digest of the three ordered decision/revision tuples; its manifest digest covers the canonical selected rows, including descriptor and selected-byte references. Generated receipts carry that selection binding, so a catalog revision, descriptor pin/bytes, or selected source pin/bytes change invalidates the old receipt.

Fallback no longer contains caller-asserted `pinned` or `binding` authority. The pure evaluator accepts fallback only when its observed triple exactly equals the trusted current binding. The real consumer derives that observation from fallback receipt bytes, then compares every selected receipt/result byte with freshly generated current bytes before returning. An arbitrary old or alternate revision cannot self-authorize. The evaluator's result remains a pure eligibility observation and grants no dispatch or adoption authority.

Independent gates passed 5/5 Node receipt tests and 8/8 focused manifest tests at the hashes recorded in `independent-review.raw.log`. The tests cover copied-catalog selected-revision drift, descriptor byte drift, intentional descriptor repinning against old receipt/fallback, malformed descriptor bytes, and arbitrary fallback refusal. Reader protections for exact fields, bounded plain data, local paths, regular files, symlink/junction refusal, hash binding, and read-stability remain present.

Scope remains deliberately narrow. R-03 historical transport cancellation/restart/duplicate evidence remains incomplete. R-04/R-05/R-06 receipts describe Cue-authored fixture boundaries and do not prove selected upstream adoption, provider/runtime behavior, production dispatch, or broad reuse lifecycle closure.
