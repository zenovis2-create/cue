# New independent UI race findings

IPC correction cap1 completed successfully and remains closed. Independent static review identified two separate UI races in maker code: selecting B during pending A changes input but drops B; list failure clears output without invalidating pending detail. This bounded correction owns renderer and measured UI test only. Done: deterministic deferred-promise cases ensure newest selection wins (old success/error ignored) and listfailure invalidates pendingdetail while preserving typedID. Before edit eight full current files preserved in before-ui-correction/. UI correction cap2; each pass npm run build and exact3file focused verbose gate exit0. Fail requires new hypothesis, stop if exhausted. Independent reviewer stays separate. No other scope or live work.

## UI correction pass1

Build2f4c31 exit0 after actual renderer/test progress. Exact verbose gatee59fb9/a6c8dc3files35/35 exit0, raw ui-correction-vitest.log. Deferred A success cannot override selectedB; list error invalidates delayed detail and preserves editable typedID. Final8 pins updated. No second UI correction pass used. Independent checker notified.
