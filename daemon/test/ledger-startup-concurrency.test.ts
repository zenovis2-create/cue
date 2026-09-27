import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { openLedger } from '../src/ledger.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

async function concurrentOpen(path: string) {
  const workers: Worker[] = [], results: Promise<{ ok: boolean; stage: string; code?: string; message?: string }>[] = [];
  for (let ordinal = 0; ordinal < 2; ordinal++) {
    const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
      parentPort.once('message',async()=>{let db;try{const {openLedger}=await import(workerData.ledger);db=openLedger(workerData.path);parentPort.postMessage({ok:true,stage:'opened'});}
      catch(error){parentPort.postMessage({ok:false,stage:'openLedger',code:error.code,message:error.message});}
      finally{if(db?.open)db.close();parentPort.close();}});parentPort.postMessage({ready:true});`, {
      eval: true, workerData: { path, ledger: pathToFileURL(resolve('dist/src/ledger.js')).href },
    });
    workers.push(worker);
    await new Promise<void>((done, reject) => { worker.once('error', reject); worker.once('message', message => message.ready ? done() : reject(Error('worker_not_ready'))); });
    results.push(new Promise((done, reject) => { worker.once('error', reject); worker.once('message', done); }));
  }
  try { workers.forEach(worker => worker.postMessage('go')); return await Promise.all(results); }
  finally { await Promise.all(workers.map(worker => worker.terminate())); }
}

test.each(['fresh', 'initialized'] as const)('concurrent openLedger startup is serialized for a %s database', async state => {
  const root = mkdtempSync(join(tmpdir(), 'cue-ledger-startup-')); roots.push(root);
  const path = join(root, 'ledger.sqlite');
  if (state === 'initialized') {
    const db = openLedger(path);
    db.prepare("INSERT INTO task VALUES('preserved','queued',NULL,'before-concurrent-open')").run();
    db.close();
  }
  const results = await concurrentOpen(path);
  expect(results).toEqual([{ ok: true, stage: 'opened' }, { ok: true, stage: 'opened' }]);
  const reopened = openLedger(path);
  try {
    expect(reopened.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(reopened.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(reopened.pragma('foreign_key_check')).toEqual([]);
    expect(reopened.prepare("SELECT version FROM readonly_verifier_migration WHERE singleton=1").get()).toEqual({ version: 'cue-readonly-verifier-v1' });
    expect(reopened.prepare("SELECT state,created_at FROM task WHERE id='preserved'").get()).toEqual(state === 'initialized' ? { state: 'queued', created_at: 'before-concurrent-open' } : undefined);
  } finally { reopened.close(); }
}, 20000);

test('a failed phase rolls back its earlier migrations and closes the connection', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-ledger-startup-')); roots.push(root);
  const path = join(root, 'ledger.sqlite'), moved = join(root, 'released.sqlite');
  const invalid = new Database(path);
  invalid.exec('CREATE TABLE task(id TEXT PRIMARY KEY); CREATE TABLE run(id TEXT PRIMARY KEY);');
  invalid.close();
  expect(() => openLedger(path)).toThrow(/no such table/u);
  const raw = new Database(path, { readonly: true });
  try {
    expect(raw.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('run_autonomy','autonomy_change','recovery_attempt_v2')").get()).toEqual({ n: 0 });
  } finally { raw.close(); }
  expect(() => renameSync(path, moved)).not.toThrow();
});
