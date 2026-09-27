export interface ElectronProfileApp {
  isReady(): boolean;
  setPath(name: 'userData' | 'sessionData', value: string): void;
  getPath(name: 'userData' | 'sessionData'): string;
}
/** Protected host environment only; null preserves ordinary default profiles. */
export function bindElectronProfile(app: ElectronProfileApp): Readonly<{ userData: string; sessionData: string }> | null;
