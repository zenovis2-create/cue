import {createHash} from 'node:crypto';
import {describe,expect,test} from 'vitest';
import {capturePlanningInput,checkGoalPlanningProposal} from '../../app/goal-planning-contract.mjs';
import goalCore from '../src/verification/goal-proposal-checker.cjs';

const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const canonical=(value:any):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const goal='Improve the parser safely';
const policyDigest='a'.repeat(64);
const inputText=capturePlanningInput({goal,selectionMode:'efficiency',executionPolicy:{policyRevision:'approved:1',policyDigest,mode:'efficiency'},
  allowedCandidateIds:['maker','checker'],allowedScopeIds:['worktree'],checkerRegistry:[{checkerId:'trusted-code',revision:'v1',kinds:['code'],parametersDigest:'b'.repeat(64),targetIds:['target']}],targetLimits:{maxBytes:65536,maxChangeTargets:2}});
const proposal=()=>({version:'cue-goal-proposal-v1',goalSha256:sha(goal),plan:{policyRevision:'approved:1',policyDigest,tasks:[
  {id:'implement',role:'implementation',ownerId:'maker-owner',requirementIds:['r1'],dependencyIds:[],candidateIds:['maker'],scopeIds:['worktree']},
  {id:'verify',role:'verifier',ownerId:'checker-owner',requirementIds:['r1'],dependencyIds:['implement'],candidateIds:['checker'],scopeIds:[]}]},
  requirements:[{id:'r1',text:'Parser handles input',kind:'code',required:true,checks:[{checkerId:'trusted-code',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['target'] }]}],
  instructions:[{taskId:'implement',text:'Edit parser'},{taskId:'verify',text:'Verify parser'}],changeTargets:[{taskId:'implement',targetId:'target',relativePath:'src/parser.ts',maxBackupBytes:1000}]});
const check=(body:object)=>checkGoalPlanningProposal({goal,inputText,outputBytes:Buffer.from(canonical(body))});
describe('approved goal planning contract',()=>{
  test('preapproval snapshot has deterministic goal, policy, candidates, scopes, checker and limits',()=>{
    const input=JSON.parse(inputText);
    expect(input).toMatchObject({version:'cue-planning-input-v1',goalSha256:sha(goal),executionPolicy:{policyDigest,mode:'efficiency'},allowedCandidateIds:['checker','maker'],targetLimits:{maxBytes:65536}});
    expect(capturePlanningInput({goal,selectionMode:'efficiency',executionPolicy:{policyRevision:'approved:1',policyDigest,mode:'efficiency'},allowedCandidateIds:['checker','maker'],allowedScopeIds:['worktree'],checkerRegistry:[{checkerId:'trusted-code',revision:'v1',kinds:['code'],parametersDigest:'b'.repeat(64),targetIds:['target']}],targetLimits:{maxBytes:65536,maxChangeTargets:2}})).toBe(inputText);
  });
  test('valid bounded proposal gets structural pass and exact digest',()=>{
    const result=check(proposal());
    expect(result).toMatchObject({status:'pass',proposalRef:`goal-proposal:${sha(canonical(proposal()))}`});
    expect(goalCore.checkGoalProposal(Buffer.from(inputText),Buffer.from(canonical(proposal())))).toMatchObject({status:'pass',proposalDigest:sha(canonical(proposal()))});
  });
  test('model cannot change goal, policy, candidate, checker, or target scope',()=>{
    const changes=[
      {...proposal(),goalSha256:'c'.repeat(64)},
      {...proposal(),plan:{...proposal().plan,policyDigest:'c'.repeat(64)}},
      {...proposal(),plan:{...proposal().plan,tasks:proposal().plan.tasks.map((t,i)=>i? t:{...t,candidateIds:['unapproved']})}},
      {...proposal(),requirements:[{...proposal().requirements[0],checks:[{...proposal().requirements[0].checks[0],checkerId:'model-picked'}]}]},
      {...proposal(),changeTargets:[{...proposal().changeTargets[0],relativePath:'../escape'}]},
    ];
    for(const body of changes){expect(check(body).status).toBe('fail');expect(goalCore.checkGoalProposal(Buffer.from(inputText),Buffer.from(canonical(body))).status).toBe('fail');}
  });
  test('malformed or oversized bytes do not pass',()=>{
    expect(checkGoalPlanningProposal({goal,inputText,outputBytes:Buffer.from('{')}).status).toBe('fail');
    expect(checkGoalPlanningProposal({goal,inputText,outputBytes:Buffer.alloc(65537,65)}).status).toBe('fail');
  });
  test('every maker must precede the independent verifier in both checkers',()=>{
    const base=proposal();
    const extra={id:'second-maker',role:'implementation',ownerId:'other-maker',requirementIds:['r1'],dependencyIds:[],candidateIds:['maker'],scopeIds:['worktree']};
    const body={...base,plan:{...base.plan,tasks:[...base.plan.tasks,extra]},instructions:[...base.instructions,{taskId:'second-maker',text:'Improve another parser path'}]};
    expect(check(body).status).toBe('fail');
    expect(goalCore.checkGoalProposal(Buffer.from(inputText),Buffer.from(canonical(body))).status).toBe('fail');
  });
  test('one checker code can cover distinct approved contracts without tuple substitution',()=>{
    const registry=[
      {checkerId:'trusted-code',revision:'v1',kinds:['code' as const],parametersDigest:'b'.repeat(64),targetIds:['target']},
      {checkerId:'trusted-code',revision:'v1',kinds:['code' as const],parametersDigest:'c'.repeat(64),targetIds:['second-target']},
    ];
    const authority={goal,selectionMode:'efficiency' as const,executionPolicy:{policyRevision:'approved:1',policyDigest,mode:'efficiency' as const},allowedCandidateIds:['maker','checker'],allowedScopeIds:['worktree'],checkerRegistry:registry,targetLimits:{maxBytes:65536,maxChangeTargets:2}};
    const approved=capturePlanningInput(authority);
    expect(capturePlanningInput({...authority,checkerRegistry:[...registry].reverse()})).toBe(approved);
    expect(()=>capturePlanningInput({...authority,checkerRegistry:[registry[0],registry[0]]})).toThrow('goal_planning_contract');
    const base=proposal();
    const body={...base,plan:{...base.plan,tasks:base.plan.tasks.map(t=>({...t,requirementIds:['r1','r2']}))},requirements:[...base.requirements,{...base.requirements[0],id:'r2',checks:[{checkerId:'trusted-code',revision:'v1',parametersDigest:'c'.repeat(64),targetIds:['second-target']}]}],changeTargets:[...base.changeTargets,{taskId:'implement',targetId:'second-target',relativePath:'src/second.ts',maxBackupBytes:1000}]};
    const statuses=(value:object)=>{const bytes=Buffer.from(canonical(value));return [checkGoalPlanningProposal({goal,inputText:approved,outputBytes:bytes}).status,goalCore.checkGoalProposal(Buffer.from(approved),bytes).status];};
    expect(statuses(body)).toEqual(['pass','pass']);
    for(const changed of [
      {...body.requirements[1].checks[0],parametersDigest:'b'.repeat(64)},
      {...body.requirements[1].checks[0],targetIds:['target']},
      {...body.requirements[1].checks[0],revision:'v2'},
    ])expect(statuses({...body,requirements:[body.requirements[0],{...body.requirements[1],checks:[changed]}]})).toEqual(['fail','fail']);
  });
});
