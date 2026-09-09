import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope } from '../src/envelope.js';
import { createCleanCodexHome } from '../src/tool-home.js';
import * as hostRuntime from '../src/host-codex-runtime.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

function preflightViolationServerSource(): string {
  return String.raw`
const readline=require('node:readline');
const rl=readline.createInterface({input:process.stdin});
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);
if(m.method==='initialize')send({id:m.id,result:{}});
else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-p12-runtime'}}});
else if(m.method==='turn/start'){
  send({id:m.id,result:{turn:{id:'turn-p12-runtime'}}});
  send({method:'item/tool/call',id:801,params:{threadId:'thread-p12-runtime',turnId:'turn-p12-runtime',callId:'preflight-runtime',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-Command',"Set-Content -LiteralPath 'C:\\\\cue-p12-outside.txt' -Value x"]}}});
}}
);
`;
}

describe.skipIf(process.platform !== 'win32')('P12 runtime enforcement provenance', () => {
  it('attempts every teardown stage after an earlier worker stop fails', async () => {
    const teardown = (hostRuntime as any).settleHostRuntimeTeardown;
    expect(typeof teardown).toBe('function');
    const secondStop = vi.fn();
    const controller = vi.fn(() => { throw new Error('controller close failed'); });
    const cleanup = vi.fn();
    const errors = await teardown({
      closeRpc: vi.fn(() => { throw new Error('rpc close failed'); }),
      workers: [
        { stop: () => { throw new Error('worker stop failed'); }, completion: Promise.reject(new Error('worker settle failed')) },
        { stop: secondStop, completion: Promise.resolve({ status: 'interrupted' }) },
      ],
      closeController: controller,
      cleanup,
    });
    expect(secondStop).toHaveBeenCalledOnce();
    expect(controller).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(errors.map((entry: { stage: string }) => entry.stage)).toEqual(['rpc', 'worker_stop', 'worker_completion', 'controller']);
  });

  it('persists bounded ordered provenance even when preflight seals before a worker PID exists', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-runtime-enforcement-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendorDir);
    writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const codexHome = createCleanCodexHome(join(root, 'homes'), join(sourceHome, 'auth.json'));
    const binary = join(vendorDir, 'codex.exe');
    copyFileSync(process.execPath, binary);
    const server = join(worktree, 'preflight-server.cjs');
    writeFileSync(server, preflightViolationServerSource());

    const db = openLedger();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-p12-runtime', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-p12-runtime', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-p12-runtime', 'task-p12-runtime', 'envelope-p12-runtime', 1, now);
    const envelope = normalizeEnvelope({
      run_id: 'run-p12-runtime', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z',
      autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'],
    });

    const running = hostRuntime.launchHostCodexRun(db, {
      cwd: worktree, task_id: 'task-p12-runtime', run_id: 'run-p12-runtime',
    }, envelope, {
      binary, codexHome, goal: 'preflight provenance', controllerArgs: [server], requestTimeoutMs: 5_000, runTimeoutMs: 10_000,
    });
    const result = await running.done;
    const executions = (db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='tool_execution' ORDER BY rowid").all('run-p12-runtime') as Array<{ content: string }>)
      .map(row => JSON.parse(row.content));
    db.close();

    expect(result).toMatchObject({ status: 'failed', failureKind: 'enforcement', successfulToolCalls: 0 });
    expect(executions).toEqual([expect.objectContaining({
      ordinal: 1,
      callId: 'preflight-runtime',
      program: 'powershell.exe',
      argumentCount: 3,
      pid: null,
      exitCode: null,
      boundary: 'preflight',
      violation: 'filesystem',
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
    })]);
  }, 30_000);
});
