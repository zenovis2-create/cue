# Remaining attempt 2 — prepare only

Original proof is preserved as electron-proof.attempt1.mjs, SHA `17B447E72152EFD78119219A8E07E68F945CE23B0DB5600A94D04C4E2894199D`. Original attempt-1 failure/timeout/final verdict/HTML/SQLite/owned receipts are unchanged. Its backup integrity is ok, SHA `695690826616cd6797a86074b0cddefdb13f1de361869b9be3e809a4f27b7ce5`.

New diagnosed hypothesis: a debugger-evaluated requestAnimationFrame promise can stall in the JavaScript-disabled report document. Replace only that QA wait with a 100ms host-process timer and capture through CDP. Product JavaScript/CSP/preload/Node settings remain unchanged. Host timing does not prove paint; actual PNGs must be directly inspected if produced.

The proof records before/after checkpoints for window load, debugger attachment, each evaluation, scroll, host settle and capture. Evaluation is synchronous inspection without awaitPromise. Detach checks destroyed/attached state and catches cleanup exceptions, preserving the main diagnostic. The existing overall deadlines, backup, selected/full guard and exact cleanup aggregate remain.

Syntax check passed. Corrected proof SHA `B32E46E3FB7EDBC3A0272C83A846B3C1CEC610F603AB858BA43F4A750C3DC107`; fixture is unchanged. No Electron, helper, provider or model executed during preparation. Root review and explicit run signal are still required; only the remaining second attempt may run, without automatic retry.
