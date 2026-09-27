import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createModelMeasurementSubject,MODEL_SUBJECT_REQUIRED_PATHS} from '../src/model-measurement-subject.js';
import {createCapabilityAdmission} from '../src/capability-admission.js';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'Cue.SubjectFixture.'));
 const put=(p:string,text='fixture bytes')=>{mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),text)};
 for(const path of MODEL_SUBJECT_REQUIRED_PATHS)put(path);
 for(const path of MODEL_SUBJECT_REQUIRED_PATHS.filter(p=>p.startsWith('daemon/src/'))){const rel=path.slice(11);put('daemon/dist/src/'+rel.replace(/\.ts$/,'.js'));}
 put('daemon/migrations/001_init.sql');put('daemon/dist/migrations/001_init.sql');
 put('deps/better-sqlite3/package.json','{"name":"better-sqlite3","version":"13.0.3"}');
 put('deps/better-sqlite3/lib/index.js');put('deps/better-sqlite3/build/Release/better_sqlite3.node');
 const input={installRoot:root,kind:'model' as const,nodeExecutable:process.execPath,powershellExecutable:join(process.env.SystemRoot!,'System32/WindowsPowerShell/v1.0/powershell.exe'),sqliteNativePath:join(root,'deps/better-sqlite3/build/Release/better_sqlite3.node'),dependencyRoot:join(root,'deps')};
 return{root,put,input,close:()=>rmSync(root,{recursive:true,force:true})};
}
describe.skipIf(process.platform!=='win32')('factory-owned model measurement closure (fixture files, no eligibility)',()=>{
 it('requires planning authorities and rejects evidence bound to an earlier planning subject',()=>{
  const f=fixture();try{
   const planning=['app/protected-installation.mjs','app/default-goal-planning-bootstrap.mjs','app/goal-proposal.mjs','app/goal-planning-contract.mjs','app/goal-planning-handoff-authority.mjs','app/goal-planning-host.mjs','app/accepted-goal-planning-output.mjs','daemon/src/selection/local-host-settings.ts','daemon/src/goal-proposal-checker-client.cjs','daemon/src/verification/goal-proposal-checker.cjs','daemon/src/adapters/isolated-goal-proposal-checker.ts','daemon/src/verification/goal-proposal-acceptance-host.ts'];
   for(const path of planning)expect(MODEL_SUBJECT_REQUIRED_PATHS).toContain(path);
   const before=createModelMeasurementSubject(f.input);
   const bytes=Buffer.from(JSON.stringify({probe:'M1',subjectDigest:before.subjectDigest,measuredAt:'2026-09-19T00:00:00.000Z',kind:'live',status:'pass'}));
   const reference={id:'prior-M1',sha256:createHash('sha256').update(bytes).digest('hex')};
   for(const path of planning){
    appendFileSync(join(f.root,path),' changed');const after=createModelMeasurementSubject(f.input);
    expect(after.subjectDigest,path).not.toBe(before.subjectDigest);
    const admit=createCapabilityAdmission({resolveEvidence:()=>bytes,now:()=>Date.parse('2026-09-19T00:00:01.000Z'),maxAgeMs:60_000});
    expect(admit(after.subject,{M1:reference}).reasons,path).toContainEqual({probe:'M1',code:'subject-drift'});
    rmSync(join(f.root,path));expect(()=>createModelMeasurementSubject(f.input),path).toThrow();f.put(path);
   }
  }finally{f.close()}
 },30000);
 it('measures goal proposal checker as its own client kind without issuing eligibility',()=>{
  const f=fixture();try{
   const model=createModelMeasurementSubject(f.input),checker=createModelMeasurementSubject({...f.input,kind:'goal-proposal-checker'});
   expect(checker.subject.boundaryProviderId).toBe('windows-appcontainer-client/goal-proposal-checker');
   expect(checker.subject.boundaryContractVersion).toBe('cue-model-subject-files-v2/goal-proposal-checker');
   expect(checker.subjectDigest).not.toBe(model.subjectDigest);
   expect(checker.manifest.artifacts.map(a=>a.id)).toContain('probe/integration-goal-proposal-checker-client.test.ts');
   expect(checker.limitations).toContain('no-eligibility-issued');
   rmSync(join(f.root,'daemon/src/verification/goal-proposal-checker.cjs'));
   expect(()=>createModelMeasurementSubject({...f.input,kind:'goal-proposal-checker'})).toThrow();
  }finally{f.close()}
 },15000);
 it('v2 binds fixed qualification source/collector/tests and refuses any missing required component',()=>{
  const f=fixture();try{
   const baseline=createModelMeasurementSubject(f.input);expect(baseline.manifest.version).toBe('cue-model-subject-files-v2');
   for(const path of ['daemon/src/model-boundary-probe.cjs','daemon/src/model-qualification.ts','daemon/test/integration-fixed-model-qualification.test.ts','daemon/test/integration-model-qualification.test.ts']){
    appendFileSync(join(f.root,path),' changed');const changed=createModelMeasurementSubject(f.input);
    expect(changed.subject.probeSuiteSha256,path).not.toBe(baseline.subject.probeSuiteSha256);
    if(path.startsWith('daemon/src/'))expect(changed.subject.enforcementSha256,path).not.toBe(baseline.subject.enforcementSha256);
    rmSync(join(f.root,path));expect(()=>createModelMeasurementSubject(f.input),path).toThrow();f.put(path);
   }
   for(const path of ['daemon/dist/src/model-boundary-probe.cjs','daemon/dist/src/model-qualification.js']){
    rmSync(join(f.root,path));expect(()=>createModelMeasurementSubject(f.input)).toThrow('subject_compiled_missing');f.put(path);
   }
  }finally{f.close()}
 },15000);
 it('measures actual OS/host binaries and separates kinds, captures added host/compiled/dependency bytes',()=>{
  const f=fixture();try{
   const initial=createModelMeasurementSubject(f.input),checker=createModelMeasurementSubject({...f.input,kind:'json-checker'});
   expect(initial.subjectDigest).not.toBe(checker.subjectDigest);expect(initial.subject.probeSuiteSha256).not.toBe(checker.subject.probeSuiteSha256);
   expect(JSON.parse(initial.subject.osBuild)).toMatchObject({platform:'win32',arch:process.arch,buildRevision:expect.stringMatching(/^\d+\.\d+$/)});
   expect(initial.limitations).toContain('no-eligibility-issued');expect(Object.isFrozen(initial.manifest.artifacts)).toBe(true);
   for(const [path,text] of [['app/default-host.mjs','new host'],['daemon/dist/src/new-runtime.js','new compiled module'],['deps/better-sqlite3/lib/extra.js','extra loader module']]){
    f.put(path!,text);const changed=createModelMeasurementSubject(f.input);expect(changed.subject.runtimeArtifactSha256).not.toBe(initial.subject.runtimeArtifactSha256);
    rmSync(join(f.root,path!));expect(createModelMeasurementSubject(f.input).subjectDigest).toBe(initial.subjectDigest);
   }
   appendFileSync(join(f.root,'deps/better-sqlite3/build/Release/better_sqlite3.node'),'changed');expect(createModelMeasurementSubject(f.input).subjectDigest).not.toBe(initial.subjectDigest);
  }finally{f.close()}
 },30000);
 it('requires compiled/source/app/policy/probe/package closure and rejects out-root native dependency',()=>{
  const f=fixture();try{
   f.put('deps/better-sqlite3/package.json','{"name":"better-sqlite3","version":"13.0.3","dependencies":{"unexpected-loader":"1"}}');
   expect(()=>createModelMeasurementSubject(f.input)).toThrow('subject_dependency_closure_unsupported');
   f.put('deps/better-sqlite3/package.json','{"name":"better-sqlite3","version":"13.0.3","dependencies":{"node-addon-api":"^8.0.0"}}');
   expect(createModelMeasurementSubject(f.input).limitations).toContain('native-build-toolchain-not-runtime-pinned');
   for(const path of ['daemon/dist/src/process-launch.js','app/core.mjs','docs/P13_SPEC.md','daemon/test/integration-model-boundary-qualification.test.ts','deps/better-sqlite3/lib/index.js']){
    rmSync(join(f.root,path));expect(()=>createModelMeasurementSubject(f.input)).toThrow();f.put(path);
   }
   expect(()=>createModelMeasurementSubject({...f.input,sqliteNativePath:process.execPath})).toThrow('subject_path_outside');
   f.put('daemon/src/new-source.ts');expect(()=>createModelMeasurementSubject(f.input)).toThrow('subject_compiled_missing');
  }finally{f.close()}
 });
 it('refuses junction/symlink inventory escape and input accessor without invoking it',()=>{
  const f=fixture();try{
   const alias=join(f.root,'daemon/dist/src/escape');symlinkSync(dirname(f.root),alias,'junction');
   expect(()=>createModelMeasurementSubject(f.input)).toThrow('subject_path_reparse_or_type');rmSync(alias);
   let calls=0;const hostile={...f.input};Object.defineProperty(hostile,'installRoot',{get(){calls++;throw Error('getter')}});
   expect(()=>createModelMeasurementSubject(hostile)).toThrow('subject_input_invalid');expect(calls).toBe(0);
  }finally{f.close()}
 });
});
