'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
function parseProbePort(argv){if(argv.length!==2||argv[1]!=='48193')throw new Error('probe_port_contract');return 48193;}
function expectedDenied(value){return value==='denied:EACCES'||value==='denied:EPERM';}
function runProbe(){
const cwd=process.cwd(),runtime=process.env.TEMP,sibling=path.join(path.dirname(cwd),'sibling'),result={};
function attempt(name,fn){try{fn();result[name]='allowed';}catch(error){result[name]=`denied:${error&&error.code||'unknown'}`;}}
try{result.read=fs.readFileSync(path.join(cwd,'existing.txt'),'utf8');}catch(error){result.read=`failed:${error.code}`;}
attempt('create',()=>fs.writeFileSync(path.join(cwd,'created.txt'),'x',{flag:'wx'}));
attempt('overwrite',()=>fs.writeFileSync(path.join(cwd,'existing.txt'),'changed'));
attempt('remove',()=>fs.unlinkSync(path.join(cwd,'delete-me.txt')));
attempt('rename',()=>fs.renameSync(path.join(cwd,'rename-me.txt'),path.join(cwd,'renamed.txt')));
attempt('chmod',()=>fs.chmodSync(path.join(cwd,'existing.txt'),0o777));
attempt('sibling',()=>fs.readFileSync(path.join(sibling,'secret.txt')));
attempt('siblingWrite',()=>fs.writeFileSync(path.join(sibling,'created.txt'),'x',{flag:'wx'}));
attempt('runtime',()=>fs.writeFileSync(path.join(runtime,'writable.txt'),'ok',{flag:'wx'}));
const socket=net.connect({host:'127.0.0.1',port:parseProbePort(process.argv)});
let finished=false;const done=value=>{if(finished)return;finished=true;result.network=value;fs.writeFileSync(path.join(runtime,'result.json'),JSON.stringify(result));socket.destroy();};
socket.once('connect',()=>done('allowed'));socket.once('error',error=>done(`denied:${error.code||'unknown'}`));setTimeout(()=>done('denied:timeout'),2000).unref();
}
module.exports={parseProbePort,expectedDenied};if(globalThis.CUE_READONLY_PROBE_EXECUTE===true)runProbe();
