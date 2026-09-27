import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {expect,test,vi} from 'vitest';
import {registerIpcHandlers} from '../../app/ipc.mjs';

const planning = {goal:'Plan approved change',autonomy:3,selectionMode:'efficiency'};
const conversion = {planningRunId:'plan-run',autonomy:3,selectionMode:'efficiency'};

test('planning IPC accepts exact commands through trusted sender and never accepts renderer proposal text', () => {
  const handlers=new Map<string,Function>(),sender={},frame={};
  const core={planningAvailability:vi.fn(()=>({available:false,reasons:['unconfigured']})),
    preparePlanningGoal:vi.fn(input=>({runId:'plan-run',...input})),prepareGoalFromPlanningRun:vi.fn(input=>({runId:'execution-run',...input}))};
  const api=registerIpcHandlers({handle:(channel,handler)=>handlers.set(channel,handler)},core as never,
    {isTrustedSender:event=>event?.sender===sender&&event?.senderFrame===frame});
  expect(api.invoke('cue:planning-availability')).toEqual({available:false,reasons:['unconfigured']});
  expect(()=>api.invoke('cue:planning-availability',{})).toThrow('input denied');
  expect(()=>handlers.get('cue:prepare-planning')!({sender:{},senderFrame:frame},planning)).toThrow('sender denied');
  expect(handlers.get('cue:prepare-planning')!({sender,senderFrame:frame},planning)).toMatchObject({runId:'plan-run'});
  expect(api.invoke('cue:prepare-from-planning',conversion)).toMatchObject({runId:'execution-run'});
  const getter=vi.fn(()=> 'plan-run'), accessor=Object.defineProperty({...conversion},'planningRunId',{enumerable:true,get:getter});
  for(const bad of [null,{...planning,proposalText:'model says yes'},{...planning,autonomy:4},{...planning,selectionMode:'unknown'},
    {...conversion,proposalRef:'renderer-invented'}, {...conversion,planningRunId:'../other'},accessor,Object.create(conversion)])
    expect(()=>api.invoke(Object.hasOwn(bad??{},'goal')?'cue:prepare-planning':'cue:prepare-from-planning',bad)).toThrow('input denied');
  expect(getter).not.toHaveBeenCalled();
  expect(core.preparePlanningGoal).toHaveBeenCalledOnce();expect(core.prepareGoalFromPlanningRun).toHaveBeenCalledOnce();
});

const prepared=(phase:'planning'|'execution',runId:string)=>({phase,runId,taskId:runId+'-task',
  ...(phase==='execution'?{sourcePlanningRunId:'plan-run'}:{}),
  threeLines:['무엇을: 변경','어디까지: 대상','안 건드릴 것: 기타'],
  envelope:{worktree_realpath:'C:\\workspace',expires_at:'2099-01-01T00:00:00Z',allowed_actions:['read'],egress:[]},orchestration:null});

test('renderer requires planning approval, released ready result, then a new execution approval', async () => {
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});
  const approvals:string[]=[],launches:string[]=[];
  const api={planningAvailability:vi.fn(async()=>({available:true,reasons:[]})),selectionPreferences:vi.fn(async()=>({available:true,mode:'efficiency',revision:1})),
    preparePlanning:vi.fn(async()=>prepared('planning','plan-run')),prepareFromPlanning:vi.fn(async()=>prepared('execution','execution-run')),
    prepare:vi.fn(async()=>prepared('execution','legacy-run')),approve:vi.fn(async({runId}:{runId:string})=>{approvals.push(runId)}),
    execute:vi.fn(async({runId}:{runId:string})=>{launches.push(runId);return {taskId:runId+'-task',runId,phase:runId==='plan-run'?'planning':'execution',
      state:'completed',status:'done',stage:'done',resultSummary:'done',approvalSummary:'approved',autonomySummary:'bounded',
      executionOwnership:{status:'released'},...(runId==='plan-run'?{planning:{readyForExecution:true,proposalRef:'stored-ref'}}:{})}}),
    resources:vi.fn(async(input:{operation:string})=>input.operation==='list'?[]:{runId:'plan-run',pinSha256:'a'.repeat(64),packages:[]})};
  try {
    Object.assign(dom.window,{cue:api});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
    const doc=dom.window.document;
    await vi.waitFor(()=>expect(doc.querySelector<HTMLInputElement>('#plan-first')!.disabled).toBe(false));
    doc.querySelector<HTMLInputElement>('#plan-first')!.checked=true;
    doc.querySelector<HTMLTextAreaElement>('#goal')!.value='Plan approved change';
    doc.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
    await vi.waitFor(()=>expect(api.preparePlanning).toHaveBeenCalledOnce());
    await vi.waitFor(()=>expect(doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    expect(api.prepareFromPlanning).not.toHaveBeenCalled();
    doc.querySelector<HTMLButtonElement>('#approve')!.click();
    await vi.waitFor(()=>expect(launches).toEqual(['plan-run']));
    expect(approvals).toEqual(['plan-run']);
    await vi.waitFor(()=>expect(doc.querySelector<HTMLButtonElement>('#prepare-from-planning')!.disabled).toBe(false));
    doc.querySelector<HTMLButtonElement>('#prepare-from-planning')!.click();
    await vi.waitFor(()=>expect(api.prepareFromPlanning).toHaveBeenCalledWith(conversion));
    expect(approvals).toEqual(['plan-run']);
    await vi.waitFor(()=>expect(doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    doc.querySelector<HTMLButtonElement>('#approve')!.click();
    await vi.waitFor(()=>expect(approvals).toEqual(['plan-run','execution-run']));
    await vi.waitFor(()=>expect(launches).toEqual(['plan-run','execution-run']));
  } finally {dom.window.close()}
});

test('unconfigured planning is disabled in the real renderer',async()=>{
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});
  try {Object.assign(dom.window,{cue:{planningAvailability:async()=>({available:false,reasons:['unconfigured']}),preparePlanning:vi.fn(),prepareFromPlanning:vi.fn()}});
    dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
    await vi.waitFor(()=>expect(dom.window.document.querySelector('#planning-availability')!.textContent).toContain('사용할 수 없습니다'));
    expect(dom.window.document.querySelector<HTMLInputElement>('#plan-first')!.disabled).toBe(true);
  }finally{dom.window.close()}
});
