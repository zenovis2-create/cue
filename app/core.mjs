import { closeSync, mkdirSync, openSync, readFileSync, realpathSync, writeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../daemon/dist/src/ledger.js';
import { envelopeHash } from '../daemon/dist/src/envelope.js';
import { renderApproval } from '../daemon/dist/src/approval-surface.js';
import { readTaskCard } from '../daemon/dist/src/ui/model.js';
import { spawnVendorCodexInAppContainer } from '../daemon/dist/src/codex-session.js';
import { RecoveryCoordinator } from '../daemon/dist/src/watcher.js';

const FORBIDDEN_CONFIG_KEYS = /credential|password|secret|token|api[_-]?key/i;
function writeNew(path, content) { const fd=openSync(path,'wx',0o600); try { writeSync(fd,content); } finally { closeSync(fd); } }
function artifactForGoal(goal) { const words=goal.normalize('NFKC').toLowerCase().match(/[a-z0-9가-힣]+/gu)??[]; const stem=words.slice(0,5).join('-').slice(0,48).replace(/^-+|-+$/gu,'')||'task'; return `${stem}-${createHash('sha256').update(goal).digest('hex').slice(0,8)}.txt`; }

export function initializeConfig(userDataPath, defaults={}) {
  mkdirSync(userDataPath,{recursive:true}); const configPath=join(userDataPath,'cue-config.json');
  try { return Object.freeze(JSON.parse(readFileSync(configPath,'utf8'))); } catch(error) { if(error?.code!=='ENOENT') throw error; }
  const config=Object.freeze({version:1,ledgerPath:resolve(defaults.ledgerPath??join(userDataPath,'cue-ledger.sqlite')),worktreeRoot:realpathSync.native(resolve(defaults.worktreeRoot??process.cwd()))});
  if(Object.keys(config).some(key=>FORBIDDEN_CONFIG_KEYS.test(key))) throw new Error('credential fields are forbidden');
  writeNew(configPath,`${JSON.stringify(config,null,2)}\n`); return config;
}

export class AppDaemon {
  #db; #status='ready'; #workers=new Map();
  constructor(config){this.#db=openLedger(config.ledgerPath);} get db(){return this.#db;} get status(){return this.#status;}
  own(runId,launched){this.#workers.set(runId,launched);} release(runId){this.#workers.delete(runId);}
  stop(runId,reason='cancelled'){
    const launched=this.#workers.get(runId); if(!launched)return false; const pid=launched.session.pid;
    if(process.platform==='win32') spawnSync('taskkill.exe',['/PID',String(launched.child.pid),'/T','/F'],{stdio:'ignore'});
    else { try{process.kill(pid);}catch{} try{launched.child.kill();}catch{} }
    this.#workers.delete(runId);
    this.#db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE id=(SELECT task_id FROM run WHERE id=?) AND state='running'").run(reason,runId);
    this.#db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) SELECT task_id,?,'worker_stopped',?,? FROM run WHERE id=?").run(runId,`${reason}:pid=${pid}`,new Date().toISOString(),runId); return true;
  }
  crash(reason='daemon_crash'){this.#status='blocked/crash'; for(const id of [...this.#workers.keys()])this.stop(id,reason); this.#db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE state='running'").run(reason);}
  close(){if(this.#status==='closed')return; for(const id of [...this.#workers.keys()])this.stop(id,'app_closed'); this.#db.close(); this.#status='closed';}
}

export function createCueCore(config,daemon=new AppDaemon(config),runtime={}){
  const db=daemon.db,prepared=new Map();
  const defaultBinary=process.env.APPDATA?join(process.env.APPDATA,'npm','node_modules','@openai','codex','node_modules','@openai','codex-win32-x64','vendor','x86_64-pc-windows-msvc','bin','codex.exe'):undefined;
  const defaultHome=process.env.USERPROFILE?join(process.env.USERPROFILE,'.codex'):undefined;
  const engine={binary:runtime.binary??process.env.CUE_VENDOR_CODEX??defaultBinary,codexHome:runtime.codexHome??process.env.CODEX_HOME??defaultHome,extraArgs:runtime.extraArgs??[],prompt:runtime.prompt};
  function prepareGoal(goal,autonomy=3){
    goal=String(goal).trim(); if(!goal)throw new Error('goal required'); if(![1,2,3].includes(autonomy))throw new Error('invalid autonomy');
    const taskId=randomUUID(),runId=randomUUID(),artifact=artifactForGoal(goal),envelope={run_id:runId,worktree_realpath:config.worktreeRoot,egress:[],expires_at:new Date(Date.now()+3600000).toISOString(),autonomy_level:'bounded',allowed_actions:[`write:${artifact}`]},hash=envelopeHash(envelope),now=new Date().toISOString();
    db.transaction(()=>{db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(taskId,'awaiting_approval',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash,envelope.worktree_realpath,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(runId,taskId,hash,0,now);db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId,runId,'goal',goal,now);db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId,runId,'expected_output',artifact,now);})();
    const copy=Object.freeze({what:goal,extent:`worktree의 ${artifact} 한 파일`,excluded:'네트워크, 외부 시스템, 그 밖의 파일',envelopeSummary:`${artifact} 한 파일 쓰기 · 네트워크 없음`}); const run=Object.freeze({taskId,runId,envelopeHash:hash,autonomy,envelope:Object.freeze(envelope),copy,goal,artifact}); prepared.set(runId,run);
    return Object.freeze({taskId,runId,autonomy,threeLines:renderApproval({...copy,autonomy}).split('\n'),envelope:Object.freeze({...envelope})});
  }
  function approve(runId){const run=prepared.get(runId);if(!run)throw new Error('unknown run');const now=new Date().toISOString();db.transaction(()=>{db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)').run(runId,run.envelopeHash,'desktop',`goal:${run.taskId}`,`approval:${runId}`,0,'accept',now);db.prepare('INSERT INTO run_autonomy(run_id,level,retry_cap,recorded_at) VALUES(?,?,?,?)').run(runId,run.autonomy,3,now);})();return Object.freeze({approved:true,runId});}
  function launch(run){
    if(!engine.binary||!engine.codexHome)throw new Error('owned Codex launch configuration required'); const target=resolve(config.worktreeRoot,run.artifact);
    const prompt=engine.prompt?.(run)??`Work only inside the current workspace. Do not use the network or modify any other file.\nGoal: ${run.goal}\nCreate exactly one UTF-8 text file named ${run.artifact}. Its content must include this exact goal text: ${JSON.stringify(run.goal)}.\nDo the work now, verify the file, then finish.`;
    const args=['exec','--json','--ephemeral','--skip-git-repo-check','--sandbox','workspace-write',...engine.extraArgs,prompt],now=new Date().toISOString(); db.prepare("UPDATE task SET state='running',blocked_reason=NULL WHERE id=?").run(run.taskId);db.prepare('UPDATE run SET write_in_progress=1 WHERE id=?').run(run.runId);db.prepare('INSERT INTO execution_event(run_id,thread_id,item_id,approval_id,execution_id,execution_ordinal,created_at) VALUES(?,?,?,?,?,?,?)').run(run.runId,'desktop',`goal:${run.taskId}`,`approval:${run.runId}`,`exec:${run.runId}`,0,now);
    const launched=spawnVendorCodexInAppContainer(db,{cwd:config.worktreeRoot,task_id:run.taskId,run_id:run.runId},engine.binary,engine.codexHome,args);daemon.own(run.runId,launched);let output='';launched.child.stdout?.on('data',x=>output+=String(x));launched.child.stderr?.on('data',x=>output+=String(x));
    launched.child.once('exit',code=>{if(daemon.status==='closed')return;daemon.release(run.runId);const task=db.prepare('SELECT state FROM task WHERE id=?').get(run.taskId);if(task?.state!=='running')return;let verified=false;try{verified=readFileSync(target,'utf8').includes(run.goal);}catch{}const at=new Date().toISOString();db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(run.runId);if(code===0&&verified){db.prepare("UPDATE task SET state='completed' WHERE id=?").run(run.taskId);db.prepare('INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES(?,?,?,?,?)').run(run.runId,'goal_artifact','PASS',target,at);return;}
      const contract={goal:run.goal,constraints:['approved envelope only'],done_when:['goal artifact verified'],deliverable:run.artifact},recovery=new RecoveryCoordinator(db,run.runId,3,contract,run.autonomy);let decision=recovery.recover({runId:run.runId,failure:`exit=${code}; verified=${verified}`,contract,actionAllowed:true},`worker exit ${code}; artifact verification ${verified}`);while(run.autonomy===3&&!['human','stop'].includes(decision.action))decision=recovery.recover({runId:run.runId,failure:`exit=${code}; verified=${verified}`,contract,actionAllowed:true},`retry strategy ${Date.now()} ${decision.action}`);db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE id=?").run(decision.action==='human'?'human_required':'worker_failed',run.taskId);const diagnostic=output.replace(/(?:token|secret|password|api[_-]?key)[^\r\n]{0,200}/giu,'[REDACTED]').slice(-2000);db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(run.taskId,run.runId,'worker_failure',`exit=${code}; verified=${verified}; output=${diagnostic}`,at);
    });
  }
  function execute(runId){const run=prepared.get(runId);if(!run)throw new Error('unknown run');if(!db.prepare("SELECT id FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(runId,run.envelopeHash))throw new Error('approval required');if(daemon.status!=='ready')throw new Error('daemon blocked/crash');launch(run);return completion(run.taskId);}
  function completion(taskId){const card=readTaskCard(db,taskId),symbol=card.autonomyLevel===null?null:'①②③'[card.autonomyLevel-1];return Object.freeze({...card,approvalSummary:`자동 승인 ${card.accepted}건 · 거부 ${card.declined}건`,autonomySummary:`자율성: ${symbol} · 자동 복구 ${card.recoveryAttempts}회`});}
  return Object.freeze({prepareGoal,approve,execute,stop:runId=>daemon.stop(runId),completion,daemon,close:()=>daemon.close()});
}
