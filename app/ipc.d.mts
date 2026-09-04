import type { CueCore } from './core.mjs';
export const IPC_CHANNELS: readonly string[];
export function assertAllowedChannel(channel: string): string;
export function registerIpcHandlers(ipcMain: { handle(channel: string, handler: (...args: any[]) => any): void }, core: CueCore): Readonly<{ invoke(channel: string, ...args: any[]): any }>;
