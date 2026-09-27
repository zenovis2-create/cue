import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareWriteExistingNative, getChangeSnapshotHelperMetadata, identifyChangeSnapshotRoot, snapshotRelativeNative } from '../change-snapshot-host.js';
import { resolveSealedExecutable, runProcessSync } from '../process-launch.js';
import { ATTEMPT_STAGING_FACTORY_PROTOCOL, type CleanRootInspection, type StagingFactory, type StagingInheritedPublication, type StagingRootIdentity, type StagingRootObservation } from './staging-authority.js';

const CONTRACT = 'cue-git-staging-factory-win32-v1';
const LIMIT = 8 * 1024 * 1024;
const TIMEOUT = 15_000;
const unsafeConfig = '^(filter\\.|include\\.|includeif\\.|core\\.(hookspath|attributesfile)$|extensions\\.worktreeconfig$|core\\.fsmonitor$)';
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const sameIdentity = (a: StagingRootIdentity, b: StagingRootIdentity): boolean => a.volumeSerial === b.volumeSerial && a.fileId === b.fileId;

type Ownership = Readonly<{
  schemaVersion: typeof CONTRACT; attemptDigest: string; state: 'creating' | 'active' | 'cleaned';
  publicationWorktreeRealpath: string; baseCommitId: string; cleanSnapshotSha256: string;
  executionWorktreeRealpath: string; storageRootIdentity: StagingRootIdentity; publicationRootIdentity: StagingRootIdentity;
  publicationGitCommonRealpath: string; publicationGitCommonIdentity: StagingRootIdentity;
  ownedDirectoryIdentity: StagingRootIdentity; gitAdminRealpath?: string; gitAdminIdentity?: StagingRootIdentity; rootIdentity?: StagingRootIdentity;
  inheritedSha256?: string;
}>;

function contains(root: string, candidate: string): boolean {
  const part = relative(root, candidate);
  return part === '' || (!isAbsolute(part) && part.split(/[\\/]/u)[0] !== '..');
}

function assertPlainText(value: string, code: string): void {
  if (!value || value.length > 32_768 || value.includes('\0') || value.includes('\r') || value.includes('\n')) throw Error(code);
}

function noReparse(path: string, recursive: boolean): boolean {
  try {
    const root = parse(path).root;
    for (let cursor = resolve(path); cursor.length >= root.length; cursor = dirname(cursor)) {
      if (lstatSync(cursor).isSymbolicLink() || (lstatSync(cursor).mode & 0o170000) === 0o120000) return false;
      if (cursor === root) break;
    }
    if (!recursive) return true;
    const pending = [path]; let count = 0;
    while (pending.length) {
      const current = pending.pop()!;
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (++count > 100_000 || entry.isSymbolicLink()) return false;
        if (entry.isDirectory()) pending.push(join(current, entry.name));
      }
    }
    return true;
  } catch { return false; }
}

function identity(path: string): StagingRootIdentity {
  const result = identifyChangeSnapshotRoot(path);
  if (result.state !== 'ok') throw Error('git_staging_native_identity_unavailable');
  return result.identity;
}

function atomicRecord(path: string, value: Ownership): void {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value), { encoding: 'utf8', flag: 'wx' });
  renameSync(temp, path);
}

function readRecord(path: string): Ownership {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Ownership;
  const keys = raw && typeof raw === 'object' ? Object.keys(raw).sort() : [];
  const required = ['attemptDigest','baseCommitId','cleanSnapshotSha256','executionWorktreeRealpath','ownedDirectoryIdentity','publicationGitCommonIdentity','publicationGitCommonRealpath','publicationRootIdentity','publicationWorktreeRealpath','schemaVersion','state','storageRootIdentity'];
  const active = ['gitAdminIdentity','gitAdminRealpath','rootIdentity'];
  if (keys.includes('inheritedSha256')) { if(!/^[a-f0-9]{64}$/u.test(raw.inheritedSha256??''))throw Error('git_staging_ownership_corrupt'); required.push('inheritedSha256'); }
  const validIdentity = (value: unknown): value is StagingRootIdentity => !!value && typeof value === 'object' && Object.keys(value).sort().join(',') === 'fileId,volumeSerial'
    && /^[a-f0-9]{16}$/u.test((value as StagingRootIdentity).volumeSerial) && /^[a-f0-9]{32}$/u.test((value as StagingRootIdentity).fileId);
  if (!raw || (keys.join(',') !== required.sort().join(',') && keys.join(',') !== [...required, ...active].sort().join(',')) || raw.schemaVersion !== CONTRACT || !/^[a-f0-9]{64}$/u.test(raw.attemptDigest)
    || !['creating', 'active', 'cleaned'].includes(raw.state) || !isAbsolute(raw.publicationWorktreeRealpath)
    || !isAbsolute(raw.executionWorktreeRealpath) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(raw.baseCommitId)
    || !/^[a-f0-9]{64}$/u.test(raw.cleanSnapshotSha256) || !isAbsolute(raw.publicationGitCommonRealpath) || !validIdentity(raw.publicationGitCommonIdentity) || !validIdentity(raw.storageRootIdentity) || !validIdentity(raw.publicationRootIdentity)
    || !validIdentity(raw.ownedDirectoryIdentity) || (raw.state !== 'creating' && (!raw.gitAdminRealpath || !isAbsolute(raw.gitAdminRealpath) || !validIdentity(raw.gitAdminIdentity) || !validIdentity(raw.rootIdentity)))) throw Error('git_staging_ownership_corrupt');
  return raw;
}

export function createGitStagingHost(options: Readonly<{ storageRoot: string; gitExecutable?: string }>): Readonly<{
  inspectCleanRoot(publicationWorktreeRealpath: string): CleanRootInspection; factory: StagingFactory;
}> {
  if (process.platform !== 'win32') throw Error('git_staging_platform_unsupported');
  assertPlainText(options.storageRoot, 'git_staging_storage_invalid');
  mkdirSync(options.storageRoot, { recursive: true });
  const storageRoot = realpathSync.native(options.storageRoot);
  if (storageRoot !== options.storageRoot || !noReparse(storageRoot, false)) throw Error('git_staging_storage_untrusted');
  const storageRootIdentity = identity(storageRoot);
  const git = options.gitExecutable ? realpathSync.native(options.gitExecutable) : resolveSealedExecutable('git.exe', [storageRoot]);
  if (!lstatSync(git).isFile()) throw Error('git_staging_git_invalid');
  const nativeHelper = getChangeSnapshotHelperMetadata();
  if (!nativeHelper) throw Error('git_staging_native_helper_unavailable');
  const implementationBytes = readFileSync(fileURLToPath(import.meta.url));
  const factorySha256 = sha(Buffer.concat([Buffer.from(`${CONTRACT}\0${nativeHelper.protocol}\0${nativeHelper.helperSha256}\0`), implementationBytes, readFileSync(git)]));
  const env: NodeJS.ProcessEnv = {
    SystemRoot: process.env.SystemRoot, SYSTEMROOT: process.env.SYSTEMROOT,
    PATH: dirname(git), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: 'NUL',
    GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: 'NUL',
    GIT_ATTR_NOSYSTEM: '1',
  };
  const run = (cwd: string, args: readonly string[], allowOne = false): string => {
    const result = runProcessSync(git, ['--no-pager', ...args], { cwd, env, shell: false, windowsHide: true, encoding: 'utf8', timeout: TIMEOUT, maxBuffer: LIMIT });
    if (result.error || result.signal || (result.status !== 0 && !(allowOne && result.status === 1)) || Buffer.byteLength(result.stdout) > LIMIT || Buffer.byteLength(result.stderr) > LIMIT) throw Error('git_staging_git_failed');
    return result.stdout;
  };
  const listed = (publication: string): readonly string[] => run(publication, ['worktree', 'list', '--porcelain', '-z']).split('\0').filter(line => line.startsWith('worktree ')).map(line => line.slice(9));
  const locked = (publication: string, execution: string): boolean => run(publication, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/u).some(record => {
    const lines = record.split(/\r?\n/u);
    const path = lines.find(line => line.startsWith('worktree '))?.slice(9);
    return !!path && existsSync(path) && realpathSync.native(path) === execution && lines.some(line => line === 'locked' || line.startsWith('locked '));
  });
  const metadataAbsent = (publication: string, execution: string): boolean => !listed(publication).some(path => (existsSync(path) ? realpathSync.native(path) : resolve(path)).toLocaleLowerCase('en-US') === execution.toLocaleLowerCase('en-US'));
  const inheritedDigest=(items:readonly StagingInheritedPublication[])=>sha(JSON.stringify(items.map(item=>({relativePath:item.relativePath.toLocaleLowerCase('en-US'),maxBytes:item.maxBytes,publishedSha256:item.publishedSha256,originalSha256:sha(item.original)}))));
  const verifyInherited=(root:StagingRootObservation,items:readonly StagingInheritedPublication[]):void=>{
    if(!Array.isArray(items))throw Error('git_staging_inherited_invalid');
    const seen=new Set<string>();
    for(const item of items){
      if(!item||typeof item.relativePath!=='string'||!item.relativePath||isAbsolute(item.relativePath)||item.relativePath.split(/[\\/]/u).some((part:string)=>!part||part==='.'||part==='..')
        ||!Number.isSafeInteger(item.maxBytes)||item.maxBytes<1||item.maxBytes>16*1024*1024||!Buffer.isBuffer(item.bytes)||!Buffer.isBuffer(item.original)
        ||item.bytes.length>item.maxBytes||item.original.length>item.maxBytes||sha(item.bytes)!==item.publishedSha256)throw Error('git_staging_inherited_invalid');
      const key=item.relativePath.toLocaleLowerCase('en-US');if(seen.has(key))throw Error('git_staging_inherited_invalid');seen.add(key);
      const snapshot=snapshotRelativeNative({root:root.worktreeRealpath,expectedRoot:root.rootIdentity,targets:[item.relativePath],maxBytes:item.maxBytes});
      const file=snapshot.state==='ok'?snapshot.results[0]:undefined;
      if(file?.state!=='ok'||file.sha256!==item.publishedSha256||file.byteLength!==item.bytes.length)throw Error('git_staging_inherited_content_changed');
    }
  };

  const inspectCleanRoot = (input: string): CleanRootInspection => {
    assertPlainText(input, 'git_staging_publication_invalid');
    if (!isAbsolute(input) || !existsSync(input) || realpathSync.native(input) !== input) throw Error('git_staging_publication_not_exact');
    const beforeIdentity = identity(input);
    const top = run(input, ['rev-parse', '--show-toplevel']).trim();
    if (realpathSync.native(top) !== input) throw Error('git_staging_publication_not_toplevel');
    const common = realpathSync.native(run(input, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
    if (contains(input, storageRoot) || contains(storageRoot, input) || contains(common, storageRoot) || contains(storageRoot, common)) throw Error('git_staging_storage_overlap');
    if (run(input, ['config', '--local', '--null', '--get-regexp', unsafeConfig], true)) throw Error('git_staging_unsafe_local_config');
    if (run(input, ['ls-files', '-z', '--', '.gitattributes', ':(glob)**/.gitattributes'])) throw Error('git_staging_attributes_unsupported');
    if (run(input, ['ls-files', '-s']).split(/\r?\n/u).some(line => line.startsWith('160000 '))) throw Error('git_staging_submodules_unsupported');
    const status = run(input, ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all', '--ignored=matching', '--ignore-submodules=none']);
    const entries = status.split('\0').filter(Boolean), trackedModified: string[] = [], staged: string[] = [], untracked: string[] = [], conflicted: string[] = [];
    let branchHead = '', branchOid = '';
    for (const entry of entries) {
      if (entry.startsWith('# branch.head ')) branchHead = entry.slice(14);
      else if (entry.startsWith('# branch.oid ')) branchOid = entry.slice(13);
      else if (entry.startsWith('? ') || entry.startsWith('! ')) untracked.push(entry.slice(2));
      else if (entry.startsWith('u ')) conflicted.push(entry.slice(entry.lastIndexOf(' ') + 1));
      else if (entry.startsWith('1 ') || entry.startsWith('2 ')) {
        const xy = entry.slice(2, 4), path = entry.slice(entry.lastIndexOf(' ') + 1);
        if (xy[0] !== '.') staged.push(path);
        if (xy[1] !== '.') trackedModified.push(path);
      }
    }
    const unborn = branchOid === '(initial)', detached = branchHead === '(detached)' || !branchHead;
    const baseCommitId = unborn ? '' : run(input, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
    const afterIdentity = identity(input);
    if (!sameIdentity(beforeIdentity, afterIdentity) || (!unborn && baseCommitId !== branchOid)) throw Error('git_staging_publication_changed');
    return Object.freeze({ worktreeRealpath: input, rootIdentity: beforeIdentity, baseCommitId, trackedModified: Object.freeze(trackedModified), staged: Object.freeze(staged), untracked: Object.freeze(untracked), conflicted: Object.freeze(conflicted), detached, unborn, reparseFree: noReparse(input, true) });
  };

  const factory: StagingFactory = Object.freeze({
    protocol: ATTEMPT_STAGING_FACTORY_PROTOCOL,
    sha256: factorySha256,
    inspectPublicationSeeds(root:StagingRootObservation,items:readonly StagingInheritedPublication[]) { verifyInherited(root,items); },
    readPublicationSeed(root:StagingRootObservation,relativePath:string,maxBytes:number,publishedSha256:string,byteLength:number):Buffer {
      if(typeof relativePath!=='string'||!relativePath||isAbsolute(relativePath)||relativePath.split(/[\\/]/u).some((part:string)=>!part||part==='.'||part==='..')
        ||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16*1024*1024||!Number.isSafeInteger(byteLength)||byteLength<0||byteLength>maxBytes
        ||!/^[a-f0-9]{64}$/u.test(publishedSha256)||!noReparse(root.worktreeRealpath,true))throw Error('git_staging_inherited_invalid');
      const path=resolve(root.worktreeRealpath,relativePath);
      if(!contains(root.worktreeRealpath,path)||realpathSync.native(root.worktreeRealpath)!==root.worktreeRealpath||!sameIdentity(identity(root.worktreeRealpath),root.rootIdentity))throw Error('git_staging_inherited_root_changed');
      const before=snapshotRelativeNative({root:root.worktreeRealpath,expectedRoot:root.rootIdentity,targets:[relativePath],maxBytes});
      const first=before.state==='ok'?before.results[0]:undefined;
      if(first?.state!=='ok'||!first.identity||first.sha256!==publishedSha256||first.byteLength!==byteLength)throw Error('git_staging_inherited_content_changed');
      const bounded=Buffer.alloc(byteLength+1);let count=0;const fd=openSync(path,'r');
      try {while(count<bounded.length){const n=readSync(fd,bounded,count,bounded.length-count,null);if(n===0)break;count+=n;}} finally {closeSync(fd);}
      const bytes=bounded.subarray(0,count);
      const after=snapshotRelativeNative({root:root.worktreeRealpath,expectedRoot:root.rootIdentity,targets:[relativePath],maxBytes});
      const second=after.state==='ok'?after.results[0]:undefined;
      if(bytes.length!==byteLength||sha(bytes)!==publishedSha256||second?.state!=='ok'||!second.identity||second.sha256!==publishedSha256
        ||second.byteLength!==byteLength||!sameIdentity(first.identity,second.identity))throw Error('git_staging_inherited_content_changed');
      return bytes;
    },
    create(input: Parameters<StagingFactory['create']>[0]): StagingRootObservation {
      assertPlainText(input.attemptId, 'git_staging_attempt_invalid');
      const inherited=input.inherited??[];verifyInherited({worktreeRealpath:input.publicationWorktreeRealpath,rootIdentity:identity(input.publicationWorktreeRealpath),reparseFree:true},inherited);
      const seedSha=inherited.length?inheritedDigest(inherited):undefined;
      const attemptDigest = sha(input.attemptId), owned = join(storageRoot, attemptDigest), execution = join(owned, 'worktree'), recordPath = join(owned, 'ownership.json');
      if (existsSync(owned)) {
        const record = readRecord(recordPath);
        if (record.attemptDigest !== attemptDigest || record.publicationWorktreeRealpath !== input.publicationWorktreeRealpath
          || record.baseCommitId !== input.baseCommitId || record.cleanSnapshotSha256 !== input.cleanSnapshotSha256 || record.executionWorktreeRealpath !== execution || record.inheritedSha256!==seedSha) throw Error('git_staging_create_unresolved');
        if (record.state !== 'active' || !record.rootIdentity) throw Error('git_staging_create_unresolved');
        return factory.inspectRoot({ worktreeRealpath: execution, rootIdentity: record.rootIdentity, reparseFree: true });
      }
      mkdirSync(owned);
      const publicationRootIdentity = identity(input.publicationWorktreeRealpath), publicationGitCommonRealpath = realpathSync.native(run(input.publicationWorktreeRealpath, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()), publicationGitCommonIdentity = identity(publicationGitCommonRealpath);
      const ownedDirectoryIdentity = identity(owned);
      const creating: Ownership = { schemaVersion: CONTRACT, attemptDigest, state: 'creating', publicationWorktreeRealpath: input.publicationWorktreeRealpath, publicationGitCommonRealpath, publicationGitCommonIdentity, baseCommitId: input.baseCommitId, cleanSnapshotSha256: input.cleanSnapshotSha256, executionWorktreeRealpath: execution, storageRootIdentity, publicationRootIdentity, ownedDirectoryIdentity,...(seedSha?{inheritedSha256:seedSha}:{}) };
      atomicRecord(recordPath, creating);
      run(input.publicationWorktreeRealpath, ['worktree', 'add', '--detach', '--lock', '--reason', `cue:${attemptDigest}`, '--', execution, input.baseCommitId]);
      const rootIdentity = identity(execution), gitAdminRealpath = realpathSync.native(run(execution, ['rev-parse', '--absolute-git-dir']).trim()), gitAdminIdentity = identity(gitAdminRealpath);
      for(const seed of inherited){
        const base=snapshotRelativeNative({root:execution,expectedRoot:rootIdentity,targets:[seed.relativePath],maxBytes:seed.maxBytes});
        const file=base.state==='ok'?base.results[0]:undefined;
        if(file?.state!=='ok'||!file.identity||file.sha256!==sha(seed.original)||file.byteLength!==seed.original.length)throw Error('git_staging_inherited_base_changed');
        const written=compareWriteExistingNative({root:execution,expectedRoot:rootIdentity,target:seed.relativePath,expected:{identity:file.identity,byteLength:file.byteLength!,sha256:file.sha256!},replacement:seed.bytes,maxBytes:seed.maxBytes});
        if(written.state!=='committed')throw Error('git_staging_inherited_seed_failed');
      }
      atomicRecord(recordPath, { ...creating, state: 'active', rootIdentity, gitAdminRealpath, gitAdminIdentity });
      const observation = factory.inspectRoot({ worktreeRealpath: execution, rootIdentity, reparseFree: true });
      return observation;
    },
    inspectRoot(input: Parameters<StagingFactory['inspectRoot']>[0]): StagingRootObservation {
      const execution = realpathSync.native(input.worktreeRealpath);
      if (execution !== input.worktreeRealpath || !noReparse(execution, true)) throw Error('git_staging_execution_untrusted');
      const rootIdentity = identity(execution);
      if (!sameIdentity(rootIdentity, input.rootIdentity)) throw Error('git_staging_execution_identity_changed');
      const record = readRecord(join(dirname(execution), 'ownership.json'));
      if ((record.state !== 'active' && record.state !== 'creating') || record.executionWorktreeRealpath !== execution || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(record.baseCommitId)
        || run(execution, ['rev-parse', '--verify', 'HEAD^{commit}']).trim() !== record.baseCommitId) throw Error('git_staging_execution_binding_changed');
      if (!sameIdentity(identity(storageRoot), record.storageRootIdentity) || !sameIdentity(identity(dirname(execution)), record.ownedDirectoryIdentity) || !sameIdentity(identity(record.publicationWorktreeRealpath), record.publicationRootIdentity)) throw Error('git_staging_owner_identity_changed');
      if (!noReparse(record.publicationGitCommonRealpath, false) || realpathSync.native(run(record.publicationWorktreeRealpath, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()) !== record.publicationGitCommonRealpath || !sameIdentity(identity(record.publicationGitCommonRealpath), record.publicationGitCommonIdentity)) throw Error('git_staging_common_identity_changed');
      if (record.state === 'active' && (!record.gitAdminRealpath || !record.gitAdminIdentity || !noReparse(record.gitAdminRealpath, false)
        || realpathSync.native(run(execution, ['rev-parse', '--absolute-git-dir']).trim()) !== record.gitAdminRealpath || !sameIdentity(identity(record.gitAdminRealpath), record.gitAdminIdentity))) throw Error('git_staging_metadata_identity_changed');
      return Object.freeze({ worktreeRealpath: execution, rootIdentity, reparseFree: true });
    },
    reconcilePublished(input: StagingRootObservation, targets: readonly Readonly<{ relativePath: string; maxBytes: number; publishedSha256: string; original: Buffer }>[], inherited:readonly StagingInheritedPublication[]=[]): void {
      factory.inspectRoot(input);
      if (!Array.isArray(targets) || targets.length === 0) throw Error('git_staging_reconcile_targets_invalid');
      const record = readRecord(join(dirname(input.worktreeRealpath), 'ownership.json'));
      if(record.inheritedSha256!==(inherited.length?inheritedDigest(inherited):undefined))throw Error('git_staging_inherited_binding_changed');
      const expected = new Map<string, typeof targets[number]>();
      targets=[...targets,...inherited.map(seed=>({relativePath:seed.relativePath,maxBytes:seed.maxBytes,publishedSha256:seed.publishedSha256,original:seed.original}))];
      for (const target of targets) {
        if (!target || typeof target.relativePath !== 'string' || !target.relativePath || isAbsolute(target.relativePath) || resolve(target.relativePath) === target.relativePath
          || target.relativePath.split(/[\\/]/u).some((part: string) => !part || part === '.' || part === '..') || !Number.isSafeInteger(target.maxBytes) || target.maxBytes < 1 || target.maxBytes > 16 * 1024 * 1024
          || !/^[a-f0-9]{64}$/u.test(target.publishedSha256) || !Buffer.isBuffer(target.original) || target.original.length > target.maxBytes) throw Error('git_staging_reconcile_targets_invalid');
        const key = target.relativePath.toLocaleLowerCase('en-US'); if (expected.has(key)) throw Error('git_staging_reconcile_targets_invalid'); expected.set(key, target);
      }
      const entries = run(input.worktreeRealpath, ['status', '--porcelain=v2', '-z', '--untracked-files=all', '--ignored=matching', '--ignore-submodules=none']).split('\0').filter(Boolean);
      const dirty = new Map<string, string>();
      for (const entry of entries) {
        if (!entry.startsWith('1 .M N... ')) throw Error('git_staging_reconcile_diverged');
        const path = entry.split(' ').slice(8).join(' '), key = path.toLocaleLowerCase('en-US');
        if (!path || dirty.has(key)) throw Error('git_staging_reconcile_diverged'); dirty.set(key, path);
      }
      if ([...dirty.keys()].some(key => !expected.has(key))) throw Error('git_staging_reconcile_diverged');
      const restorations: { target: typeof targets[number]; expected: {identity:StagingRootIdentity;byteLength:number;sha256:string}; base: Buffer }[] = [];
      for (const [key, target] of expected) {
        const path = dirty.get(key) ?? target.relativePath;
        const execution = snapshotRelativeNative({root:input.worktreeRealpath,expectedRoot:input.rootIdentity,targets:[path],maxBytes:target.maxBytes});
        const publication = snapshotRelativeNative({root:record.publicationWorktreeRealpath,expectedRoot:record.publicationRootIdentity,targets:[path],maxBytes:target.maxBytes});
        const executionFile=execution.state==='ok'?execution.results[0]:undefined, publicationFile=publication.state==='ok'?publication.results[0]:undefined;
        if (executionFile?.state!=='ok'||publicationFile?.state!=='ok'||executionFile.sha256!==target.publishedSha256||publicationFile.sha256!==target.publishedSha256||executionFile.byteLength!==publicationFile.byteLength) throw Error('git_staging_reconcile_content_changed');
        const base=Buffer.from(target.original);
        const expectedReceipt={identity:executionFile.identity,byteLength:executionFile.byteLength,sha256:executionFile.sha256};
        if(!expectedReceipt.identity||expectedReceipt.byteLength===undefined||expectedReceipt.sha256===undefined)throw Error('git_staging_reconcile_content_changed');
        if (dirty.has(key)) restorations.push({target,expected:expectedReceipt as {identity:StagingRootIdentity;byteLength:number;sha256:string},base});
      }
      for (const restoration of restorations) {
        const result=compareWriteExistingNative({root:input.worktreeRealpath,expectedRoot:input.rootIdentity,target:restoration.target.relativePath,expected:restoration.expected,replacement:restoration.base,maxBytes:restoration.target.maxBytes});
        if(result.state!=='committed')throw Error('git_staging_reconcile_contention');
      }
      if (run(input.worktreeRealpath, ['status', '--porcelain=v2', '-z', '--untracked-files=all', '--ignored=matching', '--ignore-submodules=none'])) throw Error('git_staging_reconcile_incomplete');
      factory.inspectRoot(input);
    },
    cleanup(input: Parameters<StagingFactory['cleanup']>[0]) {
      const recordPath = join(dirname(input.worktreeRealpath), 'ownership.json'), record = readRecord(recordPath);
      if (record.state !== 'active' || record.executionWorktreeRealpath !== input.worktreeRealpath || !record.rootIdentity || !sameIdentity(record.rootIdentity, input.rootIdentity)) throw Error('git_staging_cleanup_binding');
      factory.inspectRoot(input);
      run(record.publicationWorktreeRealpath, ['worktree', 'unlock', '--', input.worktreeRealpath]);
      try { run(record.publicationWorktreeRealpath, ['worktree', 'remove', '--', input.worktreeRealpath]); }
      catch (error) {
        try { run(record.publicationWorktreeRealpath, ['worktree', 'lock', '--reason', `cue:${record.attemptDigest}`, '--', input.worktreeRealpath]); }
        catch { throw Error('git_staging_relock_unverified'); }
        if (!locked(record.publicationWorktreeRealpath, input.worktreeRealpath)) throw Error('git_staging_relock_unverified');
        throw error;
      }
      const proof = factory.inspectCleanup(input);
      if (proof.rootAbsent && proof.metadataAbsent) atomicRecord(recordPath, { ...record, state: 'cleaned' });
      return proof;
    },
    inspectCleanup(input: Parameters<StagingFactory['inspectCleanup']>[0]) {
      const record = readRecord(join(dirname(input.worktreeRealpath), 'ownership.json'));
      if (record.executionWorktreeRealpath !== input.worktreeRealpath || !record.rootIdentity || !sameIdentity(record.rootIdentity, input.rootIdentity)) throw Error('git_staging_cleanup_binding');
      if (!noReparse(storageRoot, false) || !noReparse(dirname(input.worktreeRealpath), false) || !noReparse(record.publicationWorktreeRealpath, false)
        || !sameIdentity(identity(storageRoot), record.storageRootIdentity) || !sameIdentity(identity(dirname(input.worktreeRealpath)), record.ownedDirectoryIdentity)
        || !sameIdentity(identity(record.publicationWorktreeRealpath), record.publicationRootIdentity) || !noReparse(record.publicationGitCommonRealpath, false)
        || realpathSync.native(run(record.publicationWorktreeRealpath, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()) !== record.publicationGitCommonRealpath
        || !sameIdentity(identity(record.publicationGitCommonRealpath), record.publicationGitCommonIdentity)) throw Error('git_staging_cleanup_owner_changed');
      const rootAbsent = !existsSync(input.worktreeRealpath), metadataIsAbsent = !!record.gitAdminRealpath && !existsSync(record.gitAdminRealpath) && metadataAbsent(record.publicationWorktreeRealpath, input.worktreeRealpath);
      const evidenceSha256 = sha(JSON.stringify({ schemaVersion: 'cue-git-staging-cleanup-evidence-v1', attemptDigest: record.attemptDigest, executionWorktreeRealpath: input.worktreeRealpath, rootIdentity: input.rootIdentity, rootAbsent, metadataAbsent: metadataIsAbsent }));
      return Object.freeze({ rootAbsent, metadataAbsent: metadataIsAbsent, evidenceSha256, ...(!rootAbsent || !metadataIsAbsent ? { reason: 'git_staging_cleanup_incomplete' } : {}) });
    },
  });
  return Object.freeze({ inspectCleanRoot, factory });
}
