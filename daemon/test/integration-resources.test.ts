import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createResourcePackages } from '../src/resources/packages.js';
import { createResourceStore } from '../src/resources/store.js';
import { openLedger, type Ledger } from '../src/ledger.js';
import { assessExtensionCandidate } from '../src/extensions/quarantine.js';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-resource-package-'));
  mkdirSync(join(root, 'docs'));
  const text = '한국어 지식과 EnglishIdentifier — 참고 데이터입니다.';
  writeFileSync(join(root, 'docs', 'guide.md'), text);
  writeFileSync(join(root, 'user-notes.txt'), 'preserve user file');
  const manifest = { schemaVersion: 1, id: 'fixture-pack', version: '1.0.0', source: 'https://example.invalid/fixture/resources', revision: 'a'.repeat(40),
    resources: [{ id: 'guide', kind: 'knowledge', path: 'docs/guide.md', sha256: hash(text), byteLength: Buffer.byteLength(text) }] };
  const save = () => { const bytes = JSON.stringify(manifest); writeFileSync(join(root, 'manifest.json'), bytes); return { root, manifestSha256: hash(bytes) }; };
  return { root, manifest, text, save };
}
function seed(db: Ledger, runId: string) {
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('task_' + runId, 'awaiting_approval', 'now');
  db.prepare('INSERT OR IGNORE INTO envelope VALUES(?,?,?,?)').run('env', process.cwd(), '[]', 'now');
  db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId, 'task_' + runId, 'env', 'now');
}
function treeHash(root: string): string {
  const records: string[] = [];
  const visit = (dir: string, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const name = prefix ? prefix + '/' + entry.name : entry.name, path = join(dir, entry.name);
      if (entry.isDirectory()) { records.push('d:' + name); visit(path, name); }
      else records.push('f:' + name + ':' + hash(readFileSync(path)));
    }
  };
  visit(root); return hash(records.join('\n'));
}
function authorityCounters(db: Ledger) {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name='verification' OR name LIKE '%policy%' OR name LIKE '%acceptance%' OR name LIKE '%capability%') ORDER BY name").all() as { name: string }[]);
  return tables.map(({ name }) => [name, (db.prepare(`SELECT count(*) n FROM "${name}"`).get() as { n: number }).n]);
}
function homeAccessProbe(home: string) {
  let calls=0; const base=resolve(home), names=['lstatSync','realpathSync','openSync','readFileSync','writeFileSync','appendFileSync','mkdirSync','readdirSync','rmSync','unlinkSync','renameSync','copyFileSync'] as const;
  const spies=names.map(name=>{const original=(fs[name] as any).bind(fs);return vi.spyOn(fs,name as any).mockImplementation(((...args:unknown[])=>{
    if (typeof args[0] === 'string') { const path=resolve(args[0]), rel=path.slice(base.length); if (path===base || (path.startsWith(base) && /^[\\/]/.test(rel))) calls++; }
    return original(...args);
  }) as any)}); syncBuiltinESMExports();
  return { calls:()=>calls, restore(){for(const spy of spies)spy.mockRestore();syncBuiltinESMExports();} };
}
describe('declarative local resource snapshots (fixture provenance only)', () => {
  it('pins immutable full provenance/content for existing runs; updates and removal affect new runs only without writes', () => {
    const f = fixture(), registry = createResourcePackages(), input = f.save();
    const filesBefore = readdirSync(f.root), userBefore = readFileSync(join(f.root,'user-notes.txt'));
    const first = registry.register(input), run1 = registry.pinRun('run1');
    expect(first).toMatchObject({ version: '1.0.0', source: f.manifest.source, revision: f.manifest.revision, manifestSha256: input.manifestSha256 });
    expect(first.resources[0]!.text).toBe(f.text);
    expect(Object.isFrozen(run1)).toBe(true); expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.resources[0])).toBe(true);
    expect(registry.register(input)).toBe(first);
    writeFileSync(join(f.root,'docs','guide.md'), 'updated text'); f.manifest.version = '2.0.0'; f.manifest.revision = 'b'.repeat(40);
    f.manifest.resources[0]!.sha256 = hash('updated text'); f.manifest.resources[0]!.byteLength = Buffer.byteLength('updated text');
    const second = registry.register(f.save());
    expect(registry.pinRun('run1')).toBe(run1); expect(run1[0]!.resources[0]!.text).toBe(f.text);
    expect(registry.pinRun('run2')[0]).toBe(second);
    expect(registry.remove('fixture-pack')).toBe(true); expect(registry.pinRun('run3')).toEqual([]);
    expect(registry.pinRun('run2')[0]).toBe(second); expect(registry.pinRun('run1')).toBe(run1);
    expect(readFileSync(join(f.root,'user-notes.txt'))).toEqual(userBefore); expect(readdirSync(f.root)).toEqual(filesBefore);
    expect(readFileSync(join(f.root,'docs','guide.md'),'utf8')).toBe('updated text');
    expect(Object.keys(registry).sort()).toEqual(['pinRun','register','remove']);
  });
  it('hash drift and same-version replacement never replace an existing run or active package', () => {
    const f = fixture(), registry = createResourcePackages(), input = f.save(); registry.register(input);
    const run = registry.pinRun('initial');
    expect(() => registry.register({ ...input, manifestSha256: '0'.repeat(64) })).toThrow('manifest_hash');
    writeFileSync(join(f.root,'docs','guide.md'), 'x'.repeat(Buffer.byteLength(f.text)));
    expect(() => registry.register(input)).toThrow('content_hash');
    f.manifest.resources[0]!.sha256 = hash('x'.repeat(Buffer.byteLength(f.text)));
    expect(() => registry.register(f.save())).toThrow('version_conflict');
    expect(registry.pinRun('initial')).toBe(run); expect(registry.pinRun('new')[0]).toBe(run[0]);
  });
  it('rejects path traversal, absolute/ADS/reserved paths and sensitive kinds before reading', () => {
    const f = fixture(), registry = createResourcePackages();
    for (const path of ['../secret.txt','/root.txt','C:/secret.txt','docs\\guide.md','docs/../guide.md','docs/guide.md:stream','docs/CON.txt','.env','credentials.json','raw-conversation.json','docs/file.js',
      'auth.json','nested/authentication.md','nested/environment.txt','nested/raw-conversation.json','nested/chat-history.txt','nested/transcript.md','nested/raw-transcript.json']) {
      f.manifest.resources[0]!.path = path; expect(() => registry.register(f.save()),path).toThrow('resource_path');
    }
    f.manifest.resources[0]!.path = 'docs/guide.md';
    for (const kind of ['credentials','env','raw-conversation','hook','mcp','javascript']) {
      f.manifest.resources[0]!.kind = kind; expect(() => registry.register(f.save())).toThrow('resource_schema');
    }
  });
  it('rejects actual directory symlink/junction escape and linked package root', () => {
    const f = fixture(), outside = mkdtempSync(join(tmpdir(),'cue-resource-outside-'));
    writeFileSync(join(outside,'guide.md'),f.text);
    const link = join(f.root,'linked'); symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
    f.manifest.resources[0]!.path='linked/guide.md';
    expect(() => createResourcePackages().register(f.save())).toThrow('resource_path_escape');
    const alias = join(mkdtempSync(join(tmpdir(),'cue-resource-alias-')),'package'); symlinkSync(f.root,alias,process.platform==='win32'?'junction':'dir');
    expect(() => createResourcePackages().register({...f.save(),root:alias})).toThrow('resource_root_link');
    expect(readFileSync(join(outside,'guide.md'),'utf8')).toBe(f.text);
  });
  it('rejects oversized files, invalid UTF8, unknown manifest hooks and host accessors without invocation', () => {
    const f=fixture(),registry=createResourcePackages();
    f.manifest.resources[0]!.byteLength=65537; expect(()=>registry.register(f.save())).toThrow('schema');
    f.manifest.resources[0]!.byteLength=2; f.manifest.resources[0]!.sha256=hash(Buffer.from([0xc0,0xaf])); writeFileSync(join(f.root,'docs','guide.md'),Buffer.from([0xc0,0xaf]));
    expect(()=>registry.register(f.save())).toThrow('package_unavailable');
    for (const field of ['hooks','mcpServers','install','postinstall','entrypoint','permissions','network']) {
      const executable={...f.manifest,[field]:'blocked candidate field'}, bytes=JSON.stringify(executable); writeFileSync(join(f.root,'manifest.json'),bytes);
      expect(()=>registry.register({root:f.root,manifestSha256:hash(bytes)}),field).toThrow('schema');
    }
    writeFileSync(join(f.root,'manifest.json'),'x'.repeat(32769));
    expect(()=>registry.register({root:f.root,manifestSha256:'a'.repeat(64)})).toThrow('size');
    let called=false;
    const input=Object.defineProperty({manifestSha256:'a'.repeat(64)},'root',{enumerable:true,get(){called=true;return f.root;}});
    expect(()=>registry.register(input as {root:string;manifestSha256:string})).toThrow('schema'); expect(called).toBe(false);
  });
  it('persists exact run pins across update, removal and two ledger reopens without widening authority', () => {
    const root=mkdtempSync(join(tmpdir(),'cue-resource-safety-')), pack=join(root,'package'), fakeHome=join(root,'fake-home'), dbFile=join(root,'ledger.sqlite');
    mkdirSync(pack); for (const dir of ['hooks','mcp','auth']) mkdirSync(join(fakeHome,dir),{recursive:true});
    writeFileSync(join(fakeHome,'hooks','sentinel.txt'),'harmless hook sentinel'); writeFileSync(join(fakeHome,'mcp','sentinel.json'),'{}');
    writeFileSync(join(fakeHome,'auth','sentinel.txt'),'harmless auth sentinel'); writeFileSync(join(fakeHome,'config.toml'),'sentinel=true');
    writeFileSync(join(pack,'user-notes.txt'),'preserve package user file');
    const homeBefore=treeHash(fakeHome), userBefore=hash(readFileSync(join(pack,'user-notes.txt')));
    const source=(version:string,text:string)=>{const bytes=Buffer.from(text);writeFileSync(join(pack,'guide.md'),bytes);const body=JSON.stringify({schemaVersion:1,id:'durable-pack',version,source:'https://example.invalid/durable',revision:(version==='1.0.0'?'a':'b').repeat(40),resources:[{id:'guide',kind:'knowledge',path:'guide.md',sha256:hash(bytes),byteLength:bytes.length}]});writeFileSync(join(pack,'manifest.json'),body);return{root:pack,manifestSha256:hash(body)}};
    let db=openLedger(dbFile);
    try {
      let store=createResourceStore(db), counters=authorityCounters(db); expect(counters).toContainEqual(['verification',0]); const v1=store.importApproved(source('1.0.0','old exact bytes')); seed(db,'run1'); const run1=store.pinRun('run1');
      const v2=store.importApproved(source('2.0.0','current exact bytes')); db.close(); db=openLedger(dbFile); store=createResourceStore(db);
      expect(store.readRun('run1')).toEqual(run1); expect(store.readRun('run1')![0]!.resources[0]!.text).toBe('old exact bytes');
      seed(db,'run2'); const run2=store.pinRun('run2'); expect(run2[0]).toMatchObject({version:'2.0.0',manifestSha256:v2.manifestSha256}); expect(run2[0]!.resources[0]!.text).toBe('current exact bytes');
      expect(v1.manifestSha256).not.toBe(v2.manifestSha256); expect(store.remove('durable-pack')).toBe(true); db.close(); db=openLedger(dbFile); store=createResourceStore(db);
      expect(store.readRun('run1')).toEqual(run1); expect(store.readRun('run2')).toEqual(run2); seed(db,'run3'); expect(store.pinRun('run3')).toEqual([]);
      expect(authorityCounters(db)).toEqual(counters); expect((db.prepare('SELECT count(*) n FROM verification').get() as {n:number}).n).toBe(0); expect(treeHash(fakeHome)).toBe(homeBefore); expect(hash(readFileSync(join(pack,'user-notes.txt')))).toBe(userBefore);
    } finally {
      if (db.open) db.close(); const expected=join(resolve(tmpdir()),'cue-resource-safety-'); if (!resolve(root).startsWith(expected)) throw Error('unsafe-test-cleanup'); rmSync(root,{recursive:true,force:true});
    }
  });
  it('allows only verified declarative references and quarantines executable requirements without home, registration, permission or request access', async () => {
    const f=fixture(), root=mkdtempSync(join(tmpdir(),'cue-resource-quarantine-')), fakeHome=join(root,'fake-home'), work=join(root,'work'); mkdirSync(fakeHome); mkdirSync(work);
    for(const dir of ['hooks','mcp','auth'])mkdirSync(join(fakeHome,dir));writeFileSync(join(fakeHome,'hooks','sentinel.txt'),'harmless');writeFileSync(join(fakeHome,'mcp','sentinel.json'),'{}');writeFileSync(join(fakeHome,'auth','sentinel.txt'),'harmless');writeFileSync(join(fakeHome,'config.toml'),'sentinel=true');
    const homeBefore=treeHash(fakeHome); vi.stubEnv('HOME',fakeHome); vi.stubEnv('USERPROFILE',fakeHome); const access=homeAccessProbe(fakeHome);
    const registry=createResourcePackages(), snapshot=registry.register(f.save()), db=openLedger(':memory:'), store=createResourceStore(db), core=createCueCore(initializeConfig(join(root,'core-data'),{worktreeRoot:work}));
    let externalCalls=0, hostileGetterCalls=0, permissionGrantCalls=0; const registrationCalls={package:0,store:0,core:0};
    const permissionGrantBaseline=permissionGrantCalls, verificationBaseline=(db.prepare('SELECT count(*) n FROM verification').get() as {n:number}).n;
    const host={
      packageRegister:(input:{root:string;manifestSha256:string})=>{registrationCalls.package++;return registry.register(input)},
      storeImport:(input:{root:string;manifestSha256:string})=>{registrationCalls.store++;return store.importApproved(input)},
      coreImport:(input:{root:string;manifestSha256:string})=>{registrationCalls.core++;return core.importResourcePackage(input)},
      grantPermissions:()=>{permissionGrantCalls++},
    };
    const deny=()=>{externalCalls++;throw Error('unexpected_external_request')};
    const spies=[vi.spyOn(http,'request').mockImplementation(deny as any),vi.spyOn(https,'request').mockImplementation(deny as any),
      vi.spyOn(net,'connect').mockImplementation(deny as any),vi.spyOn(dns,'lookup').mockImplementation(deny as any),vi.spyOn(dns,'resolve').mockImplementation(deny as any),
      vi.spyOn(globalThis,'fetch').mockImplementation(deny as any)];
    try {
      const declarative={id:snapshot.id,version:snapshot.version,manifestSha256:snapshot.manifestSha256,mode:'declarative-resource' as const,requirements:[]};
      const reference=assessExtensionCandidate(declarative,snapshot); expect(reference).toEqual({status:'reference-only',reference:{id:snapshot.id,version:snapshot.version,manifestSha256:snapshot.manifestSha256},resourceCount:1,totalBytes:Buffer.byteLength(f.text)});
      if (reference.status !== 'reference-only') throw Error('expected_reference');
      expect(Object.isFrozen(reference)).toBe(true); expect(Object.isFrozen(reference.reference)).toBe(true); expect(reference).not.toHaveProperty('text');
      expect(()=>assessExtensionCandidate({...declarative,version:'2.0.0'},snapshot)).toThrow('snapshot_binding');
      expect(()=>assessExtensionCandidate(declarative,Object.freeze({...snapshot}) as any)).toThrow('snapshot_binding');
      const executable={...declarative,mode:'node-executable' as const,requirements:['hook','mcp','tool','policy','permission','network','entrypoint'] as const};
      const admit=(candidate:any)=>{const result=assessExtensionCandidate(candidate,snapshot);if(result.status==='quarantined')return result;host.packageRegister(f.save());host.storeImport(f.save());host.coreImport(f.save());host.grantPermissions();return result};
      const quarantined=admit(executable); expect(quarantined).toEqual({status:'quarantined',reason:'extension_execution_requires_isolation',releaseRequires:['os-isolation-boundary','p13-qualified-evidence'],candidateSha256:hash(JSON.stringify(executable))});
      if (quarantined.status !== 'quarantined') throw Error('expected_quarantine');
      expect(Object.isFrozen(quarantined)).toBe(true); expect(Object.isFrozen(quarantined.releaseRequires)).toBe(true); expect(JSON.stringify(quarantined)).not.toMatch(/command|module|secret|hook|mcp|tool|policy|permission|network|entrypoint/);
      for (const hostile of [new Proxy(executable,{}),Object.create(executable),{...executable,command:'never print this'},Object.defineProperty({...executable},'id',{enumerable:true,get(){hostileGetterCalls++;return 'fixture-pack'}})])
        expect(()=>assessExtensionCandidate(hostile as any)).toThrow('candidate_schema');
      expect(registrationCalls).toEqual({package:0,store:0,core:0}); expect(permissionGrantBaseline).toBe(0); expect(permissionGrantCalls).toBe(permissionGrantBaseline); expect(hostileGetterCalls).toBe(0); expect(access.calls()).toBe(0); expect(externalCalls).toBe(0);
      expect(verificationBaseline).toBe(0); expect((db.prepare('SELECT count(*) n FROM verification').get() as {n:number}).n).toBe(verificationBaseline);
    } finally {
      for (const spy of spies) spy.mockRestore(); access.restore(); vi.unstubAllEnvs(); if(core.daemon.db.open)await core.close(); if(db.open)db.close();
      expect(treeHash(fakeHome)).toBe(homeBefore); rmSync(f.root,{recursive:true,force:true}); const expected=join(resolve(tmpdir()),'cue-resource-quarantine-');if(!resolve(root).startsWith(expected))throw Error('unsafe-test-cleanup');rmSync(root,{recursive:true,force:true});
    }
  });
});
