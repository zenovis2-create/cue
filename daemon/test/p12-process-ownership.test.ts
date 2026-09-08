import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../src/ledger.js';
import * as processLaunch from '../src/process-launch.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const processAlive = (pid: number): boolean => spawnSync('powershell.exe', ['-NoProfile', '-Command', `if (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`]).status === 0;

describe.skipIf(process.platform !== 'win32')('P12 post-spawn ownership failure', () => {
  it('marks an unverified process-tree cleanup as terminal containment failure', () => {
    const terminate = (processLaunch as any).terminateUnownedProcessTree;
    expect(typeof terminate).toBe('function');
    expect(() => terminate(12345, {
      taskkill: () => ({ status: 5, stderr: 'denied' }),
      processAlive: () => false,
    })).toThrow(expect.objectContaining({ code: 'CUE_TERMINATION_UNVERIFIED' }));
  });

  it('terminates and verifies the spawned process tree when session persistence fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-owned-spawn-'));
    roots.push(root);
    const pidFile = join(root, 'descendant.pid');
    const marker = `cue-p12-descendant-${Date.now()}`;
    const fixture = join(root, 'parent.cjs');
    writeFileSync(fixture, `const {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)',${JSON.stringify(marker)}],{windowsHide:true});writeFileSync(${JSON.stringify(pidFile)},String(child.pid));setInterval(()=>{},1000);`);
    const db = openLedger();
    const realPrepare = db.prepare.bind(db);
    const proxy = Object.create(db);
    proxy.prepare = (sql: string) => {
      if (sql.startsWith('INSERT INTO session_handle')) return {
        run() {
          const deadline = Date.now() + 5_000;
          while (!existsSync(pidFile) && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
          throw new Error('forced session_handle insert failure');
        },
      };
      return realPrepare(sql);
    };
    let descendant = 0;
    try {
      expect(() => processLaunch.spawnOwned(proxy, {
        cwd: root, task_id: 'task-owned', run_id: 'run-owned',
      }, process.execPath, [fixture], { cwd: root, windowsHide: true })).toThrow('forced session_handle insert failure');
      expect(existsSync(pidFile)).toBe(true);
      descendant = Number(readFileSync(pidFile, 'utf8'));
      expect(processAlive(descendant)).toBe(false);
    } finally {
      if (descendant && processAlive(descendant)) spawnSync('taskkill.exe', ['/PID', String(descendant), '/T', '/F']);
      db.close();
    }
  }, 20_000);
});
