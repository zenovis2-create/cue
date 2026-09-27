# Root bounded correction contract

Maker cap2 ended with wrong fixture table names; product completion not claimed. Independent static reviewer additionally found stale comparison-create status after new run.

Done: correct only selection_policy fixture table reference to actual selection_policy_snapshot, reset create status in existing selectEvaluationRun and assert it before and after stale response. Focused UI/Core tests exit0, final daemon build0 and JS syntax0; independent checker reproduces gates. Cap2 correction passes; every pass focused tests/syntax, failures require new hypothesis. Preserve prior failures. Captured all eight pre-correction files/hashes. No model/server/native/network/live Electron calls.

Pass1 gate a539fa: UI11 pass, Core1 fail because expected bounded list omitted newly inserted snapshot-ui. Next hypothesis: list must include the valid third snapshot. Pass2 corrects that expected inventory and adds missing direct create reopen/conflict/foreign/tamper assertions; no further product edit.

Pass2 result: focused2files12/12 exit0 (fd22f2), final daemon build0 (7d5cfd), JS syntax/scoped diff0 (95a861; line-ending warnings only). Added actual create same-ID/different valid membership conflict, reopened replay, foreign create and corrupted projection rejection without extra snapshot/runtime/approval/policy rows. Test-only tamper disables the update trigger on disposable fixture DB. Final8 hashes recorded in final-pins.json. Independent review pending.
