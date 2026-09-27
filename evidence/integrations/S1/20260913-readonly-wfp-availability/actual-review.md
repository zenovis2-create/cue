# Independent actual WFP availability-query review

Status: **UNKNOWN / QUERY DENIED.** The one read-only query completed as a process, but `FwpmEngineGetOption0` returned code 5 (`ERROR_ACCESS_DENIED`). This does not show that network-event collection is disabled.

## Preserved evidence

- Query receipt: `136816A64ABE9FD65686C68F823DD816808BAB1BC9C52B0F2EA966BA132AF1BD`
- Queried script: `C7B44F9B481F27F46A54C6B6DF88CD0B98FC2EFF2F45C49C8FB70E3561E4784B`
- Tool receipt: `075415`; attempts: 1; process exit: 0.

The bounded observation is:

```json
{"state":"unknown","openCode":0,"getCode":5,"closeCode":0,"valueType":null,"collectNetEvents":null}
```

`openCode:0` establishes that the local filter-engine session opened, and `closeCode:0` establishes that it closed. Microsoft defines system error 5 as `ERROR_ACCESS_DENIED`; here it means the option read failed. Because no `FWP_VALUE0` was obtained, the helper correctly reports null type/value and `state:"unknown"`.

This result provides no evidence that `FWPM_ENGINE_COLLECT_NET_EVENTS` is 0 or 1. It grants no subscription access and does not explain the earlier worker timeout. It also provides no runtime, WFP drop-event, network-policy, or permission-boundary proof.

The executed script's reviewed call surface contains only engine open, get-option, close, and returned-memory free. It contains no option setter, event subscription, audit-policy command, firewall/policy mutation, worker launch, profile operation, model, provider, or network connection. No second query was run.
