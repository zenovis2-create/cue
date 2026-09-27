# Historical receipt replay hostile check

Base test SHA-256 before temporary addition: `9A5D3EFBA1EEB3212FBF2789E7130F695773CF28509F8F3C709FC3F1070AF2D7`.

Done: append a same-attempt orchestration receipt revision after a successful authoritative handoff-cost capture; the stored fact must replay unchanged.
Attempt cap: 2.
Every pass: run only `integration-evaluation-measured-facts.test.ts` with single-worker verbose Vitest.
Failure: hand the exact lineage finding to root; do not weaken current-capture freshness.

Temporary assertion body (removed after the observed pass):
```ts
test('handoff attribution replay ignores a newer orchestration receipt outside its stored cutoff',()=>{const f=monetaryFixture(),bytes=Buffer.from('synthetic-final-invoice-partitions'),evidenceDigest=h('synthetic-final-invoice-partitions');f.host.resolveEvidence=(ref:string)=>ref==='input-ref'?Buffer.from('input'):ref==='invoice'?bytes:null;const item=(attemptId:string,requestId:string,totalUnits:number,baseUnits:number,verificationUnits:number,handoffUnits:number)=>{const a=f.snapshot.items.find((x:any)=>x.requestId===requestId)!;return{attributionId:`allocation-${requestId}`,runId:'run',requestId,attemptId,budgetReceiptId:a.latestAtCutoff!.receiptId,budgetReceiptRevision:a.latestAtCutoff!.revision,budgetReceiptDigest:a.latestAtCutoff!.payloadDigest,handoffId:`handoff-${attemptId}`,handoffDigest:h(JSON.stringify({attemptId})),executionReceiptId:`terminal-${attemptId}`,executionReceiptRevision:1,totalUnits,baseUnits,retryUnits:0,verificationUnits,handoffUnits,currency:'TEST',unit:'minor',evidenceRef:'invoice',evidenceDigest,observedAtMs:39}};f.host.captureHandoffAttribution=()=>({version:'cue-handoff-cost-attribution-batch-v1',runId:'run',accountingDigest:f.snapshot.digest,items:[item('base','one',20,15,0,5),item('verify','two',30,0,25,5)]});f.raw.uncertaintyReasons=f.raw.uncertaintyReasons.filter((x:string)=>!x.startsWith('handoff-cost-disposition-unavailable:'));const saved=f.store.capture({factId:'partitioned-newer-receipt',enrollmentId:'enrollment',observationId:'observation'});f.db.prepare('INSERT INTO orchestration_receipt VALUES(?,?,?,?)').run('later-base','base',2,JSON.stringify({attemptId:'base',receiptId:'later-base',revision:2,outcome:'succeeded',cleanup:'clean'}));expect(f.store.read('partitioned-newer-receipt')).toEqual(saved);f.db.close()});
```

Observed result: exit 1, 1 file; 11 passed and the hostile check failed with `handoff_accounting_handoff` at `validateLineage`, proving the stored read consulted current `MAX(revision)`.
