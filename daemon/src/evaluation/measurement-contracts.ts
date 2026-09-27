import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';

const MAX_BYTES=1048576, ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/, SHA=/^[a-f0-9]{64}$/;
type Kind='metric'|'environment'|'accountLimits'|'price';
type Authority='host-observed'|'offline-fixture';
export type MeasurementContract=Readonly<{kind:Kind;id:string;revision:string;digest:string;authorityClass:Authority;sourceRevision:string;sourceDigest:string;observedAtMs:number;definition:Readonly<Record<string,unknown>>}>;
export interface MeasurementContractHost { read(kind:Kind,id:string,revision:string): unknown; nowMs(): number }
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
function fail(c:string):never{throw Error(`evaluation_measurement_contract_${c}`);}
const active=new WeakSet<Ledger>();
function exact(v:unknown,keys:readonly string[]){
  if(!v||typeof v!=='object'||types.isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype)fail('input');
  const d=Object.getOwnPropertyDescriptors(v);
  if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail('input');
  return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
function id(v:unknown):string{if(typeof v!=='string'||!ID.test(v))fail('identity');return v;}
function sha(v:unknown):string{if(typeof v!=='string'||!SHA.test(v))fail('digest');return v;}
function integer(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)fail('time');return v;}

/** Content serialization for producers, NOT an observed measurement or authority.
 * Legacy scalar/object canonical bytes are unchanged. Arrays retain order. */
export function freezeMeasurementDefinition(input:unknown){
  let nodes=0,bytes=0;const visiting=new WeakSet<object>();
  function charge(n:number){bytes+=n;if(bytes>MAX_BYTES)fail('definition');}
  function text(v:string){if(Buffer.byteLength(v)>65536)fail('definition');charge(Buffer.byteLength(JSON.stringify(v)));}
  function clone(v:unknown,depth:number):unknown{
    if(++nodes>4096||depth>16)fail('definition');
    if(v===null){charge(4);return null;}
    if(typeof v==='boolean'){charge(v?4:5);return v;}
    if(typeof v==='string'){text(v);return v;}
    if(typeof v==='number'){if(!Number.isFinite(v))fail('definition');charge(JSON.stringify(v).length);return v;}
    if(!v||typeof v!=='object'||types.isProxy(v)||visiting.has(v))fail('definition');
    visiting.add(v);
    try{
      const d=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(d);
      if(Array.isArray(v)){
        const length=d.length;
        if(Object.getPrototypeOf(v)!==Array.prototype||!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<0||length.value>4096||keys.length!==length.value+1)fail('definition');
        const out:unknown[]=[];charge(2+Math.max(0,length.value-1));
        for(let n=0;n<length.value;n++){const slot=d[String(n)];if(!slot?.enumerable||!Object.hasOwn(slot,'value'))fail('definition');out.push(clone(slot.value,depth+1));}
        return Object.freeze(out);
      }
      if(Object.getPrototypeOf(v)!==Object.prototype||keys.length>128||keys.some(k=>typeof k!=='string'))fail('definition');
      const out:Record<string,unknown>={};charge(2+Math.max(0,keys.length-1));
      for(const key of (keys as string[]).sort()){
        const field=d[key]!;if(!field.enumerable||!Object.hasOwn(field,'value'))fail('definition');
        text(key);charge(1);
        // Define data properties rather than invoking the __proto__ setter.
        Object.defineProperty(out,key,{value:clone(field.value,depth+1),enumerable:true});
      }
      return Object.freeze(out);
    }finally{visiting.delete(v);}
  }
  const definition=clone(input,0);
  if(!definition||typeof definition!=='object'||Array.isArray(definition))fail('definition');
  const encoded=JSON.stringify(definition);if(Buffer.byteLength(encoded)>MAX_BYTES)fail('payload');
  return Object.freeze({definition:definition as Readonly<Record<string,unknown>>,sourceDigest:hash(encoded)});
}
const table:Record<Kind,{name:string,id:string,time:string}>={metric:{name:'evaluation_metric_contract',id:'contract_id',time:'registered_at_ms'},environment:{name:'evaluation_environment_snapshot',id:'snapshot_id',time:'observed_at_ms'},accountLimits:{name:'evaluation_account_limits_snapshot',id:'snapshot_id',time:'observed_at_ms'},price:{name:'evaluation_price_snapshot',id:'snapshot_id',time:'observed_at_ms'}};
function seal(value:Omit<MeasurementContract,'digest'>):MeasurementContract{
  const encoded=JSON.stringify(value);if(Buffer.byteLength(encoded)>MAX_BYTES)fail('payload');
  return Object.freeze({...value,digest:hash(encoded)});
}
function canonical(kind:Kind,raw:unknown,authorityClass:Authority,at:number):MeasurementContract{
  if(!['host-observed','offline-fixture'].includes(authorityClass))fail('authority');
  const f=exact(raw,['id','revision','sourceRevision','sourceDigest','definition']),snapshot=freezeMeasurementDefinition(f.definition),definition=snapshot.definition,sourceDigest=sha(f.sourceDigest);
  if(sourceDigest!==snapshot.sourceDigest)fail('source_digest');
  const value={kind,id:id(f.id),revision:id(f.revision),authorityClass,sourceRevision:id(f.sourceRevision),sourceDigest,observedAtMs:integer(at),definition} as const;
  if(kind==='metric'){const m=exact(definition,['scoreMinimum','scoreMaximum','algorithmRevision']);if(typeof m.scoreMinimum!=='number'||typeof m.scoreMaximum!=='number'||m.scoreMinimum>=m.scoreMaximum)fail('metric_domain');id(m.algorithmRevision);}
  if(kind==='environment'||kind==='accountLimits'){const s=exact(definition,['schemaRevision','complete','fields']);id(s.schemaRevision);if(typeof s.complete!=='boolean'||!s.fields||typeof s.fields!=='object'||Array.isArray(s.fields))fail('snapshot');}
  if(kind==='price'){const p=exact(definition,['provider','currency','unit','effectiveAtMs']);id(p.provider);id(p.currency);id(p.unit);integer(p.effectiveAtMs);}
  return seal(value);
}
export function createMeasurementContractStore(db:Ledger,host:MeasurementContractHost,authorityClass:Authority='host-observed'){
  if(!['host-observed','offline-fixture'].includes(authorityClass))fail('authority');
  function read(kind:Kind,digestInput:string){
    if(!db.open)fail('closed');
    const t=table[kind],row=db.prepare(`SELECT ${t.id} id,revision,digest,authority_class,source_revision,source_digest,${t.time} observed_at_ms,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) payload FROM ${t.name} WHERE digest=?`).get(MAX_BYTES+1,sha(digestInput)) as any;
    if(!row)return null;if(row.bytes>MAX_BYTES)fail('payload');let p:any;try{p=JSON.parse(row.payload);}catch{fail('integrity');}
    const value=canonical(kind,{id:row.id,revision:row.revision,sourceRevision:row.source_revision,sourceDigest:row.source_digest,definition:p?.definition},row.authority_class,row.observed_at_ms);
    if(JSON.stringify(value)!==row.payload||value.digest!==row.digest)fail('integrity');return value;
  }
  function byIdentity(kind:Kind,contractId:string,revision:string){
    const t=table[kind],row=db.prepare(`SELECT digest FROM ${t.name} WHERE ${t.id}=? AND revision=?`).get(contractId,revision) as {digest:string}|undefined;
    if(!row)return null;const saved=read(kind,row.digest)!;
    if(saved.id!==contractId||saved.revision!==revision||saved.authorityClass!==authorityClass)fail('authority');
    return saved;
  }
  function register(kind:Kind,input:unknown){
    if(!db.open||db.inTransaction)fail('outer_transaction');if(active.has(db))fail('reentrant');
    const f=exact(input,['id','revision']),contractId=id(f.id),revision=id(f.revision),prior=byIdentity(kind,contractId,revision);
    // An immutable identifier retry observes the same saved contract, not a new
    // host snapshot with a new timestamp. A changed source requires a new revision.
    if(prior)return prior;
    active.add(db);
    try{
      const raw=host.read(kind,contractId,revision);
      if(types.isPromise(raw))fail('host'); // Never read raw.then (getter/proxy).
      const {digest:_digest,...snapshot}=canonical(kind,raw,authorityClass,0);
      if(snapshot.id!==contractId||snapshot.revision!==revision)fail('host');
      const value=seal({...snapshot,observedAtMs:integer(host.nowMs())});
      if(!db.open||db.inTransaction)fail('outer_transaction');
      return db.transaction(()=>{
        const existing=byIdentity(kind,contractId,revision);
        if(existing){
          if(seal({...snapshot,observedAtMs:existing.observedAtMs}).digest!==existing.digest)fail('conflict');
          return existing;
        }
        const t=table[kind],payload=JSON.stringify(value);
        db.prepare(`INSERT INTO ${t.name}(digest,${t.id},revision,authority_class,source_revision,source_digest,${t.time},payload) VALUES(?,?,?,?,?,?,?,?)`).run(value.digest,value.id,value.revision,value.authorityClass,value.sourceRevision,value.sourceDigest,value.observedAtMs,payload);
        return read(kind,value.digest)!;
      }).immediate();
    }finally{active.delete(db);}
  }
  return Object.freeze({registerMetric:(v:unknown)=>register('metric',v),registerEnvironment:(v:unknown)=>register('environment',v),registerAccountLimits:(v:unknown)=>register('accountLimits',v),registerPrice:(v:unknown)=>register('price',v),readMetric:(d:string)=>read('metric',d),readEnvironment:(d:string)=>read('environment',d),readAccountLimits:(d:string)=>read('accountLimits',d),readPrice:(d:string)=>read('price',d)});
}
export function createOfflineFixtureMeasurementContractStore(db:Ledger,host:MeasurementContractHost){return createMeasurementContractStore(db,host,'offline-fixture');}
