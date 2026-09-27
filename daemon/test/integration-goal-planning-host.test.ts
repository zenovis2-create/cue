import {afterEach,describe,it,expect} from 'vitest';
import {rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createGoalPlanningHost} from '../../app/goal-planning-host.mjs';
import {createOrchestrationDriver} from '../../app/orchestration-driver.mjs';
import {makeAcceptedPlanningFixture,fixtureResources} from './fixtures/goal-planning-host.js';

afterEach(()=>{for(const db of fixtureResources.dbs.splice(0))db.close();for(const root of fixtureResources.roots.splice(0))rmSync(root,{recursive:true,force:true});});
it('loads compiled planning host in actual Node',()=>{
  const entry=new URL('../../app/goal-planning-host.mjs',import.meta.url).href;
  const child=spawnSync(process.execPath,['--input-type=module','-e','const h=await import(process.argv[1]);if(typeof h.createGoalPlanningHost!=="function")throw Error("missing");process.stdout.write("ok")',entry],{encoding:'utf8',timeout:10000,windowsHide:true});
  expect(child.error).toBeUndefined();expect(child.status).toBe(0);expect(child.stderr).toBe('');expect(child.stdout).toBe('ok');
});
describe('approved goal planning host, synthetic executor boundary only',()=>{
  it('prepares exact approved input and runs producer/verifier through ledger acceptance',async()=>{
    const f=makeAcceptedPlanningFixture();
    const ready=createGoalPlanningHost(f.options);expect(ready.available,JSON.stringify(ready)).toBe(true);if(!ready.available)return;
    f.run.template={id:'goal-planning-v1',inputText:ready.host.capturePlanningInput({goal:f.run.goal,selectionMode:f.run.selectionMode})};
    expect(JSON.parse(f.run.template.inputText)).toMatchObject({goalSha256:createHash('sha256').update(f.run.goal).digest('hex'),executionPolicy:{policyRevision:'approved:1'}});
    const driver=createOrchestrationDriver({db:f.db,host:ready.host});
    expect(driver.prepare(f.run).generatedOutputs).toMatchObject([{targetId:'goal-proposal',producerTaskId:'produce-plan'}]);
    f.approve();driver.activate(f.run);await driver.start(f.run);
    expect(f.controls.launches).toEqual(['model','checker']);
    expect(driver.snapshot('workflow')).toMatchObject({state:'completed',acceptance:'verified'});
    expect((f.db.prepare("SELECT count(*) n FROM generated_output_observation WHERE target_id='goal-proposal'").get() as any).n).toBe(1);
    await driver.close();
  });
  it('rejects changed approved input before a planning stage',()=>{
    const f=makeAcceptedPlanningFixture(),ready=createGoalPlanningHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));
    f.run.template={id:'goal-planning-v1',inputText:ready.host.capturePlanningInput({goal:f.run.goal,selectionMode:f.run.selectionMode})+' '};
    const driver=createOrchestrationDriver({db:f.db,host:ready.host});
    expect(()=>driver.prepare(f.run)).toThrow('goal-planning-input-binding');
    expect(f.controls.launches).toEqual([]);
  });
  it('retains the trusted execution contract when caller options change after host construction',()=>{
    const f=makeAcceptedPlanningFixture(),ready=createGoalPlanningHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));
    const original=ready.host.capturePlanningInput({goal:f.run.goal,selectionMode:'efficiency'});
    f.options.executionPolicies.efficiency.policyDigest='c'.repeat(64);
    f.options.approvedExecution.checkerRegistry[0].checkerId='injected-checker';
    expect(ready.host.capturePlanningInput({goal:f.run.goal,selectionMode:'efficiency'})).toBe(original);
  });
});
