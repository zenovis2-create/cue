import {createHash} from 'node:crypto';
import {closeSync,fstatSync,lstatSync,openSync,readSync} from 'node:fs';
import {freezeEvaluationWorkload} from './workload.js';

export const EXISTING_FILE_WORKLOAD_SHA256='2a3e6ff012ddc1a08dae3422bf8412ab8cf0b9137de98698f301ffcf79d660bb';
const release=new URL('../../evaluation/existing-files-v1.json',import.meta.url);
/** Loads only the reviewed packaged release, never a submitted filesystem path.
 * Pin changes require a new reviewed workload revision; no measurement follows. */
export function readExistingFileWorkload(){
  const before=lstatSync(release);
  if(!before.isFile()||before.isSymbolicLink()||before.size<1||before.size>1048576)throw Error('evaluation_workload_release');
  const fd=openSync(release,'r');
  try{
    const opened=fstatSync(fd);
    if(!opened.isFile()||opened.dev!==before.dev||opened.ino!==before.ino||opened.size!==before.size)throw Error('evaluation_workload_release');
    const bytes=Buffer.alloc(before.size+1);let length=0;
    for(;;){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;if(length>before.size)throw Error('evaluation_workload_release');}
    if(length!==before.size||createHash('sha256').update(bytes.subarray(0,length)).digest('hex')!==EXISTING_FILE_WORKLOAD_SHA256)throw Error('evaluation_workload_release');
    return freezeEvaluationWorkload(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length))));
  }finally{closeSync(fd);}
}
