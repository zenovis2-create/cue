export const componentNames = ['orca', 'codex_app_server', 'daemon', 'sentinel'] as const;
export type ComponentName = typeof componentNames[number];
export type HealthVector = Record<ComponentName, { name: ComponentName; alive: boolean }>;
export function healthVector(status: Record<ComponentName, boolean>): HealthVector {
  return Object.fromEntries(componentNames.map(name => [name, { name, alive: status[name] }])) as HealthVector;
}
export function failedComponents(vector: HealthVector): ComponentName[] {
  return componentNames.filter(name => !vector[name].alive);
}
