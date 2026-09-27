'use strict';
// Fixed diagnostic only: no request-selected module, command, URL or JavaScript.
// Production executors refuse the qualification-pinned native status.
const fs=require('node:fs'), path=require('node:path'), net=require('node:net'), cp=require('node:child_process');
const PROTOCOL='cue-boundary-probe-v1';let bytes=Buffer.alloc(0),finished=false;
const finish=value=>{if(finished)return;finished=true;process.stdout.end(JSON.stringify(value)+'\n');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.sort().join(',');
const pause=()=>new Promise(done=>setTimeout(done,10));
async function execute(request){
 if(request.protocol!==PROTOCOL||!['filesystem-network','process-limit'].includes(request.operation))throw Error();
 if(request.operation==='process-limit'){
  if(!exact(request,['protocol','operation']))throw Error();
  const result=await new Promise(done=>{let ended=false;const once=value=>{if(ended)return;ended=true;clearTimeout(timer);done(value)};const timer=setTimeout(()=>once('TIMEOUT'),1000);
   try{const child=cp.spawn(process.execPath,['--no-addons','-e','process.stdout.write("UNEXPECTED_CHILD_MARKER")'],{stdio:['ignore',1,2]});child.on('error',e=>once(String(e.code)));child.on('spawn',()=>once('SPAWNED'));}catch(e){once(String(e.code))}});
  finish({protocol:PROTOCOL,operation:request.operation,pid:process.pid,attempts:1,result});return;
 }
 if(!exact(request,['protocol','operation','outsideFile','port','nonce'])||typeof request.outsideFile!=='string'||request.outsideFile.length>1024||request.outsideFile.includes('\0')||!path.isAbsolute(request.outsideFile)||path.basename(request.outsideFile)!=='outside.txt'||!Number.isInteger(request.port)||request.port<1||request.port>65535||typeof request.nonce!=='string'||!/^[a-zA-Z0-9-]{1,128}$/.test(request.nonce))throw Error();
 const deadline=Date.now()+6000;while(!fs.existsSync(path.join(process.cwd(),'host-ready'))){if(Date.now()>deadline)throw Error();await pause()}
 const targets={work:path.join(process.cwd(),'existing.txt'),profile:path.join(process.env.USERPROFILE,'probe-existing.txt'),temp:path.join(process.env.TEMP,'probe-existing.txt'),outside:request.outsideFile};
 const result={protocol:PROTOCOL,operation:request.operation,pid:process.pid,files:{},network:{connected:false,sent:false,error:null}};
 for(const [name,file]of Object.entries(targets)){
  const item={before:null,after:null,operations:{}};try{item.before=fs.readFileSync(file,'utf8')}catch(e){item.before=e.code}
  for(const [op,fn]of Object.entries({create:()=>fs.writeFileSync(path.join(path.dirname(file),'forbidden-new.txt'),'bad'),append:()=>fs.appendFileSync(file,'bad'),overwrite:()=>fs.writeFileSync(file,'bad'),delete:()=>fs.unlinkSync(file)})){try{fn();item.operations[op]='ALLOWED'}catch(e){item.operations[op]=e.code}}
  try{item.after=fs.readFileSync(file,'utf8')}catch(e){item.after=e.code}result.files[name]=item;
 }
 await new Promise(done=>{const socket=net.connect(request.port,'127.0.0.1');socket.on('connect',()=>{result.network.connected=true;socket.write(request.nonce+'\n',e=>{if(!e)result.network.sent=true;socket.destroy()})});socket.on('error',e=>result.network.error=e.code);socket.setTimeout(700,()=>{result.network.error='TIMEOUT';socket.destroy()});socket.on('close',done)});
 finish(result);
}
process.stdin.on('data',chunk=>{if(bytes.length+chunk.length>8192){finish({protocol:PROTOCOL,status:'protocol_error'});process.stdin.destroy();return}bytes=Buffer.concat([bytes,chunk])});
process.stdin.on('end',()=>{if(finished)return;try{const request=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));execute(request).catch(()=>finish({protocol:PROTOCOL,status:'protocol_error'}));}catch{finish({protocol:PROTOCOL,status:'protocol_error'})}});
process.stdin.on('error',()=>finish({protocol:PROTOCOL,status:'protocol_error'}));
