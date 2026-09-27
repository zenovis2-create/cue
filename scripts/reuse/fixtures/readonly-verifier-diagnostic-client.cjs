'use strict';

const nodeFs=require('node:fs'),nodePath=require('node:path'),nodeNet=require('node:net');
const STAGES=new Set(['evaluation','setup','port','socket','callback','result-write']);
const DIAGNOSTIC_WRITTEN_EXIT=71,DIAGNOSTIC_WRITE_FAILED_EXIT=72;

function parseInvocation(argv){
  if(argv.length!==3||argv[1]!=='48193'||!/^[0-9a-f]{64}$/.test(argv[2]))throw Object.assign(new Error('probe_invocation_contract'),{code:'EINVOCATION'});
  return {port:48193,nonce:argv[2]};
}
function expectedDenied(value){return value==='denied:EACCES'||value==='denied:EPERM';}
function boundedField(value,fallback){return typeof value==='string'&&/^[A-Za-z0-9_.-]{1,64}$/.test(value)?value:fallback;}

function createDiagnosticProbe(overrides={}){
  const fs=overrides.fs??nodeFs,path=overrides.path??nodePath,net=overrides.net??nodeNet;
  const cwd=overrides.cwd??(()=>process.cwd()),env=overrides.env??process.env,argv=overrides.argv??process.argv;
  const schedule=overrides.schedule??((fn)=>setTimeout(fn,2000).unref());
  const setExit=overrides.setExit??(value=>{process.exitCode=value;});
  const processControl=overrides.processControl??process;
  let recorded=false,runtime=null,nonce=null,stage='evaluation',handlersInstalled=false;
  const onUncaught=error=>record(error),onRejection=reason=>record(reason);
  function removeHandlers(){if(!handlersInstalled)return;handlersInstalled=false;processControl.removeListener('uncaughtException',onUncaught);processControl.removeListener('unhandledRejection',onRejection);}
  function installHandlers(){if(handlersInstalled)return;handlersInstalled=true;processControl.on('uncaughtException',onUncaught);processControl.on('unhandledRejection',onRejection);}
  function record(error){
    if(recorded)return false;recorded=true;
    try{
      if(typeof runtime!=='string'||!/^[0-9a-f]{64}$/.test(nonce))throw Object.assign(new Error('diagnostic_context_unavailable'),{code:'ECONTEXT'});
      const record={version:'cue-readonly-probe-diagnostic-v1',stage:STAGES.has(stage)?stage:'evaluation',nonce,name:boundedField(error?.name,'Error'),code:boundedField(error?.code,'EUNKNOWN')};
      fs.writeFileSync(path.join(runtime,'diagnostic.json'),JSON.stringify(record),{flag:'wx'});setExit(DIAGNOSTIC_WRITTEN_EXIT);
    }catch{setExit(DIAGNOSTIC_WRITE_FAILED_EXIT);}finally{removeHandlers();}
    return true;
  }
  function execute(permissionBody=runPermissionBody){
    installHandlers();
    try{
      nonce=typeof argv[2]==='string'&&/^[0-9a-f]{64}$/.test(argv[2])?argv[2]:null;
      stage='setup';runtime=env.TEMP;if(typeof runtime!=='string'||runtime.length===0)throw Object.assign(new Error('runtime_contract'),{code:'ERUNTIME'});
      stage='port';const invocation=parseInvocation(argv);nonce=invocation.nonce;
      stage='evaluation';
      permissionBody({fs,path,net,cwd,runtime,port:invocation.port,schedule,setStage:value=>{if(!STAGES.has(value))throw Object.assign(new Error('stage_contract'),{code:'ESTAGE'});stage=value;},record,isRecorded:()=>recorded,finish:removeHandlers});
    }catch(error){record(error);}
  }
  return {execute,record,get state(){return {recorded,runtime,nonce,stage};}};
}

function runPermissionBody({fs,path,net,cwd,runtime,port,schedule,setStage,record,isRecorded,finish}){
  setStage('setup');const project=cwd(),sibling=path.join(path.dirname(project),'sibling'),result={};
  function attempt(name,fn){try{fn();result[name]='allowed';}catch(error){result[name]=`denied:${error&&error.code||'unknown'}`;}}
  try{result.read=fs.readFileSync(path.join(project,'existing.txt'),'utf8');}catch(error){result.read=`failed:${error.code}`;}
  attempt('create',()=>fs.writeFileSync(path.join(project,'created.txt'),'x',{flag:'wx'}));
  attempt('overwrite',()=>fs.writeFileSync(path.join(project,'existing.txt'),'changed'));
  attempt('remove',()=>fs.unlinkSync(path.join(project,'delete-me.txt')));
  attempt('rename',()=>fs.renameSync(path.join(project,'rename-me.txt'),path.join(project,'renamed.txt')));
  attempt('chmod',()=>fs.chmodSync(path.join(project,'existing.txt'),0o777));
  attempt('sibling',()=>fs.readFileSync(path.join(sibling,'secret.txt')));
  attempt('siblingWrite',()=>fs.writeFileSync(path.join(sibling,'created.txt'),'x',{flag:'wx'}));
  attempt('runtime',()=>fs.writeFileSync(path.join(runtime,'writable.txt'),'ok',{flag:'wx'}));
  setStage('socket');const socket=net.connect({host:'127.0.0.1',port});let finished=false;
  const done=value=>{if(finished||isRecorded())return;finished=true;try{setStage('result-write');result.network=value;fs.writeFileSync(path.join(runtime,'result.json'),JSON.stringify(result),{flag:'wx'});socket.destroy();finish();}catch(error){record(error);}};
  socket.once('connect',()=>{try{setStage('callback');done('allowed');}catch(error){record(error);}});
  socket.once('error',error=>{try{setStage('callback');done(`denied:${error.code||'unknown'}`);}catch(caught){record(caught);}});
  schedule(()=>{try{setStage('callback');done('denied:timeout');}catch(error){record(error);}});
}

module.exports={createDiagnosticProbe,parseInvocation,expectedDenied,DIAGNOSTIC_WRITTEN_EXIT,DIAGNOSTIC_WRITE_FAILED_EXIT};
if(globalThis.CUE_READONLY_PROBE_EXECUTE===true)createDiagnosticProbe().execute();
