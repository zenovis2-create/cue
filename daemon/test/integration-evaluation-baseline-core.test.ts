import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';

const roots:string[]=[],cores:CueCore[]=[];afterEach(async()=>{for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})});
const h=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(verifier?:any){const root=mkdtempSync(join(tmpdir(),'cue-baseline-core-')),workspace=join(root,'workspace');roots.push(root);mkdirSync(workspace);
  const core=createCueCore(initializeConfig(join(root,'state'),{worktreeRoot:workspace}),undefined,{verifyExplicitUserBaselineAuthority:verifier});cores.push(core);const db=core.daemon.db;
  const env=normalizeEnvelope({run_id:'run',worktree_realpath:workspace,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('task','awaiting_approval','now');db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,workspace);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run('run','task',eh,'now');
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-12T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:1,allowedCandidateIds:['agent'],pinnedCandidateId:'agent'}});bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-12T00:00:00.000Z'});
  const input={baselineId:'baseline',enrollmentId:'enrollment',runId:'run',dataset:{id:'cohort',revision:'v1',cases:[{id:'eval',kind:'code',inputDigest:h('e'),split:'evaluation'},{id:'hold',kind:'code',inputDigest:h('h'),split:'holdout'}]},caseId:'eval',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},candidate:{id:'agent',revision:'v1',digest:h('c')},metric:{id:'m',revision:'v1',digest:h('m')},environment:{id:'e',revision:'v1',digest:h('e')},accountLimits:{id:'a',revision:'v1',digest:h('a')},enrolledAtMs:1,authorityRef:{id:'user',revision:'v1',digest:h('u')}} as const;return{core,db,input}}

test('Core is workspace-scoped and its host verifier defaults closed without granting execution or policy authority',()=>{const denied=fixture();expect(()=>denied.core.declareManualEvaluationBaseline(denied.input)).toThrow('authority_unavailable');expect((denied.db.prepare('SELECT count(*) n FROM evaluation_baseline_declaration').get() as any).n).toBe(0);
  let calls=0;const allowed=fixture(()=>{calls++;return true}),saved=allowed.core.declareManualEvaluationBaseline(allowed.input);expect(allowed.core.readManualEvaluationBaseline('baseline')).toEqual(saved);expect(calls).toBe(1);
  expect((allowed.db.prepare('SELECT count(*) n FROM approval_event').get() as any).n).toBe(0);expect((allowed.db.prepare('SELECT count(*) n FROM execution_event').get() as any).n).toBe(0);expect((allowed.db.prepare('SELECT count(*) n FROM orchestration_attempt').get() as any).n).toBe(0);expect((allowed.db.prepare('SELECT count(*) n FROM selection_policy_snapshot').get() as any).n).toBe(1);
  expect(()=>allowed.core.declareManualEvaluationBaseline({...allowed.input,verifyExplicitUserBaselineAuthority:()=>true} as never)).toThrow('resource_input');expect(calls).toBe(1);
});
