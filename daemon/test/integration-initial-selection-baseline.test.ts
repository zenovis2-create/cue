import { afterEach, describe, expect, it } from 'vitest';
import type { Ledger } from '../src/ledger.js';
import { createInitialSelectionLedgerFixture, initialSelectionRequest } from './fixtures/initial-selection-ledger.js';

const dbs: Ledger[]=[];
afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();});

describe('initial-selection staged baseline',()=>{
  it('uses the real existing engine and replays without duplicate reservation or launch',async()=>{
    const f=createInitialSelectionLedgerFixture();dbs.push(f.db);
    expect(await f.engine.start(f.plan,initialSelectionRequest)).toMatchObject({candidateId:'agent',replayed:false,launch:'started'});
    expect(await f.engine.start(f.plan,initialSelectionRequest)).toMatchObject({candidateId:'agent',replayed:true,launch:'not-relaunched'});
    expect(f.truth).toMatchObject({launches:1,preparations:1,observations:1,authorizations:1,reservations:1});
    expect(f.budget.summary('run').committedUnits).toBe(40n);
    expect(f.db.prepare('SELECT COUNT(*) n FROM integration_budget_reservation').get()).toEqual({n:1});
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({n:1});
    expect(f.db.prepare('SELECT COUNT(*) n FROM attempt_selection').get()).toEqual({n:1});
    expect(f.db.prepare("SELECT COUNT(*) n FROM artifact WHERE kind='initial-selection-baseline'").get()).toEqual({n:1});
    expect(f.db.prepare("SELECT COUNT(*) n FROM workspace_write_lease WHERE run_id='run'").get()).toEqual({n:1});
  });
  it('rolls claim and ordinary reservation back when later preparation fails',async()=>{
    const f=createInitialSelectionLedgerFixture();dbs.push(f.db);f.truth.failPreparation=true;
    await expect(f.engine.start(f.plan,initialSelectionRequest)).rejects.toThrow('fixture_prepare_failure');
    expect(f.truth).toMatchObject({launches:0,preparations:1,reservations:1});
    expect(f.budget.summary('run').committedUnits).toBe(0n);
    expect(f.db.prepare('SELECT COUNT(*) n FROM integration_budget_reservation').get()).toEqual({n:0});
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({n:0});
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_activity').get()).toEqual({n:0});
    expect(f.db.prepare('SELECT COUNT(*) n FROM attempt_selection').get()).toEqual({n:0});
    expect(f.db.prepare("SELECT COUNT(*) n FROM artifact WHERE kind='initial-selection-baseline'").get()).toEqual({n:0});
    expect(f.db.prepare('SELECT COUNT(*) n FROM workspace_write_lease').get()).toEqual({n:0});
  });
  it('denies an unavailable candidate before authorization, reservation, or launch',async()=>{
    const f=createInitialSelectionLedgerFixture();dbs.push(f.db);f.truth.eligible=false;
    await expect(f.engine.start(f.plan,initialSelectionRequest)).rejects.toThrow(/no-eligible-candidate/);
    expect(f.truth).toMatchObject({observations:1,authorizations:0,preparations:0,launches:0});
    expect(f.budget.summary('run').committedUnits).toBe(0n);
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({n:0});
  });
});
