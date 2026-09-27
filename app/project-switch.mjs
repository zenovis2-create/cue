// Host-only lifecycle. No renderer root/path and no switch during current authority.
export function createProjectSwitchCoordinator({core,catalog,confirm,assertCurrent,pendingRequests,persist,restart,onFatal}){
  let state='idle';
  const check=target=>{
    assertCurrent();
    const readiness=core.projectSwitchReadiness(target.root);
    if(readiness.ready!==true||pendingRequests()>1)throw Error(`project_switch_denied:${readiness.reason??'pending-request'}`);
  };
  return Object.freeze({
    get state(){return state;},
    async switchProject(projectId){
      if(state!=='idle')throw Error('project_switch_busy');
      state='checking';
      try{
        const target=catalog.target(projectId);check(target);
        if(await confirm(target)!==true)throw Error('project_switch_cancelled');
        check(target);state='closing';await core.close();assertCurrent();
        state='persisting';persist(target.root);
        state='restarting';restart();
      }catch(error){
        if(state==='checking')state='idle';
        else{state='failed';onFatal(error);}
        throw error;
      }
    },
  });
}
