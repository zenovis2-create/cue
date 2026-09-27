import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';
import { openLedger } from '../src/ledger.js';
import { spawnOwned } from '../src/process-launch.js';
import { observeOwnedNativeProcess, verifyStableOwnedNativeObservation } from '../src/host-runtime-native-identity.js';
import { terminateVerifiedTree } from '../src/process-termination.js';
const roots:string[]=[];afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
test.skipIf(process.platform!=='win32')('captures exact FILETIME only for a process in the owned launch tree',()=>{
 const root=mkdtempSync(join(tmpdir(),'cue-host-native-identity-'));roots.push(root);const db=openLedger(),now=new Date().toISOString();db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task','running',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope',root,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('attempt','task','envelope',1,now);
 const launched=spawnOwned(db,{cwd:root,task_id:'task',run_id:'attempt'},process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});try{const identity=observeOwnedNativeProcess(launched.child.pid!,launched.child.pid!);expect(identity).toEqual({pid:launched.child.pid,createdFileTime:expect.stringMatching(/^[1-9]\d{10,19}$/u)});expect(()=>observeOwnedNativeProcess(launched.child.pid!,process.pid)).toThrow('foreign');}finally{terminateVerifiedTree(launched.child.pid!);db.close();}
});
test('refuses a target whose native FILETIME changes across ownership observation',()=>{const root={pid:10,createdFileTime:'100'},before={pid:20,createdFileTime:'200'},after={pid:20,createdFileTime:'201'};expect(()=>verifyStableOwnedNativeObservation({rootBefore:root,targetBefore:before,treePids:[10,20],rootAfter:root,targetAfter:after})).toThrow('foreign');});
