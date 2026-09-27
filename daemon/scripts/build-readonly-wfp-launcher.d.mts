export type ReadonlyWfpLauncherSources={launcher:string;collector:string;adapter:string};
export function generateReadonlyWfpLauncher(sources:ReadonlyWfpLauncherSources):string;
export const renderReadonlyWfpLauncher:typeof generateReadonlyWfpLauncher;
export function sha256(value:string):string;
export function buildDefault():string;
