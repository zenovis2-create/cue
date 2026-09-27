# S2 cost/capacity observation independent review — 2026-09-12

## Verdict

**PASS — narrow pure observation component only.** No blocker was found in `daemon/src/selection/cost-capacity-observation.ts` or its focused test. The component distinguishes supplied cost state and derived freshness, rejects invalid/hostile inputs before any callback or authority-bearing action, returns a deterministic immutable snapshot, and remains disconnected from selection, admission, budget, promotion, and dispatch.

This verdict does **not** verify any current provider price, subscription entitlement/quota, provider billing termination, local GPU identity/capacity/load, or local-resource valuation. It does not complete the broad checklist rows 102, 103, 105, or 106; all four remained unchecked at review time. A trusted producer, host integration, authority-path regression, and live/provider evidence are still required by `docs/INTEGRATION_SPEC.md` and `evidence/integrations/S2/20260912-gap-design.md`.

Reviewed at repository HEAD `8e2afa6366e3af62f7115b2c67be799130f8dfdf` with Node `v24.18.0` and npm `12.0.1`. The worktree was already broadly dirty; the reviewed source and test were untracked. I changed no product source, test, or documentation file.

## Findings against the review criteria

1. **actual / estimated / unknown / stale and default-deny — PASS.** `costState` accepts only `actual | estimated | unknown`; unknown requires `units: null`, while actual/estimated require safe nonnegative integer units and an estimated zero is rejected (`cost-capacity-observation.ts:106-124`). Freshness is independently derived as `future | stale | fresh` solely from `observedAtMs`, `validUntilMs`, `nowMs`, and `maxAgeMs`; caller-supplied freshness and extra fields are rejected (`:59-69`, `:145-156`). Unknown/unavailable states produce deterministic ordered denial reasons. A fresh known observation can have no denial reason, but it still cannot authorize anything because all returned authority is fixed inert data.

2. **No unsupported price/quota/GPU/billing inference — PASS.** The API/subscription/local-resource matrices are explicit (`:127-143`): API GPU must be `not-applicable`; subscription price remains unknown and GPU is not applicable; local price/quota/billing remain unknown and GPU must be explicitly supplied. No conversion, fetch, callback, receipt verification, or provider/local probe exists. `billing: final` is accepted only alongside descriptive `actual` cost, but the return has no `providerFinal` or verified-receipt field and confers no authority. The source digest and label are copied provenance fields, not truth verification.

3. **No selection/budget/admission/promotion/dispatch authority — PASS.** The return fixes `authority: 'observation-only'` and candidate, budget, and selection authority to `false` (`:158-163`). Admission, promotion, dispatch, and `providerFinal` fields are absent. Repository search found `snapshotCostCapacityObservation` only in this module, its focused test, and S2 evidence/design records; there is no product consumer or path to selection, reservation, settlement, admission, promotion, or dispatch.

4. **Hostile and oversized input rejection before side effects — PASS.** `types.isProxy` precedes `Array.isArray` and all property introspection; normal arrays/sparse arrays, proxies including revoked proxies, custom prototypes, accessor fields, symbol/unknown keys, and non-exact records are rejected (`:59-69`). Property descriptors copy data without invoking getters. Safe-integer checks reject NaN, infinity, fractions, negatives, and unsafe integers; reference/currency/digest grammars bound strings. Focused tests prove zero getter/`toJSON`/proxy touches, and the independent probe additionally rejected a maximum-length sparse array, 129-character reference, extra getter, trap proxy, and revoked proxy with `touched: 0`. Duplicate names are not representable in the accepted JavaScript record; any extra surviving own key fails the exact key count.

5. **Immutable and deterministic result — PASS.** The snapshot and its only nested aggregate, `denialReasons`, are frozen (`:158-163`). All other fields are copied primitives. Focused tests verify equal repeated results, frozen structures, mutation rejection, and isolation from later input mutation. The independent probe also reported `frozen: true` and `deterministic: true`.

6. **Maker verification independently reproduced — PASS.** All four claimed commands completed with exit code 0. The focused result was 9/9, the selected regression result was 27/27, TypeScript emitted no diagnostics, and build completed. The reviewed hashes exactly match the implementation record both before and after verification.

7. **Current truth and broad checklist boundary — PASS.** No live provider, account, billing, or GPU observation was performed or represented as verified. `docs/INTEGRATION_CHECKLIST.md` rows 102, 103, 105, and 106 were all `[ ]` at review time. This component establishes an inert vocabulary and validation boundary only.

No blocker or corrective product change is requested.

## Deterministic hashes

Command:

```powershell
Get-FileHash -Algorithm SHA256 'daemon\src\selection\cost-capacity-observation.ts','daemon\test\integration-cost-capacity-observation.test.ts' | ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), (Resolve-Path -Relative $_.Path) }
```

Exit code: `0`.

```text
aa10dc9b637f93937b363f683022a2921a574703920e1443d97690443d67b11d  .\daemon\src\selection\cost-capacity-observation.ts
5c50708f1c256bf3bb201ffa68f9008a73419dae097ecfd654bb0a9e15b6cbfd  .\daemon\test\integration-cost-capacity-observation.test.ts
```

## Independent command reproduction

Run from `C:\Users\User\cue\daemon`:

```text
npx --no-install vitest run test/integration-cost-capacity-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Exit code `0`: 1 test file passed, 9 tests passed.

```text
npx --no-install vitest run test/integration-selection.test.ts test/integration-budget.test.ts test/capability-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Exit code `0`: 3 test files passed, 27 tests passed.

```text
npx --no-install tsc --noEmit -p tsconfig.json
```

Exit code `0`; no diagnostics.

```text
npm run build
```

Exit code `0`; `tsc -p tsconfig.json && node scripts/copy-assets.mjs` completed.

The design record's example command names `test/integration-capability-admission.test.ts`, but that path does not exist in this worktree. The maker record and independently reproduced regression use the present file `test/capability-admission.test.ts`; this is a non-blocking command-path discrepancy in the design record, not a product failure.

## Additional hostile-input probe

Run from `C:\Users\User\cue\daemon` after the successful build:

```text
node --input-type=module -e "import { snapshotCostCapacityObservation as s } from './dist/src/selection/cost-capacity-observation.js'; import { createHash } from 'node:crypto'; const d=createHash('sha256').update('probe').digest('hex'); const b={version:'cue-cost-capacity-observation-v1',candidateId:'candidate:probe',providerId:'provider:probe',accountRef:'account:probe',costDimension:'api',costState:'estimated',units:1,currency:'USD',unit:'micro',sourceRef:'provider:probe:v1',sourceDigest:d,observedAtMs:1000,validUntilMs:1200,price:'known',quota:'available',gpu:'not-applicable',billing:'open'}; let touched=0; const sparse=new Array(4294967295); Object.defineProperty(sparse,0,{get(){touched++;throw Error('sparse-getter')}}); const oversize={...b,candidateId:'a'.repeat(129)}; const extra=Object.defineProperty({...b},'extra',{enumerable:true,get(){touched++;throw Error('extra-getter')}}); const trapped=new Proxy(b,{getPrototypeOf(){touched++;throw Error('proxy')}}); const revoked=Proxy.revocable(b,{}); revoked.revoke(); const bad=[sparse,oversize,extra,trapped,revoked.proxy]; const rejects=bad.map(v=>{try{s(v,1100,500);return false}catch(e){return e instanceof TypeError&&e.message==='invalid_cost_capacity_observation'}}); const u=s({...b,costState:'unknown',units:null,price:'unknown',quota:'unknown'},1100,500); const l=s({...b,costDimension:'local-resource',costState:'unknown',units:null,currency:null,unit:'local-resource-unit',price:'unknown',quota:'unknown',gpu:'unknown',billing:'unknown'},1100,500); const a=s({...b,costState:'actual',billing:'final'},1100,500); const out={rejects,touched,unknownDenials:u.denialReasons,localUnknownDenials:l.denialReasons,actualDescriptive:{costState:a.costState,billing:a.billing,authority:a.authority,candidateAuthority:a.candidateAuthority,budgetAuthority:a.budgetAuthority,selectionAuthority:a.selectionAuthority},extraAuthorityKeys:['admissionAuthority','promotionAuthority','dispatchAuthority','providerFinal'].filter(k=>Object.hasOwn(a,k)),frozen:Object.isFrozen(a)&&Object.isFrozen(a.denialReasons),deterministic:JSON.stringify(a)===JSON.stringify(s({...b,costState:'actual',billing:'final'},1100,500))}; console.log(JSON.stringify(out)); if(!rejects.every(Boolean)||touched!==0||out.extraAuthorityKeys.length||!out.frozen||!out.deterministic)process.exitCode=1;"
```

Exit code `0`. Exact output:

```json
{"rejects":[true,true,true,true,true],"touched":0,"unknownDenials":["cost-unknown","price-unknown","quota-unknown"],"localUnknownDenials":["cost-unknown","gpu-unknown"],"actualDescriptive":{"costState":"actual","billing":"final","authority":"observation-only","candidateAuthority":false,"budgetAuthority":false,"selectionAuthority":false},"extraAuthorityKeys":[],"frozen":true,"deterministic":true}
```

## Remaining boundary

The following remain outside this PASS and must not be inferred from it: current provider price or quota, subscription entitlement/throttling, verified billing finality, actual local GPU memory/load/allocation, reservation retention/release, retry/verification/handoff accounting, selection/admission integration, cold-start defaults, exploration budget, UI, and live Electron/provider evidence. Therefore checklist rows 102/103/105/106 remain open.
