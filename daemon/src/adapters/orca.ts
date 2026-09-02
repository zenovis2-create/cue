import { execFileSync } from 'node:child_process';

export type OrcaExec = (args: readonly string[]) => string;
const defaultExec: OrcaExec = args => execFileSync('orca', [...args], { encoding: 'utf8', windowsHide: true });

export function parseOrcaJson(text: string): unknown {
  let quoted = false, escaped = false, clean = '';
  for (const char of text) {
    if (quoted && char.charCodeAt(0) < 0x20 && char !== '\t' && char !== '\n' && char !== '\r') clean += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    else clean += char;
    if (escaped) escaped = false;
    else if (char === '\\' && quoted) escaped = true;
    else if (char === '"') quoted = !quoted;
  }
  return JSON.parse(clean);
}

function invoke(exec: OrcaExec, args: readonly string[]): unknown { return parseOrcaJson(exec([...args, '--json'])); }
export function createWorktree(name: string, repo: string, exec: OrcaExec = defaultExec): unknown { return invoke(exec, ['worktree','create','--name',name,'--repo',repo,'--setup','skip']); }
export function worktreePs(exec: OrcaExec = defaultExec): unknown { return invoke(exec, ['worktree','ps']); }
export function taskList(runId: string, exec: OrcaExec = defaultExec): unknown { return invoke(exec, ['orchestration','task-list','--run',runId]); }
export function workerStop(dispatchId: string, exec: OrcaExec = defaultExec): unknown { return invoke(exec, ['orchestration','worker-stop','--dispatch',dispatchId]); }
export function workerAbandon(dispatchId: string, exec: OrcaExec = defaultExec): unknown { return invoke(exec, ['orchestration','worker-abandon','--dispatch',dispatchId]); }
