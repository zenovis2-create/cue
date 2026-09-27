import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {describe,expect,test} from 'vitest';
import {fixture} from './fixtures/git-staging-driver-fixture.js';

async function runChecked(f:ReturnType<typeof fixture>,name:string){
 await f.driver.start(f.run);
 const record={fixture:true,snapshot:f.driver.snapshot('workflow'),executionRoot:f.executionRoot,sawIsolatedMutation:f.sawIsolatedMutation,
  attempts:f.db.prepare('SELECT * FROM orchestration_attempt LIMIT 4').all(),cleanup:f.db.prepare('SELECT * FROM attempt_staging_cleanup LIMIT 4').all(),
  publication:f.db.prepare('SELECT * FROM change_publication_result LIMIT 4').all()};
 const receiptDirectory=process.env.CUE_GIT_STAGING_DRIVER_RECEIPTS;
 if(receiptDirectory) writeFileSync(resolve(receiptDirectory,name+'.json'),JSON.stringify(record,null,2),{flag:'wx'});
}

describe.runIf(process.platform==='win32')('public driver with trusted Git staging factory',()=>{
 test('publishes exact bytes from a distinct real execution worktree through the public flow',async()=>{const f=fixture('unchanged');expect(f.prepared.executionStaging?.publicationWorktreeRealpath).toBe(f.publication);expect(f.activated).toEqual({state:'running',started:true});await runChecked(f,'reconciled-pass1');expect(f.sawIsolatedMutation).toBe(true);expect(f.executionRoot).not.toBe(f.publication);expect(readFileSync(join(f.publication,'target.txt'),'utf8')).toBe('replacement\n');expect(existsSync(f.executionRoot)).toBe(false);expect(f.db.prepare('SELECT state FROM change_publication_result').get()).toEqual({state:'committed'});expect(f.db.prepare('SELECT count(*) n FROM change_publication_result').get()).toEqual({n:1});expect(f.db.prepare('SELECT result FROM attempt_staging_cleanup').get()).toEqual({result:'active_cleanup_verified'});expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({n:0});},60_000);
 test('holds the lease and receipt when execution diverges after staged bytes are read',async()=>{const f=fixture('diverge');await runChecked(f,'diverged-pass1');expect(f.sawIsolatedMutation).toBe(true);expect(readFileSync(join(f.publication,'target.txt'),'utf8')).toBe('replacement\n');expect(readFileSync(join(f.executionRoot,'target.txt'),'utf8')).toBe('diverged-after-read\n');expect(f.db.prepare('SELECT state FROM change_publication_result').get()).toEqual({state:'committed'});expect(f.db.prepare('SELECT count(*) n FROM change_publication_result').get()).toEqual({n:1});expect(f.db.prepare('SELECT result FROM attempt_staging_cleanup').get()).toEqual({result:'active_cleanup_unknown'});expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({n:1});expect(f.db.prepare('SELECT count(*) n FROM orchestration_receipt').get()).toEqual({n:0});expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'change_publication_unresolved'});},60_000);
});
