import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { envelopeHash, normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { openLedger } from '../src/ledger.js';
import { decideApproval, type ApprovalRequest, type RunEnvelope } from '../src/approval-engine.js';
import { buildPermissionsAccept, type NonEmpty } from '../src/permissions-response.js';
import { carryRawRequest, codexArgv } from '../src/adapters/codex.js';
import { adapterRegistry } from '../src/adapters/registry.js';
import { classifyPayload } from '../src/payload.js';

const roots: string[] = [];
const root = () => { mkdirSync(resolve('.test-state'), { recursive: true }); const p = mkdtempSync(resolve('.test-state/p3a-')); roots.push(p); return p; };
afterEach(() => { for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });

function setup(overrides: Partial<Envelope> = {}) {
  const worktree = root();
  const envelope: Envelope = { run_id: 'r3', worktree_realpath: worktree, egress: ['api.example'], expires_at: '2026-09-03T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['permissions','command','file_change','write_stdin','egress'], ...overrides };
  const normalized = normalizeEnvelope(envelope), hash = envelopeHash(envelope), db = openLedger(), now = '2026-09-02T00:00:00.000Z';
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t3','running',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash,normalized.worktree_realpath,JSON.stringify(normalized.egress),now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r3','t3',hash,0,now);
  return { db, worktree: normalized.worktree_realpath, active: { envelope: normalized, envelope_hash: hash } satisfies RunEnvelope };
}
function req(worktree: string, overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return { method:'commandExecution/request', cwd:worktree, command:'echo safe', thread_id:'th', item_id:randomUUID(), approval_id:null, request_ordinal:0, ...overrides };
}
const at = new Date('2026-09-02T01:00:00Z');

describe('P3-1 canonical envelope', () => {
  it('is stable across key and array order and changes for one field', () => {
    const p=root(), a:Envelope={run_id:'r',worktree_realpath:p,egress:['b','a'],expires_at:'2026-09-03T00:00:00Z',autonomy_level:'bounded',allowed_actions:['write_stdin','command']};
    const reordered = { allowed_actions:['command','write_stdin'], autonomy_level:'bounded', expires_at:'2026-09-03T00:00:00.000Z', egress:['a','b'], worktree_realpath:p, run_id:'r' } as Envelope;
    expect(envelopeHash(a)).toBe(envelopeHash(a)); expect(envelopeHash(reordered)).toBe(envelopeHash(a)); expect(envelopeHash({...a,run_id:'changed'})).not.toBe(envelopeHash(a));
  });
});

describe('P3-2 adapters are transport only', () => {
  it('carries raw values and imports no decision or policy module', () => {
    const raw={x:1}; expect(carryRawRequest('raw/method',raw)).toEqual({method:'raw/method',params:raw});
    for (const file of ['codex.ts','registry.ts']) expect(readFileSync(resolve('src/adapters',file),'utf8')).not.toMatch(/from ['"].*(decide|approval-engine|policy)/);
  });
});

describe('P3-3 fail closed mapping', () => {
  it('declines random unknown methods and has no default allow branch', () => {
    const s=setup(); expect(decideApproval(s.db,s.active,req(s.worktree,{method:`unknown/${randomUUID()}`}),at).decision).toBe('decline');
    expect(readFileSync(resolve('src/approval-engine.ts'),'utf8')).not.toMatch(/default\s*:\s*(?:return\s*)?\{?\s*decision\s*:\s*['"]accept/); s.db.close();
  });
});

describe('P3-4 decision response whitelist', () => {
  it('enumerates only the three response decisions and source has no prohibited response or bypass spelling', () => {
    const s=setup(); const values=[
      decideApproval(s.db,s.active,req(s.worktree),at).decision,
      decideApproval(s.db,s.active,req(s.worktree,{method:'unknown'}),at).decision,
      decideApproval(s.db,s.active,req(s.worktree,{method:'chatgptAuthTokens/refresh'}),at).decision,
    ];
    expect(new Set(values)).toEqual(new Set(['accept','decline','cancel']));
    const source=['approval-engine.ts','permissions-response.ts','envelope.ts','payload.ts','adapters/codex.ts','adapters/registry.ts'].map(f=>readFileSync(resolve('src',f),'utf8')).join('\n');
    const banned=['acceptFor'+'Session','acceptWithExecpolicy'+'Amendment','applyNetworkPolicy'+'Amendment','scope:'+String.fromCharCode(34)+'session'+String.fromCharCode(34),'--'+'yolo','--approve-'+'for-me','--dangerously-'+'bypass','-a '+'never'];
    for(const word of banned) expect(source).not.toContain(word); s.db.close();
  });
});

describe('P3-5 permissions response', () => {
  it('accepts only a nonempty concrete contained path and fixes turn scope and strict review', () => {
    const s=setup(), file=join(s.worktree,'file.txt'); expect(buildPermissionsAccept(s.worktree,[{path:file,access:'write'}])).toEqual({decision:'accept',scope:'turn',strictAutoReview:true,entries:[{path:file,access:'write'}]}); s.db.close();
  });
  it.each([
    ['empty', []], ['glob', [{path:'C:\\tmp\\*',access:'write'}]], ['outside', [{path:resolve(safeOutside()),access:'read'}]], ['special root', [{special:{kind:'root'}}]], ['special arbitrary', [{special:{kind:'future'}}]],
  ])('declines %s entries', (_name, entries) => { const s=setup(); expect(decideApproval(s.db,s.active,req(s.worktree,{method:'permissions/request',entries}),at).decision).toBe('decline'); s.db.close(); });
  it('models nonempty entries at the type boundary and source constructs no empty accept entries', () => {
    const typed: NonEmpty<number>=[1]; expect(typed[0]).toBe(1); expect(readFileSync(resolve('src/permissions-response.ts'),'utf8')).not.toMatch(/decision:\s*['"]accept['"][\s\S]{0,100}entries:\s*\[\s*\]/);
  });
});
function safeOutside() { return join(resolve('.test-state'),'outside.txt'); }

describe('P3-6 preflight', () => {
  it.each([
    ['null cwd',{cwd:null},'decline'], ['wrong cwd',{cwd:resolve('.')},'decline'], ['null command',{command:null},'decline'],
    ['extra outside',{additionalPermissions:[{path:resolve('.'),access:'read'}]},'decline'],
    ['outside grant',{method:'fileChange/request',grantRoot:resolve('.')},'cancel'],
    ['auth gate',{method:'chatgptAuthTokens/refresh'},'cancel'], ['tool',{method:'item/tool/call'},'decline'], ['elicitation',{method:'mcpServer/elicitation/request'},'decline'],
  ])('%s',(_name, change, expected)=>{ const s=setup(); expect(decideApproval(s.db,s.active,req(s.worktree,change),at).decision).toBe(expected); s.db.close(); });
  it('judges writeStdin independently of a parent command decision', () => {
    const s=setup({allowed_actions:['write_stdin']}); expect(decideApproval(s.db,s.active,req(s.worktree,{method:'commandExecution/request'}),at).decision).toBe('decline'); expect(decideApproval(s.db,s.active,req(s.worktree,{method:'writeStdin/request'}),at).decision).toBe('accept'); s.db.close();
  });
});

describe('P3-7 replay prevention', () => {
  it('declines a duplicate null approval id and appends a replay alert', () => {
    const s=setup(), r=req(s.worktree,{item_id:'same',approval_id:null}); expect(decideApproval(s.db,s.active,r,at).decision).toBe('accept'); expect(decideApproval(s.db,s.active,r,at)).toMatchObject({decision:'decline',reason:'replay'}); expect(s.db.prepare("SELECT count(*) n FROM artifact WHERE kind='replay_alert'").get()).toEqual({n:1}); s.db.close();
  });
});

describe('P3-8 lifetime', () => {
  it('declines after expiry and after run end without inheritance', () => {
    const s=setup({expires_at:'2026-09-02T00:30:00Z'}); expect(decideApproval(s.db,s.active,req(s.worktree),at).decision).toBe('decline'); const ended={...s.active,ended_at:'2026-09-02T00:10:00Z'}; expect(decideApproval(s.db,ended,req(s.worktree),new Date('2026-09-02T00:20:00Z')).decision).toBe('decline'); s.db.close();
  });
});

describe('P3-10 byte-owned payload classification', () => {
  it('classifies actual bytes and cancels opaque, encrypted, and invalid binary payloads', () => {
    expect(classifyPayload(Buffer.from('{"x":1}'))).toBe('json'); const s=setup();
    for(const change of [{opaque:true},{encrypted:true},{payloadBytes:Uint8Array.from([0xff,0xfe])}]) expect(decideApproval(s.db,s.active,req(s.worktree,change),at).decision).toBe('cancel');
    const source=readFileSync(resolve('src/approval-engine.ts'),'utf8')+readFileSync(resolve('src/payload.ts'),'utf8'); expect(source).not.toMatch(/declared(?:Type|_type)|reported(?:Type|_type)|payload(?:Type|_type)/); s.db.close();
  });
});

describe('P3-13 cancel is danger-only', () => {
  it('returns cancel only for the three enumerated reasons across all mapped and rejected paths', () => {
    const s=setup(), cases:Partial<ApprovalRequest>[]=[{}, {method:'permissions/request',entries:[]},{method:'unknown'},{cwd:null},{command:null},{additionalPermissions:[]},{method:'fileChange/request'},{method:'writeStdin/request'},{method:'network/request'},{method:'item/tool/x'},{method:'mcpServer/elicitation/request'},{method:'chatgptAuthTokens/refresh'},{method:'fileChange/request',grantRoot:resolve('.')},{opaque:true}];
    const cancels=cases.map(c=>decideApproval(s.db,s.active,req(s.worktree,c),at)).filter(x=>x.decision==='cancel'); expect(cancels.map(x=>'reason' in x?x.reason:'')).toEqual(['credential_request','outside_grant_root','uninspectable_payload']); s.db.close();
  });
});

describe('P3-14 execution profile', () => {
  it('generates on-request argv without prohibited flags and source passes grep', () => {
    expect(codexArgv(['--listen','stdio'])).toEqual(['-a','on-request','app-server','--listen','stdio']); const src=readFileSync(resolve('src/adapters/codex.ts'),'utf8'); expect(src).toContain("'-a', 'on-request'"); expect(src).not.toMatch(/yolo|approve-for-me|dangerously-bypass|['"]never['"]/);
  });
});

describe('P3-18 advisory tools', () => {
  it('marks Codex non-enforcing and core enforcement has no tool-kind bypass', () => {
    expect(adapterRegistry).toContainEqual({name:'codex',enforcement_capable:false}); const core=readFileSync(resolve('src/approval-engine.ts'),'utf8'); expect(core).not.toMatch(/tool(?:Name|_name|Kind|_kind)|enforcement_capable/); expect(core).toContain('mandatoryChecks(request, active, now)');
  });
});
