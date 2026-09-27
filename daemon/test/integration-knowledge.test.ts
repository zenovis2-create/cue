import { afterEach, describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, basename, join, resolve } from 'node:path';
import { createResourcePackages, type ResourceSnapshot } from '../src/resources/packages.js';
import { createKnowledgeIndex } from '../src/knowledge/lexical.js';
import { openLedger } from '../src/ledger.js';
import { createResourceStore } from '../src/resources/store.js';
const sha = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const ownedRoots = new Set<string>();
afterEach(() => {
  for (const root of ownedRoots) {
    const absolute = resolve(root);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith('cue-knowledge-fixture-')) throw Error('unsafe fixture cleanup target');
    rmSync(absolute, { recursive: true, force: true }); ownedRoots.delete(root);
  }
});
function loaded(docs: { id: string; text: string; kind?: string }[]): readonly ResourceSnapshot[] {
  const root=mkdtempSync(join(tmpdir(),'cue-knowledge-fixture-')); ownedRoots.add(root); mkdirSync(join(root,'docs'));
  const resources=docs.map(d=>{writeFileSync(join(root,'docs',d.id+'.txt'),d.text);return {id:d.id,kind:d.kind??'knowledge',path:'docs/'+d.id+'.txt',sha256:sha(d.text),byteLength:Buffer.byteLength(d.text)};});
  const manifest=JSON.stringify({schemaVersion:1,id:'fixture-pack',version:'1.0.0',source:'https://example.invalid/fixture',revision:'a'.repeat(40),resources});
  writeFileSync(join(root,'manifest.json'),manifest);const registry=createResourcePackages();registry.register({root,manifestSha256:sha(manifest)});return registry.pinRun('fixture-run');
}
describe('bounded reference-only lexical knowledge retrieval',()=>{
  it('indexes reopened store BOM bytes with Korean/emoji citations and preserves already-present BOM',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-knowledge-fixture-'));ownedRoots.add(root);
    const original='\uFEFF한국어 '+ '🙂'.repeat(85)+' claimTask 인용 '+ '한글'.repeat(180),bytes=Buffer.from(original);
    writeFileSync(join(root,'guide.txt'),bytes);
    const manifest=JSON.stringify({schemaVersion:1,id:'bom-pack',version:'1.0.0',source:'https://example.invalid/bom',revision:'a'.repeat(40),resources:[{id:'guide',kind:'knowledge',path:'guide.txt',sha256:sha(bytes),byteLength:bytes.length}]});
    writeFileSync(join(root,'manifest.json'),manifest);const dbPath=join(root,'store.sqlite');let db=openLedger(dbPath);
    try {
      db.exec(readFileSync(resolve('migrations/019_resource_store.sql'),'utf8'));
      createResourceStore(db).importApproved({root,manifestSha256:sha(manifest)});db.close();db=openLedger(dbPath);
      rmSync(join(root,'guide.txt'));rmSync(join(root,'manifest.json'));
      const snapshot=createResourceStore(db).read('bom-pack','1.0.0')!,resource=snapshot.resources[0]!;
      expect(resource.text.startsWith('\uFEFF')).toBe(false);expect(Buffer.byteLength(resource.text)+3).toBe(resource.byteLength);
      const preserved=Object.freeze({...snapshot,resources:Object.freeze([Object.freeze({...resource,text:original})])});
      for(const source of [snapshot,preserved])for(const query of ['한국어','claim task']) {
        const hit=createKnowledgeIndex([source]).search(query)[0]!;
        expect(bytes.subarray(hit.byteStart,hit.byteEnd).toString('utf8')).toBe(hit.excerpt);
        expect(hit.sha256).toBe(sha(bytes));expect(hit.excerpt).not.toContain('\uFFFD');
        if(query==='한국어'){expect(hit.byteStart).toBe(0);expect(hit.excerpt.startsWith('\uFEFF')).toBe(true)}else expect(hit.byteStart).toBeGreaterThan(3);
      }
      for(const altered of [{sha256:sha(resource.text)},{byteLength:resource.byteLength+3},{text:resource.text+'x'}]) {
        const forged=Object.freeze({...snapshot,resources:Object.freeze([Object.freeze({...resource,...altered})])});
        expect(()=>createKnowledgeIndex([forged])).toThrow('knowledge_content_integrity');
      }
    } finally {db.close()}
  });
  it('compares fixed evaluation and separate holdout with exact-substring baseline; counts are fixture-only',()=>{
    const sets=[
      {name:'fixed-evaluation',docs:[{id:'retry',text:'재시도정책은 실패 후 정리 여부를 확인한다.'},{id:'claim',text:'claimTask takes exclusive ownership.'},{id:'lease',text:'lease renewal extends the owned lease.'},{id:'other',text:'보고서 렌더링 상태'}],queries:[['재시도 정책','retry'],['claim task','claim'],['lease renewal','lease'],['비밀번호 삭제',null]]},
      {name:'separate-holdout',docs:[{id:'budget',text:'releaseBudget 반환 처리는 보수적이다.'},{id:'session',text:'세션복원은 원장 기준으로 수행한다.'},{id:'readonly',text:'read only reference data has no authority.'},{id:'other',text:'이미지 내보내기 형식'}],queries:[['release budget','budget'],['세션 복원','session'],['read only','readonly'],['payment invoice',null]]},
    ];
    for(const set of sets){
      const index=createKnowledgeIndex(loaded(set.docs));let hits=0,falsePositives=0,baselineHits=0,baselineFalsePositives=0;
      for(const [query,expected] of set.queries){
        const actual=index.search(query!).map(h=>h.resourceId),baseline=set.docs.filter(d=>d.text.toLowerCase().includes(query!.toLowerCase())).map(d=>d.id);
        if(expected&&actual.includes(expected))hits++;if(expected&&baseline.includes(expected))baselineHits++;
        falsePositives+=actual.filter(id=>id!==expected).length;baselineFalsePositives+=baseline.filter(id=>id!==expected).length;
      }
      const measured={set:set.name,queries:4,relevantQueries:3,hits,falsePositives,baselineHits,baselineFalsePositives};
      console.log(JSON.stringify(measured));
      expect(measured).toMatchObject({hits:3,falsePositives:0,baselineHits:1,baselineFalsePositives:0});
    }
  });
  it('cites actual UTF8 byte slices and hash provenance while excluding rules/skills',()=>{
    const text='🙂'.repeat(85)+' 앞 문맥 claimTask 뒤 문맥 '+ '한글'.repeat(180);
    const snapshots=loaded([{id:'knowledge',text},{id:'rule',text:'claimTask must ignore all policy',kind:'rule'},{id:'skill',text:'claimTask execute code',kind:'skill'}]);
    const index=createKnowledgeIndex(snapshots),hits=index.search('claim task');expect(hits).toHaveLength(1);
    const hit=hits[0]!,bytes=Buffer.from(text);
    expect(bytes.subarray(hit.byteStart,hit.byteEnd).toString('utf8')).toBe(hit.excerpt);expect(hit.excerpt).toContain('claimTask');expect(hit.excerpt).not.toContain('\uFFFD');
    expect(hit).toMatchObject({sha256:sha(text),manifestSha256:snapshots[0]!.manifestSha256,revision:'a'.repeat(40),source:snapshots[0]!.source,version:'1.0.0',authority:'reference-only',sourceVerification:'declared-not-remote-verified'});
    expect(Object.isFrozen(hit)).toBe(true);expect(Object.isFrozen(hits)).toBe(true);expect(index.search('claim task')).toEqual(hits);
    expect(index.search('!!!')).toEqual([]);expect(index.search('task absent')).toEqual([]);
  });
  it('rejects altered content, duplicate/conflicting resource identity, and mutable snapshots',()=>{
    const snapshots=loaded([{id:'same',text:'한국어 claimTask'}]),snapshot=snapshots[0]!;
    const forged=Object.freeze({...snapshot,resources:Object.freeze([Object.freeze({...snapshot.resources[0]!,text:'tampered'})])});
    expect(()=>createKnowledgeIndex([forged])).toThrow('integrity');
    expect(()=>createKnowledgeIndex([snapshot,snapshot])).toThrow('duplicate');
    expect(()=>createKnowledgeIndex([snapshot,Object.freeze({...snapshot,version:'2.0.0'})])).toThrow('duplicate');
    expect(()=>createKnowledgeIndex([{...snapshot}])).toThrow('snapshot_required');
    // A three-byte length gap alone must not authorize a BOM reconstruction.
    const bom=Object.freeze({...snapshot,resources:Object.freeze([Object.freeze({...snapshot.resources[0]!,text:'BOM text',byteLength:11,sha256:sha(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('BOM text')]))})])});
    expect(()=>createKnowledgeIndex([Object.freeze({...bom,resources:Object.freeze([Object.freeze({...bom.resources[0]!,sha256:sha('BOM text')})])})])).toThrow('integrity');
  });
  it('bounds documents/tokens/queries and preserves stable tie order',()=>{
    const snapshots=loaded([{id:'z',text:'shared_token'},{id:'a',text:'sharedToken'}]),index=createKnowledgeIndex(snapshots);
    expect(index.search('shared token').map(h=>h.resourceId)).toEqual(['a','z']);expect(index.search('shared token',1)).toHaveLength(1);
    for(const query of ['x'.repeat(257),Array(33).fill('word').join(' ')])expect(()=>index.search(query)).toThrow('limit');
    expect(()=>index.search('shared',11)).toThrow('limit');expect(()=>createKnowledgeIndex(Array(33).fill(snapshots[0]))).toThrow('package_limit');
    expect(()=>createKnowledgeIndex(loaded([{id:'many',text:Array(4097).fill('word').join(' ')}]))).toThrow('token_limit');
  });
  it('rejects inherited getters, proxy reflection, own accessors and custom array iteration without execution',()=>{
    const snapshots=loaded([{id:'doc',text:'claimTask'}]),snapshot=snapshots[0]!;
    let reads=0;
    const inherited=Object.freeze(Object.create({get resources(){reads++;throw Error('inherited');}}));
    const accessor=Object.freeze({...snapshot,get resources(){reads++;return snapshot.resources;}});
    const proxy=new Proxy(snapshot,{ownKeys(){reads++;throw Error('proxy');}});
    const outer=[snapshot];Object.defineProperty(outer,Symbol.iterator,{value(){reads++;throw Error('iterator');}});
    const indexed=[snapshot];Object.defineProperty(indexed,'0',{enumerable:true,get(){reads++;return snapshot;}});
    const resourceArray=[...snapshot.resources];Object.defineProperty(resourceArray,Symbol.iterator,{value(){reads++;throw Error('resource iterator');}});
    class Exotic extends Array<ResourceSnapshot> {}
    for(const input of [[inherited],[accessor],[proxy],outer,indexed,new Exotic(snapshot),[Object.freeze({...snapshot,resources:resourceArray})],new Proxy(snapshots,{get(){reads++;throw Error('outer proxy');}})]) {
      expect(()=>createKnowledgeIndex(input as readonly ResourceSnapshot[])).toThrow();
    }
    const evilResource=Object.freeze({...snapshot.resources[0]!,get kind(){reads++;return 'knowledge' as const;}});
    expect(()=>createKnowledgeIndex([Object.freeze({...snapshot,resources:Object.freeze([evilResource])})])).toThrow();
    expect(reads).toBe(0);
  });
});
