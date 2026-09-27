import { afterEach, expect, test } from 'vitest';
import { openLedger, type Ledger } from '../src/ledger.js';

const dbs:Ledger[]=[];
afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();});

test('installs an immutable bounded persisted cost-observation schema',()=>{
  const db=openLedger();dbs.push(db);
  expect(db.prepare("SELECT version FROM cost_observation_migration WHERE singleton=1").get()).toEqual({version:'cue-persisted-cost-observation-v1'});
  expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('cost_observation_migration','orchestration_cost_observation')").get()).toEqual({n:2});
  expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'cost_observation_*'").get()).toEqual({n:4});
  expect(()=>db.prepare("UPDATE cost_observation_migration SET version='x'").run()).toThrow();
});

