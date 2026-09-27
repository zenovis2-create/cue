import { expect, test } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
function recorded(patch: Record<string,unknown>={}) {
  return {status:'recorded',authority:'historical-explanation-only',kind:'monetary',mode:'value',selectedId:'candidate-a',reason:'ranked',ranking:'scored',
    assessments:[{id:'candidate-a',score:0.12345,exclusions:[]},{id:'candidate-b',score:null,exclusions:['cost-limit','unknown-estimate']}],totalAssessments:2,truncated:false,...patch};
}
function fixture() {
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});
  Object.assign(dom.window,{cue:{}});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
  const draw=(selection:any,patch:Record<string,unknown>={})=>{
    const orchestration={runId:'workflow',policy:null,acceptance:'unverified',acceptanceRecord:null,requirementEvaluation:null,budget:{},stages:[{taskId:'stage',role:'model-producer',state:'running',attemptId:'a',candidateId:'candidate-a',cleanup:'unknown',selection}],activity:[],attemptHistory:[{taskId:'stage',attemptId:'old',candidateId:'candidate-b',state:'failed',cleanup:'unknown',selection}],...patch};
    (dom.window as any).renderCard({taskId:'task',runId:orchestration.runId,state:'running',status:'running',stage:'work',executionOwnership:{status:'unresolved'},orchestration});
  };
  return {dom,doc:dom.window.document,draw};
}
test('historical monetary policy/reason and exclusions display without quality score or current eligibility claim',()=>{
  const f=fixture();try{
    f.draw(recorded());const stage=f.doc.querySelector('#orchestration-stages > li')!;
    expect(stage.querySelector('.selection-summary')!.textContent).toContain('비용 기준 · 가성비');expect(stage.textContent).toContain('정책 기준으로 비교');
    expect(stage.querySelectorAll('.selection-assessments > li')).toHaveLength(2);expect(stage.textContent).toContain('비용 한도 초과');
    expect(stage.textContent).not.toContain('0.12345');expect(stage.querySelector('.selection-note')!.textContent).toContain('증명하지 않습니다');
    expect(f.doc.querySelectorAll('#orchestration-stages > li')).toHaveLength(1);expect(f.doc.querySelectorAll('#orchestration-attempts > li')).toHaveLength(1);
    expect(f.doc.querySelector<HTMLButtonElement>('#stop')!.disabled).toBe(false);
  }finally{f.dom.window.close();}
});
test('local fixed pair explicitly has no ranking and missing legacy/invalid/not-started stay distinct',()=>{
  const f=fixture();try{
    f.draw(recorded({kind:'local-invocation',mode:'efficiency',reason:'fixed-pair-eligible',ranking:'not-performed',assessments:[],totalAssessments:0}));
    expect(f.doc.querySelector('.selection-summary')!.textContent).toContain('순위 평가 없음 · 고정 조합');expect(f.doc.querySelector('.selection-count')!.textContent).toContain('0개');
    for(const [status,text] of [['legacy-not-recorded','과거 기록'],['invalid','검증 실패'],['not-started','아직 시작하지 않음']]){
      f.draw({status,authority:'historical-explanation-only'});expect(f.doc.querySelector('.selection-explanation summary')!.textContent).toContain(text);
      expect(f.doc.querySelector('.selection-summary')).toBeNull();
    }
    for(const missing of [undefined,null]) {
      f.draw(missing);expect(f.doc.querySelector('.selection-explanation summary')!.textContent).toContain('검증 실패');
      expect(f.doc.querySelector('.selection-explanation summary')!.textContent).not.toContain('과거 기록');
    }
    f.draw(undefined,{stages:[{taskId:'new',role:'model-producer',state:'pending',attemptId:null}]});expect(f.doc.querySelector('.selection-explanation summary')!.textContent).toContain('아직 시작하지 않음');
  }finally{f.dom.window.close();}
});
test('candidate details cap 50, count omitted records and redact unsupported IDs with no markup execution',()=>{
  const f=fixture();try{
    const rows=Array.from({length:55},(_,i)=>({id:i?'candidate-'+i:'<img src=x onerror=alert(1)>',score:999999,exclusions:i?[]:['<script>bad</script>']}));
    f.draw(recorded({selectedId:null,assessments:rows,totalAssessments:55,truncated:true}));
    const stage=f.doc.querySelector('#orchestration-stages > li')!;
    expect(stage.querySelectorAll('.selection-assessments > li')).toHaveLength(50);expect(stage.querySelector('.selection-count')!.textContent).toContain('55개 · 50개 표시 · 일부 생략');
    expect(stage.textContent).toContain('식별자 비공개');expect(stage.textContent).not.toContain('999999');expect(stage.querySelector('img,script')).toBeNull();
    expect(stage.textContent).not.toContain('candidate-54');
  }finally{f.dom.window.close();}
});
test('expanded explanation survives same-run refresh, resets across runs and never changes Stop state',()=>{
  const f=fixture();try{
    f.draw(recorded());const details=f.doc.querySelector<HTMLDetailsElement>('.selection-explanation')!;details.open=true;
    const title=f.doc.querySelector('#state-title')!.textContent;
    f.draw(recorded({reason:'pinned'}));expect(f.doc.querySelector<HTMLDetailsElement>('.selection-explanation')!.open).toBe(true);
    expect(f.doc.querySelector('.selection-summary')!.textContent).toContain('사용자가 지정');expect(f.doc.querySelector('#state-title')!.textContent).toBe(title);expect(f.doc.querySelector<HTMLButtonElement>('#stop')!.disabled).toBe(false);
    f.draw(recorded(),{runId:'other'});expect(f.doc.querySelector<HTMLDetailsElement>('.selection-explanation')!.open).toBe(false);
  }finally{f.dom.window.close();}
});
