import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,test} from 'vitest';
import {createGitStagingHost} from '../src/orchestration/git-staging-factory.js';

const roots:string[]=[];
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const git=(cwd:string,...args:string[])=>execFileSync('git.exe',args,{cwd,encoding:'utf8',windowsHide:true,shell:false});
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

test.runIf(process.platform==='win32')('detached second writer inherits only exact owned publication and restores both paths before cleanup',()=>{
  const root=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-git-inherited-')));roots.push(root);
  const publication=join(root,'publication'),storage=join(root,'storage');mkdirSync(publication);mkdirSync(storage);
  git(publication,'init');git(publication,'config','user.name','Cue Fixture');git(publication,'config','user.email','cue@example.invalid');
  writeFileSync(join(publication,'first.txt'),'first-base\n');writeFileSync(join(publication,'second.txt'),'second-base\n');
  git(publication,'add','first.txt','second.txt');git(publication,'commit','-m','base');
  const host=createGitStagingHost({storageRoot:realpathSync.native(storage)}),clean=host.inspectCleanRoot(realpathSync.native(publication));
  const first=Buffer.from('first-owned\n'),firstBase=Buffer.from('first-base\n'),second=Buffer.from('second-owned\n'),secondBase=Buffer.from('second-base\n');
  writeFileSync(join(publication,'first.txt'),first);
  const inherited=[{relativePath:'first.txt',maxBytes:1024,publishedSha256:sha(first),bytes:first,original:firstBase}];
  const publicationRoot={worktreeRealpath:realpathSync.native(publication),rootIdentity:clean.rootIdentity,reparseFree:true};
  host.factory.inspectPublicationSeeds!(publicationRoot,inherited);
  const input={attemptId:'second-writer',publicationWorktreeRealpath:realpathSync.native(publication),baseCommitId:clean.baseCommitId,cleanSnapshotSha256:'a'.repeat(64),inherited};
  const secondRoot=host.factory.create(input);
  expect(readFileSync(join(secondRoot.worktreeRealpath,'first.txt'))).toEqual(first);
  expect(readFileSync(join(secondRoot.worktreeRealpath,'second.txt'))).toEqual(secondBase);
  expect(host.factory.create(input)).toEqual(secondRoot);
  writeFileSync(join(secondRoot.worktreeRealpath,'second.txt'),second);writeFileSync(join(publication,'second.txt'),second);
  host.factory.reconcilePublished!(secondRoot,[{relativePath:'second.txt',maxBytes:1024,publishedSha256:sha(second),original:secondBase}],inherited);
  expect(git(secondRoot.worktreeRealpath,'status','--porcelain')).toBe('');
  expect(host.factory.cleanup(secondRoot)).toMatchObject({rootAbsent:true,metadataAbsent:true});
  writeFileSync(join(publication,'first.txt'),'unowned drift\n');
  expect(()=>host.factory.inspectPublicationSeeds!(publicationRoot,inherited)).toThrow('git_staging_inherited_content_changed');
});
