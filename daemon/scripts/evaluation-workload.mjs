import {readExistingFileWorkload} from '../dist/src/evaluation/workload-release.js';
import {prepareEvaluationWorkloadCase,verifyEvaluationWorkloadCase,WorkloadPreparationError} from '../dist/src/evaluation/workload.js';

try {
  const [command,...args]=process.argv.slice(2);
  if(!['list','prepare','verify'].includes(command))throw Error('evaluation_workload_usage');
  const options={};
  if(command==='list'&&args.length)throw Error('evaluation_workload_usage');
  if(command==='prepare'||command==='verify'){
    if(args.length!==(command==='verify'?8:6))throw Error('evaluation_workload_usage');
    const names=command==='verify'?{'--case':'caseId','--split':'split','--worktree':'worktreePath','--goal':'goal'}:{'--case':'caseId','--split':'split','--parent':'parent'};
    for(let i=0;i<args.length;i+=2){
      const key=names[args[i]];
      if(!key||Object.hasOwn(options,key)||!args[i+1])throw Error('evaluation_workload_usage');
      options[key]=args[i+1];
    }
  }
  const workload=readExistingFileWorkload();
  const output=command==='prepare'?prepareEvaluationWorkloadCase(workload,options):command==='verify'?verifyEvaluationWorkloadCase(workload,options):{
    version:workload.version,authority:'workload-inventory-only',suiteDigest:workload.suiteDigest,
    dataset:workload.datasetInput,datasetDigest:workload.dataset.digest,
    cases:workload.cases.map(({id,family,split,files,inputDigest})=>({id,family,split,fileCount:files.length,inputDigest})),
    executionAuthorized:false,baselineConfigured:false,measurements:'not-collected',
  };
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}catch(error){
  const code=error instanceof Error&&/^evaluation_workload_[a-z_]+$/u.test(error.message)?error.message:'evaluation_workload_unavailable';
  process.stderr.write(JSON.stringify({error:code,...(error instanceof WorkloadPreparationError?{retainedWorktreePath:error.retainedWorktreePath}:{})})+'\n');
  process.exitCode=1;
}
