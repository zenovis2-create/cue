import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { CueBuzzAdapter, type BuzzMessage } from '../src/buzz-adapter.js';
import { renderApproval, interview, narrowUncertainty } from '../src/approval-surface.js';
import { ConversationDaemonApi, type AcceptedConversationRun } from '../src/conversation-daemon.js';
import { authorizeFrontdoorTool, frontdoorTools, FrontdoorSession } from '../src/frontdoor.js';
import { healthVector } from '../src/health.js';

const now='2026-09-03T00:00:00.000Z';
const healthy=healthVector({orca:true,codex_app_server:true,daemon:true,sentinel:true});

function setup(send?: (message:BuzzMessage)=>Promise<void>) {
  const db=openLedger();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t','awaiting_approval',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e','C:/work','[]',now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r','t','e',0,now);
  const outbound=new CueBuzzAdapter({identity:'@cue',relayEndpoint:'https://relay.invalid',credentialRef:'secret-reference'},async(_config,message)=>send?.(message));
  return {db,api:new ConversationDaemonApi(db,outbound)};
}

function request(overrides:Partial<AcceptedConversationRun>={}):AcceptedConversationRun {
  return {taskId:'t',runId:'r',envelopeHash:'e',channelId:'approved-channel',threadRoot:'approved-root',retryCap:3,...overrides};
}

describe('Phase 6 conversation surface',()=>{
  it('P6-1 fails closed before an outbound attempt when @cue identity is absent',async()=>{
    let attempts=0;
    const adapter=new CueBuzzAdapter(undefined,async()=>{attempts++;});
    await expect(adapter.send({channel_id:'c',thread_root:'th',text:'done'})).resolves.toBe('identity_unconfigured');
    expect(attempts).toBe(0);
  });

  it('P6-2 exposes exactly conversation and daemon API, denying worker and edit tools',()=>{
    expect(frontdoorTools).toEqual(['conversation','daemon_api']);
    for(const denied of ['codex','orca','file_edit','shell']) expect(authorizeFrontdoorTool(denied)).toBe(false);
    const {db,api}=setup(); const frontdoor=new FrontdoorSession(api);
    expect(()=>frontdoor.request('codex',request(),healthy)).toThrow('frontdoor tool denied');
    expect((db.prepare('SELECT state FROM task WHERE id=?').get('t') as {state:string}).state).toBe('awaiting_approval'); db.close();
  });

  it('P6-2 reaches running only through the injected daemon API and frontdoor has no launch path',()=>{
    const {db,api}=setup(); const frontdoor=new FrontdoorSession(api);
    expect(frontdoor.request('daemon_api',request(),healthy)).toEqual({accepted:true,autonomy:3});
    expect(db.prepare('SELECT state FROM task WHERE id=?').get('t')).toEqual({state:'running'});
    const source=readFileSync(resolve('src/frontdoor.ts'),'utf8');
    expect(source).not.toMatch(/child_process|process-launch|session-spawn|codex-session|spawn|execFile|execSync/u); db.close();
  });

  it('P6-2 daemon API fails closed when the approved envelope does not match the run ledger',()=>{
    const {db,api}=setup();
    expect(api.accept(request({envelopeHash:'different'}),healthy)).toEqual({accepted:false,message:'작업을 수락하지 않았습니다. 실행 봉투가 원장과 일치하지 않습니다.'});
    expect(db.prepare('SELECT state FROM task WHERE id=?').get('t')).toEqual({state:'awaiting_approval'});
    expect(db.prepare('SELECT count(*) AS n FROM conversation_route').get()).toEqual({n:0}); db.close();
  });

  it('P6-3 daemon sends after the frontdoor session is closed and needs no session handle',async()=>{
    const delivered:BuzzMessage[]=[]; const {db,api}=setup(async message=>{delivered.push(message);});
    const frontdoor=new FrontdoorSession(api); frontdoor.request('daemon_api',request(),healthy); frontdoor.close();
    expect(frontdoor.isClosed()).toBe(true); await expect(api.sendResult('r','완료')).resolves.toBe('sent');
    expect(delivered).toEqual([{channel_id:'approved-channel',thread_root:'approved-root',text:'완료'}]); db.close();
  });

  it('P6-4 pins channel and thread at approval and rejects later mutation',async()=>{
    const delivered:BuzzMessage[]=[]; const {db,api}=setup(async message=>{delivered.push(message);}); api.accept(request(),healthy);
    expect(()=>db.prepare("UPDATE conversation_route SET channel_id='other',thread_root='other' WHERE run_id='r'").run()).toThrow('immutable');
    await api.sendResult('r','result from another channel request');
    expect(delivered[0]).toMatchObject({channel_id:'approved-channel',thread_root:'approved-root'}); db.close();
  });

  it('P6-5 serializes concurrent channels without mixing their state',async()=>{
    const {db,api}=setup(); const order:string[]=[];
    const a=api.enqueue('a',async()=>{order.push('a:start'); await Promise.resolve(); order.push('a:end'); return 'A';});
    const b=api.enqueue('b',async()=>{order.push('b:start'); order.push('b:end'); return 'B';});
    await expect(Promise.all([a,b])).resolves.toEqual([{channelId:'a',value:'A'},{channelId:'b',value:'B'}]);
    expect(order).toEqual(['a:start','a:end','b:start','b:end']); db.close();
  });

  it('P6-6 renders exactly Korean three lines plus one envelope line without configuration markup',()=>{
    const output=renderApproval({what:'버그 수정',extent:'daemon/src',excluded:'외부 계정',envelopeSummary:'쓰기 daemon/src, 네트워크 없음'});
    expect(output.split('\n')).toHaveLength(4);
    expect(output).toBe('무엇을: 버그 수정\n어디까지: daemon/src\n안 건드릴 것: 외부 계정\n봉투: 쓰기 daemon/src, 네트워크 없음 · 자율성 ③');
    expect(output).not.toMatch(/(^|\n)\s*[\w-]+:\s*(\||>|\{|\[)|---|\.ya?ml/iu);
    for(const file of ['src/frontdoor.ts','src/approval-surface.ts']) expect(readFileSync(resolve(file),'utf8')).not.toMatch(/yaml|editor|editForm|configurationPanel/iu);
  });

  it('P6-7 asks at most three envelope-changing questions and narrows other uncertainty',()=>{
    const questions=interview([
      {question:'범위?',changesEnvelope:true},{question:'취향?',changesEnvelope:false},{question:'네트워크?',changesEnvelope:true},
      {question:'쓰기?',changesEnvelope:true},{question:'네 번째?',changesEnvelope:true},
    ]);
    expect(questions).toEqual(['범위?','네트워크?','쓰기?']);
    const narrowed=narrowUncertainty({what:'수정',extent:'src',excluded:'외부',envelopeSummary:'src'},'배포');
    expect(narrowed.excluded).toContain('불확실: 배포'); expect(Object.isFrozen(narrowed)).toBe(true);
  });

  it('P6-8 stays silent while healthy; time alone cannot emit an outbound message',async()=>{
    vi.useFakeTimers(); let sent=0; const {db}=setup(async()=>{sent++;});
    await vi.advanceTimersByTimeAsync(86_400_000); expect(sent).toBe(0);
    for(const file of ['src/frontdoor.ts','src/conversation-daemon.ts']) expect(readFileSync(resolve(file),'utf8')).not.toMatch(/setInterval|heartbeat.*send|send.*heartbeat/iu);
    vi.useRealTimers(); db.close();
  });

  it('P6-9 reports dead Orca before refusing task acceptance',()=>{
    const {db,api}=setup(); const result=api.accept(request(),healthVector({orca:false,codex_app_server:true,daemon:true,sentinel:true}));
    expect(result).toEqual({accepted:false,message:'작업을 수락하지 않았습니다. 죽은 구성요소: orca'});
    expect(db.prepare('SELECT state FROM task WHERE id=?').get('t')).toEqual({state:'awaiting_approval'}); db.close();
  });

  it('P6-10 has no canvas writer or annotation path on the conversation surface',()=>{
    const source=['src/frontdoor.ts','src/conversation-daemon.ts','src/buzz-adapter.ts'].map(file=>readFileSync(resolve(file),'utf8')).join('\n');
    expect(source).not.toMatch(/canvas|annotation/iu);
  });

  it('P6-11 defaults to level 3 and records the selected level in the P5 ledger table',()=>{
    const first=setup(); expect(first.api.accept(request(),healthy)).toEqual({accepted:true,autonomy:3});
    expect(first.db.prepare('SELECT level FROM run_autonomy WHERE run_id=?').get('r')).toEqual({level:3}); first.db.close();
    const selected=setup(); expect(selected.api.accept(request({autonomy:2}),healthy)).toEqual({accepted:true,autonomy:2});
    expect(selected.db.prepare('SELECT level FROM run_autonomy WHERE run_id=?').get('r')).toEqual({level:2}); selected.db.close();
  });

  it.skip('P6 external Buzz live delivery and @cue registration — SKIPPED: would mutate an external system',()=>{});
});
