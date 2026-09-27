import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import type {Ledger} from '../ledger.js';
import {createEvaluationBaselineStore} from './baseline.js';
import {canonicalizeManualBaselineRequest,manualBaselineRequestPayload,type ManualBaselineAuthorityRequest} from './baseline-contract.js';
import {readFixedBaselinePlan} from './baseline-plan.js';
export type ManualBaselineChoice=Readonly<{baselineId:string;enrollmentId:string;runId:string;dataset:unknown;caseId:string;metric:unknown;environment:unknown;accountLimits:unknown}>;
export type BaselineConfirmationView=Readonly<{request:ManualBaselineAuthorityRequest;tasks:ReturnType<typeof readFixedBaselinePlan>['tasks'];executionAuthorized:false;trialMeasured:false}>;
export type ConfirmManualBaseline=(view:BaselineConfirmationView)=>Promise<boolean>;
function fail(reason:string):never{throw Error('evaluation_baseline_confirmation_'+reason);}
const active=new WeakSet<Ledger>();
export function createManualBaselineConfirmation(db:Ledger,host:{now():number;isCurrent(runId:string):boolean}){
  return Object.freeze({async request(input:unknown,confirm:ConfirmManualBaseline){
    if(!db.open||db.inTransaction||active.has(db))fail('busy');
    if(typeof confirm!=='function')fail('unavailable');
    if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)fail('input');
    const keys=['baselineId','enrollmentId','runId','dataset','caseId','metric','environment','accountLimits'],d=Object.getOwnPropertyDescriptors(input);
    if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail('input');
    const value=Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
    if(typeof value.runId!=='string'||!host.isCurrent(value.runId))fail('scope');
    const plan=readFixedBaselinePlan(db,value.runId),at=host.now();
    if(!Number.isSafeInteger(at)||at<0)fail('clock');
    const store=createEvaluationBaselineStore(db);
    // Canonicalization snapshots hostile nested input before any UI callback.
    let request=canonicalizeManualBaselineRequest({...value,policy:plan.policy,candidate:plan.candidate,planDigest:plan.planDigest,enrolledAtMs:at,
      authorityRef:{id:'desktop-confirmation:'+randomUUID(),revision:'fixed-plan-v1',digest:'0'.repeat(64)}});
    const prior=store.read(request.baselineId);
    if(prior){
      const replay=canonicalizeManualBaselineRequest({...manualBaselineRequestPayload(request),enrolledAtMs:prior.enrolledAtMs,authorityRef:prior.authorityRef});
      if(JSON.stringify(manualBaselineRequestPayload(replay))!==JSON.stringify(manualBaselineRequestPayload(prior)))fail('replay_conflict');
      return prior;
    }
    const content=JSON.stringify(manualBaselineRequestPayload(request));
    request=canonicalizeManualBaselineRequest({...manualBaselineRequestPayload(request),authorityRef:{...request.authorityRef,digest:createHash('sha256').update(content).digest('hex')}});
    store.preflight(manualBaselineRequestPayload(request));
    active.add(db);
    try{
      const accepted=await confirm(Object.freeze({request,tasks:plan.tasks,executionAuthorized:false,trialMeasured:false}));
      const now=host.now();
      if(accepted!==true)fail('denied');
      if(!db.open||db.inTransaction||!host.isCurrent(request.runId)||!Number.isSafeInteger(now)||now<at||now-at>120000)fail('stale');
      const approved=JSON.stringify(manualBaselineRequestPayload(request));
      // This authority exists only in the stack after the trusted host's explicit
      // confirmation. No renderer flag or callback is accepted as consent data.
      return createEvaluationBaselineStore(db,candidate=>JSON.stringify(manualBaselineRequestPayload(candidate))===approved).declare(manualBaselineRequestPayload(request));
    }finally{active.delete(db);}
  }});
}
