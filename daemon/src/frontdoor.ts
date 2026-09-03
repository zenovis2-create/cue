import type { HealthVector } from './health.js';
import type { AcceptedConversationRun, ConversationDaemonApi } from './conversation-daemon.js';

export const frontdoorTools = Object.freeze(['conversation', 'daemon_api'] as const);
export type FrontdoorTool = typeof frontdoorTools[number];

export function authorizeFrontdoorTool(tool: string): tool is FrontdoorTool {
  return (frontdoorTools as readonly string[]).includes(tool);
}

export class FrontdoorSession {
  private closed = false;
  constructor(private readonly daemonApi: Pick<ConversationDaemonApi, 'accept'>) {}
  close():void { this.closed=true; }
  isClosed():boolean { return this.closed; }
  request(tool:string, run:AcceptedConversationRun, health:HealthVector):ReturnType<ConversationDaemonApi['accept']> {
    if (!authorizeFrontdoorTool(tool)) throw new Error('frontdoor tool denied');
    if (tool !== 'daemon_api') throw new Error('conversation cannot start a run');
    return this.daemonApi.accept(run,health);
  }
}
