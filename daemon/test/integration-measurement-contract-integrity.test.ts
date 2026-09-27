import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLedger,type Ledger} from '../src/ledger.js';
import * as contracts from '../src/evaluation/measurement-contracts.js';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {createEvaluationEnrollmentStore} from '../src/evaluation/enrollment.js';
import {createEvaluationObservationStore} from '../src/evaluation/observations.js';
import {createEvaluationMeasuredFactStore} from '../src/evaluation/measured-facts.js';
const dbs:Ledger[]=[],roots:string[]=[];afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function databasePath(){const root=mkdtempSync(join(tmpdir(),'cue-measurement-contract-'));roots.push(root);return join(root,'ledger.sqlite');}
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
function sorted(v:any):any{if(Array.isArray(v))return v.map(sorted);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])]));return v;}
function fixture(filename=':memory:'){const db=openLedger(filename);dbs.push(db);const definition:any={schemaRevision:'env-v1',complete:true,fields:{os:'fixture'}};
 const raw:any={id:'env',revision:'v1',sourceRevision:'producer-v1',sourceDigest:sha(JSON.stringify(sorted(definition))),definition};
 let now=20;const host={nowMs:vi.fn(()=>now),read:vi.fn(()=>raw)},store=contracts.createMeasurementContractStore(db,host);
 return{db,definition,raw,host,store,input:{id:'env',revision:'v1'},setTime:(value:number)=>now=value,rehash:()=>{raw.sourceDigest=sha(JSON.stringify(sorted(definition)));}};}

test('ordinary nested environment arrays round-trip in immutable canonical order',()=>{const f=fixture();f.definition.fields.devices=[{revision:'v1',id:'cpu'},['a','b'],null];f.rehash();const saved=f.store.registerEnvironment(f.input);expect(saved.definition).toEqual(sorted(f.definition));expect(f.store.readEnvironment(saved.digest)).toEqual(saved);expect(Object.isFrozen((saved.definition.fields as any).devices[0])).toBe(true);});

test('returned metric/environment nested snapshots cannot change without a new digest',()=>{const f=fixture(),saved=f.store.registerEnvironment(f.input);expect(Object.isFrozen(saved.definition)).toBe(true);expect(Object.isFrozen(saved.definition.fields)).toBe(true);expect(()=>{(saved.definition.fields as any).os='changed';}).toThrow();expect(saved.definition.fields).toEqual({os:'fixture'});});

test.each(['getter','proxy'])('host %s then probing is refused without executing user code',kind=>{const f=fixture();let touches=0;
 f.host.read.mockImplementation(()=>kind==='getter'?Object.defineProperty({...f.raw},'then',{enumerable:true,get(){touches++;throw Error('touched');}}):new Proxy(f.raw,{get(){touches++;throw Error('touched');}}));
 expect(()=>f.store.registerEnvironment(f.input)).toThrow();expect(touches).toBe(0);expect(f.db.prepare('SELECT count(*) n FROM evaluation_environment_snapshot').get()).toEqual({n:0});});

test('clock callback cannot change the already snapshotted host definition',()=>{const f=fixture();f.host.nowMs.mockImplementation(()=>{f.definition.fields.os='clock-mutated';f.rehash();return 20;});const saved=f.store.registerEnvironment(f.input);expect(saved.definition.fields).toEqual({os:'fixture'});});

test('identifier-only replay retains its original time and does not recapture host data',()=>{const f=fixture(),saved=f.store.registerEnvironment(f.input);f.setTime(999);f.host.read.mockImplementation(()=>{throw Error('must not recapture');});expect(f.store.registerEnvironment(f.input)).toEqual(saved);expect(f.host.read).toHaveBeenCalledOnce();expect(f.host.nowMs).toHaveBeenCalledOnce();});

test('offline registration cannot reuse a host slot or turn a fixture slot into host authority',()=>{const f=fixture(),offline=contracts.createOfflineFixtureMeasurementContractStore(f.db,f.host);const saved=offline.registerEnvironment(f.input);expect(saved.authorityClass).toBe('offline-fixture');expect(()=>f.store.registerEnvironment(f.input)).toThrow();expect(f.store.readEnvironment(saved.digest)?.authorityClass).toBe('offline-fixture');});

test('same-ledger cross-store host reentry is rejected and the fence releases on failure',()=>{const f=fixture(),other=contracts.createMeasurementContractStore(f.db,f.host);let calls=0;f.host.read.mockImplementation(()=>{if(++calls===1)return other.registerEnvironment(f.input) as any;return f.raw;});expect(()=>f.store.registerEnvironment(f.input)).toThrow();expect(calls).toBe(1);expect(f.db.prepare('SELECT count(*) n FROM evaluation_environment_snapshot').get()).toEqual({n:0});f.host.read.mockReturnValue(f.raw);expect(f.store.registerEnvironment(f.input).id).toBe('env');});

test('accessor array slots and sparse/extra/proxied arrays are rejected without getters',()=>{const f=fixture();let touches=0;const accessor=[1];Object.defineProperty(accessor,'0',{enumerable:true,get(){touches++;return 1;}});
 for(const values of [accessor,Array(1),Object.assign([1],{extra:2}),new Proxy([1],{get(){touches++;throw Error('trap');}})]){f.definition.fields.values=values;f.raw.sourceDigest=sha('unused');expect(()=>f.store.registerEnvironment(f.input)).toThrow();}
 expect(touches).toBe(0);});

test('circular, deep, nonfinite, huge and async host values refuse with zero registration',()=>{const f=fixture(),cyclic:any={};cyclic.self=cyclic;let deep:any={};for(let n=0;n<20;n++)deep={next:deep};
 for(const value of [cyclic,deep,Infinity,'x'.repeat(65537),Array(4097).fill(1)]){f.definition.fields.value=value;expect(()=>f.store.registerEnvironment(f.input)).toThrow();}
 f.host.read.mockReturnValue(Promise.resolve(f.raw) as any);expect(()=>f.store.registerEnvironment(f.input)).toThrow();expect(f.db.prepare('SELECT count(*) n FROM evaluation_environment_snapshot').get()).toEqual({n:0});});

test('legacy scalar canonical bytes and hashes remain unchanged',()=>{const f=fixture(),saved=f.store.registerEnvironment(f.input),value={kind:'environment',id:'env',revision:'v1',authorityClass:'host-observed',sourceRevision:'producer-v1',sourceDigest:f.raw.sourceDigest,observedAtMs:20,definition:sorted(f.definition)};expect(saved).toEqual({...value,digest:sha(JSON.stringify(value))});});

function factFixture(change?:(refs:any)=>void){
 const f=fixture(),db=f.db,defs:any={metric:{scoreMinimum:0,scoreMaximum:1,algorithmRevision:'v1'},environment:f.definition,accountLimits:{schemaRevision:'v1',complete:true,fields:{capacity:1}}};
 let raw:any;const host={nowMs:()=>10,read:(kind:string,id:string,revision:string)=>({id,revision,sourceRevision:'v1',sourceDigest:sha(JSON.stringify(sorted(defs[kind]))),definition:defs[kind]}),capture:()=>raw,resolveEvidence:(ref:string)=>ref==='input'?Buffer.from('input'):null,terminalIntegrity:(attemptId:string)=>({status:'verified',attemptId})};
 const registry=contracts.createMeasurementContractStore(db,host),metric=registry.registerMetric({id:'metric',revision:'v1'}),env=registry.registerEnvironment({id:'env',revision:'v1'}),limits=registry.registerAccountLimits({id:'limits',revision:'v1'});
 db.prepare("INSERT INTO task VALUES('task','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES('env','C:/fixture','[]','now')").run();db.prepare("INSERT INTO run VALUES('run','task','env',0,'now')").run();
 const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}});bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
 const refs={metric:{id:metric.id,revision:metric.revision,digest:metric.digest},environment:{id:env.id,revision:env.revision,digest:env.digest},accountLimits:{id:limits.id,revision:limits.revision,digest:limits.digest}};change?.(refs);
 createEvaluationEnrollmentStore(db).enroll({enrollmentId:'enrollment',runId:'run',dataset:{id:'dataset',revision:'v1',cases:[{id:'eval',kind:'code',split:'evaluation',inputDigest:sha('input')},{id:'hold',kind:'code',split:'holdout',inputDigest:sha('hold')}]},caseId:'eval',arm:'efficiency',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},...refs,enrolledAtMs:20});db.prepare("UPDATE task SET state='failed'").run();createEvaluationObservationStore(db).observe({enrollmentId:'enrollment',observationId:'observation',expectedPriorRevision:0},30);
 raw={producerRevision:'v1',producerDigest:sha('producer'),executedInput:{expectedDigest:sha('input'),actualDigest:sha('input'),matches:true,evidenceRef:'input',evidenceDigest:sha('input')},executionSubjects:[],activityCutoff:{attempts:[],manifestDigest:sha('[]')},quality:null,timing:null,environmentDigest:env.digest,accountLimitsDigest:limits.digest,priceDigest:null,accounting:{kind:'unknown'},uncertaintyReasons:['accounting-unavailable','quality-unavailable','timing-unavailable']};
 host.nowMs=()=>40;return{db,store:createEvaluationMeasuredFactStore(db,host),ids:{factId:'fact',enrollmentId:'enrollment',observationId:'observation'}};
}
test.each(['metric','environment','accountLimits'])('measured %s contract id/revision cannot be relabeled behind its valid digest',kind=>{
 for(const key of ['id','revision']){const f=factFixture(refs=>refs[kind][key]='different');expect(()=>f.store.capture(f.ids)).toThrow('dependency');expect(f.db.prepare('SELECT count(*) n FROM evaluation_measured_fact').get()).toEqual({n:0});}
});
test('fully matching measurement refs still persist missing measurements without creating a trial',()=>{const f=factFixture(),saved=f.store.capture(f.ids);expect(saved).toMatchObject({quality:null,timing:null,trialReady:false});expect(f.store.read('fact')).toEqual(saved);});

test('producer serializer canonicalizes once without issuing authority or invoking prototype setters',()=>{
 const a=contracts.freezeMeasurementDefinition({fields:JSON.parse('{"z":[1,2],"__proto__":{"polluted":true},"a":null}'),complete:false,schemaRevision:'v1'});
 const b=contracts.freezeMeasurementDefinition({schemaRevision:'v1',complete:false,fields:JSON.parse('{"a":null,"__proto__":{"polluted":true},"z":[1,2]}')});
 expect(a).toEqual(b);expect(a.sourceDigest).toBe(sha(JSON.stringify(a.definition)));expect(Object.hasOwn(a,'authorityClass')).toBe(false);
 expect(Object.getPrototypeOf(a.definition.fields)).toBe(Object.prototype);expect(Object.hasOwn(a.definition.fields as object,'__proto__')).toBe(true);expect(({} as any).polluted).toBeUndefined();
 const f=fixture();f.raw.definition=a.definition;f.raw.sourceDigest=a.sourceDigest;expect(f.store.registerEnvironment(f.input).definition).toEqual(a.definition);
});

test('legacy non-callable toJSON data remains readable without executing a serialization hook',()=>{
 const f=fixture();f.definition.fields.toJSON='ordinary-data';f.rehash();const saved=f.store.registerEnvironment(f.input);expect(saved.definition.fields).toEqual({os:'fixture',toJSON:'ordinary-data'});expect(f.store.readEnvironment(saved.digest)).toEqual(saved);
 let called=0;f.definition.fields.toJSON=()=>{called++;return 'secret';};expect(()=>contracts.freezeMeasurementDefinition(f.definition)).toThrow('definition');expect(called).toBe(0);
});

test('definition aggregate bytes and nodes are bounded before registration',()=>{
 const fields=Object.fromEntries(Array.from({length:30},(_,n)=>['k'+n,'x'.repeat(60000)]));expect(()=>contracts.freezeMeasurementDefinition({fields})).toThrow('definition');
 expect(()=>contracts.freezeMeasurementDefinition({fields:Array.from({length:100},()=>Array(100).fill(1))})).toThrow('definition');
});

test('array snapshots and original timestamp survive reopen without any host callback',()=>{
 const filename=databasePath(),f=fixture(filename);f.definition.fields.devices=['cpu','disk'];f.rehash();const saved=f.store.registerEnvironment(f.input);f.db.close();
 const db=openLedger(filename);dbs.push(db);const host={read:vi.fn(()=>{throw Error('must not capture');}),nowMs:vi.fn(()=>{throw Error('must not observe');})};
 const store=contracts.createMeasurementContractStore(db,host);expect(store.registerEnvironment(f.input)).toEqual(saved);expect(store.readEnvironment(saved.digest)).toEqual(saved);expect(host.read).not.toHaveBeenCalled();expect(host.nowMs).not.toHaveBeenCalled();
});

test.each([false,true])('separate SQLite registration during capture is reconciled without overwrite (conflict=%s)',conflict=>{
 const filename=databasePath(),f=fixture(filename),other=openLedger(filename);dbs.push(other);
 const raw=structuredClone(f.raw);if(conflict){raw.definition.fields.os='other';raw.sourceDigest=sha(JSON.stringify(sorted(raw.definition)));}
 const second=contracts.createMeasurementContractStore(other,{read:()=>raw,nowMs:()=>5});let existing:any;
 f.host.read.mockImplementation(()=>{existing=second.registerEnvironment(f.input);return f.raw;});
 if(conflict)expect(()=>f.store.registerEnvironment(f.input)).toThrow('conflict');else expect(f.store.registerEnvironment(f.input)).toEqual(existing);
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_environment_snapshot').get()).toEqual({n:1});expect(second.readEnvironment(existing.digest)).toEqual(existing);
});

test('host callback opening an outer transaction cannot make registration write or roll back its state',()=>{
 const f=fixture();f.host.nowMs.mockImplementation(()=>{f.db.exec('BEGIN');return 20;});expect(()=>f.store.registerEnvironment(f.input)).toThrow('outer_transaction');expect(f.db.inTransaction).toBe(true);expect(f.db.prepare('SELECT count(*) n FROM evaluation_environment_snapshot').get()).toEqual({n:0});f.db.exec('ROLLBACK');
 f.host.nowMs.mockReturnValue(20);expect(f.store.registerEnvironment(f.input).id).toBe('env');
});

test('invalid external input refuses before host; closed/outer-transaction access fails',()=>{const f=fixture();expect(()=>f.store.registerEnvironment({...f.input,authorityClass:'host-observed'})).toThrow('input');expect(f.host.read).not.toHaveBeenCalled();f.db.exec('BEGIN');expect(()=>f.store.registerEnvironment(f.input)).toThrow('outer_transaction');f.db.exec('ROLLBACK');f.db.close();expect(()=>f.store.registerEnvironment(f.input)).toThrow();});
