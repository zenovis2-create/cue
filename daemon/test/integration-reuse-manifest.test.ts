import { test, expect, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, truncateSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const { validateReuseManifest, readReuseManifest, evaluateReuseEvidence } = await import(new URL('../../scripts/reuse/reuse-manifest.mjs', import.meta.url).href);
const roots: string[] = [];
afterEach(() => { for(const root of roots.splice(0)) { const path=resolve(root);if(dirname(path)!==resolve(tmpdir())||!basename(path).startsWith('cue-manifest-'))throw Error('unsafe_cleanup');rmSync(path,{recursive:true,force:true}); } });
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
function fixture() {
 const root=mkdtempSync(join(tmpdir(),'cue-manifest-'));roots.push(root);writeFileSync(join(root,'code.mjs'),'export const value=1;');writeFileSync(join(root,'evidence.txt'),'Synthetic test evidence only.');
 const artifact={path:'code.mjs',sha256:hash('export const value=1;')}, evidence={path:'evidence.txt',sha256:hash('Synthetic test evidence only.')},revision='sha256:'+artifact.sha256;
 const input:any={version:'cue-reuse-manifest-v1',id:'R-04',decision:'bounded-adoption',scope:'internal-only',origin:{kind:'cue-native',identity:'fixture',revision},source:[evidence],package:{name:'fixture',version:revision,artifact,status:'complete'},compliance:Object.fromEntries(['license','notice','assets','bom'].map(k=>[k,{status:'not-applicable',reason:'Synthetic native-only fixture declaration, not external adoption.',evidence:[evidence]}])),cue:[artifact],lifecycle:[evidence]};return{root,input,artifact,evidence};
}
test('actual four manifests remain incomplete with immutable source/artifact documentation only',()=>{
 for(const id of ['R-01','R-02','R-04','R-06']) {const path=resolve('../docs/reuse-decisions/manifests',id+'.json');expect(readReuseManifest(path)).toMatchObject({id,adoptionStatus:'incomplete',adoptionAuthorized:false,verificationScope:'local-byte-bindings-only',unknown:['license','notice','assets','bom']});}
});
test('evidence-bound synthetic documentation never grants adoption and has stable canonical identity',()=>{const f=fixture(),a=validateReuseManifest(f.input,f.root);expect(a).toMatchObject({adoptionStatus:'documented',adoptionAuthorized:false});expect(Object.isFrozen(a)).toBe(true);const reordered=Object.fromEntries(Object.entries(f.input).reverse());expect(validateReuseManifest(reordered,f.root)).toEqual(a);});
test('compliance labels cannot substitute for evidence or a bound package artifact',()=>{const f=fixture();for(const change of [(v:any)=>v.compliance.license.evidence=[],(v:any)=>v.package.artifact={...f.artifact,sha256:'0'.repeat(64)},(v:any)=>v.origin.revision='unversioned',(v:any)=>v.compliance.bom='complete']){const v=structuredClone(f.input);change(v);expect(()=>validateReuseManifest(v,f.root)).toThrow();}f.input.compliance.license.status='unknown';expect(validateReuseManifest(f.input,f.root).adoptionStatus).toBe('incomplete');});
test('rejects hostile descriptors, proxies, symbols, cycles and oversized input without getters',()=>{const f=fixture();let traps=0;const accessor={...f.input};Object.defineProperty(accessor,'id',{enumerable:true,get(){traps++;return 'R-04'}});const array=structuredClone(f.input);Object.defineProperty(array.source,'0',{enumerable:true,get(){traps++;return f.evidence}});const cycle:any={...f.input};cycle.cue=[cycle];const symbol={...f.input,[Symbol('extra')]:1};const proxy=new Proxy(f.input,{get(){traps++;throw Error('trap')}});for(const bad of [accessor,array,cycle,symbol,proxy,{...f.input,source:Array(257).fill(f.evidence)}])expect(()=>validateReuseManifest(bad,f.root)).toThrow();expect(traps).toBe(0);});
test('rejects drift, duplicates, escape, missing, nonregular and oversized files',()=>{const f=fixture();mkdirSync(join(f.root,'folder'));writeFileSync(join(f.root,'big'),'x');truncateSync(join(f.root,'big'),4*1024*1024+1);for(const source of [[{...f.evidence,sha256:'0'.repeat(64)}],[f.evidence,f.evidence],[{...f.evidence,path:'../escape'}],[{...f.evidence,path:'C:/escape'}],[{...f.evidence,path:'folder\\file'}],[{...f.evidence,path:'missing'}],[{...f.evidence,path:'folder'}],[{...f.evidence,path:'big'}]])expect(()=>validateReuseManifest({...f.input,source},f.root)).toThrow();});
test('rejects an existing junction even if its target bytes match the declared hash',()=>{const f=fixture(),external=mkdtempSync(join(tmpdir(),'cue-manifest-'));roots.push(external);writeFileSync(join(external,'evidence.txt'),'Synthetic test evidence only.');symlinkSync(external,join(f.root,'linked'),'junction');expect(()=>validateReuseManifest({...f.input,source:[{...f.evidence,path:'linked/evidence.txt'}]},f.root)).toThrow('reuse_manifest_link');});
test('CLI input loader bounds and rejects non-file input before parsing',()=>{const f=fixture();mkdirSync(join(f.root,'directory'));expect(()=>readReuseManifest(join(f.root,'directory'),f.root)).toThrow('reuse_manifest_input_file');const file=join(f.root,'large.json');writeFileSync(file,'{}');truncateSync(file,1048577);expect(()=>readReuseManifest(file,f.root)).toThrow('reuse_manifest_input_file');});
test('reuse evidence binds revision, manifest and receipt with explicit fallback or refusal',()=>{
 const binding={revision:`sha256:${'1'.repeat(64)}`,manifestDigest:'2'.repeat(64),receiptSha256:'3'.repeat(64)};
 const evaluate=(observed:any,fallback:any=null)=>evaluateReuseEvidence({version:'cue-reuse-evidence-lifecycle-v1',current:binding,observed,fallback});
 expect(evaluate(binding)).toMatchObject({reusable:true,action:'use-current',invalidation:null,revision:binding.revision});
 expect(evaluate(null)).toMatchObject({reusable:false,action:'refuse',invalidation:'missing-receipt'});
 expect(evaluate({...binding,receiptSha256:'4'.repeat(64)})).toMatchObject({reusable:false,action:'refuse',invalidation:'changed-binding'});
 const old={revision:`sha256:${'5'.repeat(64)}`,manifestDigest:'6'.repeat(64),receiptSha256:'7'.repeat(64)};
 expect(()=>evaluate(null,{pinned:true,binding:old,observed:old})).toThrow('reuse_manifest_fields');
 expect(evaluate(null,{observed:old})).toMatchObject({reusable:false,action:'refuse'});
 expect(evaluate(null,{observed:binding})).toMatchObject({reusable:true,action:'use-pinned-fallback',revision:binding.revision});
 expect(evaluate(null,{observed:{...binding,manifestDigest:'8'.repeat(64)}})).toMatchObject({reusable:false,action:'refuse'});
});
