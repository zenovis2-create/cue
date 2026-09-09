import {describe,expect,expectTypeOf,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {openLedger} from '../src/ledger.js';
import {
  AnnotationStore, OrcaLocalStorage, PublishGate, allowedHtmlComponents, annotationToTask,
  authorizeAnnotationTask, captureTurn, parseAnnotation, recordResult, regenerateResult,
  renderDetailedReport, renderHtmlNode, renderKoreanSummary, renderResultHtml, scanPublishItems,
  type AnnotationRecord, type ExplainAnnotation, type LocalStorageAdapter, type ResultRecord, type WorkAnnotation,
} from '../src/p7.js';

const now='2026-09-03T00:00:00.000Z';
const record:ResultRecord={artifactId:'report',version:1,title:'결과',summary:'첫 요약',details:['검사 통과']};
const work:WorkAnnotation={id:'w1',taskId:'t',surface:'work',pageId:'page-17',urlLabel:'https://example.invalid/path',screenshotId:'shot-w',koreanText:'버튼 간격을 줄여 주세요',createdAt:now};
const explain:ExplainAnnotation={id:'e1',taskId:'t',surface:'explain',artifactId:'report',artifactVersion:1,screenshotId:'shot-e',koreanText:'이 설명에 예시를 추가해 주세요',createdAt:now};

function seeded(){
  const db=openLedger();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t','running',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('env','C:/work','[]',now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r','t','env',0,now);
  return db;
}
function memoryBackup(initial:readonly AnnotationRecord[]=[]):LocalStorageAdapter {
  let values=[...initial]; return {get:async()=>values,set:async records=>{values=[...records];}};
}

describe('Phase 7 reporting, annotation, and publishing',()=>{
  it('P7-1 renders all three views from the same changed result record',()=>{
    const changed={...record,summary:'바뀐 요약',details:['새 상세']};
    const outputs=[renderKoreanSummary(changed),renderDetailedReport(changed),renderResultHtml(changed)];
    expect(outputs.every(output=>output.includes('바뀐 요약'))).toBe(true);
    expect(outputs.every(output=>!output.includes('첫 요약'))).toBe(true);
    const source=readFileSync(resolve('src/p7.ts'),'utf8');
    expect(source.match(/export function render(?:KoreanSummary|DetailedReport|ResultHtml)\(record: ResultRecord\)/g)).toHaveLength(3);
  });

  it.each(['<script>alert(1)</script>','<img src=x onerror=alert(1)>','javascript:alert(1)','<iframe src=x></iframe>'])('P7-2 escapes HTML injection %s',payload=>{
    const html=renderResultHtml({...record,summary:payload});
    expect(html).not.toMatch(/<script|<iframe|<img|(?:href|src)\s*=\s*['"]?\s*javascript:/iu);
    if(payload.startsWith('<')) expect(html).toContain('&lt;');
  });
  it('P7-2 uses a frozen component allowlist and rejects nodes outside it',()=>{
    expect(Object.isFrozen(allowedHtmlComponents)).toBe(true);
    expect(allowedHtmlComponents).toEqual(['article','heading','paragraph','list']);
    expect(()=>renderHtmlNode({component:'raw',html:'<script />'})).toThrow('component not allowed');
  });

  it.each([
    ['token',{value:'token=abc123'}],['key',{value:'api_key: xyz789'}],['.env',{value:'.env\nDATABASE_URL=private'}],['absolute user path',{value:'C:\\Users\\alice\\secret.txt'}],
  ])('P7-3 secret scan rejects %s',(_name,fields)=>expect(()=>scanPublishItems([{name:'report',fields}])).toThrow('sensitive content'));
  it('P7-3 enforces all five ordered steps and cannot share without human approval',async()=>{
    const share=vi.fn(async()=> 'shared'); const item=[{name:'report.html',fields:{body:'safe'}}];
    expect(()=>new PublishGate(scanPublishItems,share).scan()).toThrow('publish steps out of order');
    const skipsScan=new PublishGate(scanPublishItems,share); skipsScan.list(item); expect(()=>skipsScan.preview()).toThrow('publish steps out of order');
    const skipsPreview=new PublishGate(scanPublishItems,share); skipsPreview.list(item); skipsPreview.scan(); expect(()=>skipsPreview.approveByHuman()).toThrow('publish steps out of order');
    for(const stopAfter of [0,1,2,3]){
      const gate=new PublishGate(scanPublishItems,share);
      if(stopAfter>=1) gate.list(item); if(stopAfter>=2) gate.scan(); if(stopAfter>=3) gate.preview();
      await expect(gate.share()).rejects.toThrow();
    }
    expect(share).not.toHaveBeenCalled();
    const gate=new PublishGate(scanPublishItems,share); gate.list(item); gate.scan(); gate.preview(); gate.approveByHuman();
    await expect(gate.share()).resolves.toBe('shared'); expect(share).toHaveBeenCalledOnce();
  });
  it('P7-3 fails closed when the scanner throws',async()=>{
    const share=vi.fn(async()=> 'shared'), gate=new PublishGate(()=>{throw new Error('scanner unavailable');},share);
    gate.list([{name:'a',fields:{body:'safe'}}]); expect(()=>gate.scan()).toThrow('scanner unavailable');
    await expect(gate.share()).rejects.toThrow('human approval required'); expect(share).not.toHaveBeenCalled();
  });

  it('P7-4 shared HTML contains content only, with no annotation controls, scripts, or origin overlay path',()=>{
    const html=renderResultHtml(record), source=readFileSync(resolve('src/p7.ts'),'utf8');
    expect(html).not.toMatch(/button|textarea|annotation|<script/iu);
    expect(source).not.toMatch(/contentScript|document\.(?:body|head)|appendChild|insertAdjacentHTML|overlay/iu);
  });

  it.each([[work,'work','page-17'],[explain,'explain','report@1']] as const)('P7-5 converts image plus Korean text on $surface surface to a task',(annotation,surface,identity)=>{
    expect(annotationToTask(annotation)).toEqual({surface,imageId:annotation.screenshotId,instruction:annotation.koreanText,identity});
  });

  it('P7-10 rejects missing and blank surface values',()=>{
    expect(()=>parseAnnotation({...work,surface:undefined})).toThrow('surface required');
    expect(()=>parseAnnotation({...work,surface:''})).toThrow('surface required');
  });
  it('P7-10 uses exclusive identities for explain and work at runtime and type level',()=>{
    expect(parseAnnotation(explain)).toMatchObject({artifactId:'report',artifactVersion:1});
    expect(parseAnnotation(work)).toMatchObject({pageId:'page-17'});
    expect(()=>parseAnnotation({...work,artifactId:'report',artifactVersion:1})).toThrow('exclusive annotation identity required');
    expectTypeOf<Extract<AnnotationRecord,{surface:'work'}>>().not.toMatchTypeOf<{artifactId:string}>();
    expectTypeOf<Extract<AnnotationRecord,{surface:'explain'}>>().not.toMatchTypeOf<{pageId:string}>();
  });

  it('P7-11 sends explain code-change requests through the unchanged envelope decision',()=>{
    const decide=vi.fn(()=>false); expect(authorizeAnnotationTask(explain,true,decide)).toBe(false);
    expect(decide).toHaveBeenCalledExactlyOnceWith(annotationToTask(explain));
  });

  it('P7-12 keeps old annotations pinned after regeneration and exposes no direct HTML edit path',async()=>{
    const db=seeded(), backup=memoryBackup(), store=new AnnotationStore(db,backup); recordResult(db,record,new Date(now));
    await store.save(explain);
    const next=regenerateResult(db,'report',old=>({...old,version:2,summary:'재생성'}),new Date(now)); expect(next.version).toBe(2);
    expect(db.prepare('SELECT artifact_id,artifact_version FROM annotation_v2 WHERE id=?').get('e1')).toEqual({artifact_id:'report',artifact_version:1});
    expect(db.prepare('SELECT version FROM result_record ORDER BY version').all()).toEqual([{version:1},{version:2}]);
    expect(readFileSync(resolve('src/p7.ts'),'utf8')).not.toMatch(/edit(?:Artifact)?Html|update\s+result_record/iu); db.close();
  });

  it('P7-6 binds screenshot, snapshot, and current tab to one capture id',async()=>{
    const calls:string[][]=[], exec=async(args:readonly string[])=>{calls.push([...args]); return args[0]==='tab'?'{"pageId":"p"}':args[0];};
    await expect(captureTurn('capture-1',exec)).resolves.toEqual({captureId:'capture-1',screenshot:'screenshot',snapshot:'snapshot',page:{pageId:'p'}});
    expect(calls).toEqual([['screenshot'],['snapshot'],['tab','current','--json']]);
  });
  it('P7-6 rejects the entire capture if any one adapter call fails',async()=>{
    const exec=async(args:readonly string[])=>{if(args[0]==='snapshot') throw new Error('capture failed'); return args[0]==='tab'?'{}':'ok';};
    await expect(captureTurn('capture-2',exec)).rejects.toThrow('capture failed');
  });

  it('P7-7 requires page id rather than URL and accepts selector-free screenshot records',()=>{
    expect(parseAnnotation(work)).toMatchObject({pageId:'page-17',urlLabel:'https://example.invalid/path',screenshotId:'shot-w'});
    expect(parseAnnotation(work)).not.toHaveProperty('selector');
    expect(()=>parseAnnotation({...work,pageId:undefined,urlLabel:'https://example.invalid/only'})).toThrow('exclusive annotation identity required');
  });

  it('P7-8 backs up while blocked and flushes to the ledger on reconnect',async()=>{
    const db=seeded(), backup=memoryBackup(), store=new AnnotationStore(db,backup);
    await expect(store.save(work,false)).resolves.toBe('backup'); expect(db.prepare('SELECT count(*) n FROM annotation_v2').get()).toEqual({n:0});
    await expect(store.flush()).resolves.toBe(1); expect(db.prepare('SELECT id,page_id FROM annotation_v2').get()).toEqual({id:'w1',page_id:'page-17'}); expect(await backup.get()).toEqual([]); db.close();
  });
  it('P7-8 Orca backup uses storage local get/set and has no annotation eval call',async()=>{
    const calls:string[][]=[], adapter=new OrcaLocalStorage(async args=>{calls.push([...args]); return args[2]==='get'?'[]':'';});
    await adapter.get(); await adapter.set([work]); expect(calls.map(call=>call.slice(0,3))).toEqual([['storage','local','get'],['storage','local','set']]);
    expect(readFileSync(resolve('src/p7.ts'),'utf8')).not.toMatch(/['"]eval['"]|\beval\s*\(/u);
  });

  it.skip('P7 external artifacts share and real Orca capture — SKIPPED: would mutate or require an external system',()=>{});
});
