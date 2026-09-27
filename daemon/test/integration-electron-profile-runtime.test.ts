import { expect, test } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
test('actual Electron profile-only probe: no model, window or config',()=>{
 const owned=mkdtempSync(join(tmpdir(),'cue-profile-electron-'));
 try{
  const script=join(owned,'probe.mjs'),state=join(owned,'state'),helper=pathToFileURL(resolve('../app/electron-profile.mjs')).href;
  writeFileSync(script,"import {app} from 'electron';import {existsSync} from 'node:fs';import {bindElectronProfile} from "+JSON.stringify(helper)+";const binding=bindElectronProfile(app);app.whenReady().then(()=>{let denied=false;try{bindElectronProfile(app);}catch{denied=true;}console.log(JSON.stringify({electron:process.versions.electron,binding,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),denied,config:existsSync(binding.userData+'/cue-config.json')}));app.exit(denied?0:1);}).catch(()=>app.exit(1));");
  const env={...process.env};for(const key of Object.keys(env))if(['node_options','electron_run_as_node','cue_live_run','cue_user_data'].includes(key.toLowerCase()))delete env[key];env.CUE_USER_DATA=state;
  const executable=createRequire(new URL('../../package.json',import.meta.url))('electron') as string;
  const result=spawnSync(executable,[script],{env,encoding:'utf8',windowsHide:true,timeout:30000});
  expect(result.error).toBeUndefined();expect(result.status,result.stderr).toBe(0);
  const record=JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('{'))!);
  expect(record.electron).toMatch(/^\d+\.\d+/);expect(record.userData).toBe(state);expect(record.sessionData).toBe(join(state,'electron-session'));expect(record.config).toBe(false);expect(record.denied).toBe(true);
  console.log(JSON.stringify({kind:'actual-electron-profile-only',electron:record.electron,profileMatched:true,configCreated:record.config,lateRebindDenied:record.denied,modelCalls:0}));
 }finally{expect(dirname(resolve(owned))).toBe(resolve(tmpdir()));expect(basename(owned).startsWith('cue-profile-electron-')).toBe(true);rmSync(owned,{recursive:true,force:true});}
},40000);
