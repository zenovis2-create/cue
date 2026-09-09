export interface CueIdentityConfig {
  readonly identity: '@cue';
  readonly relayEndpoint: string;
  readonly credentialRef: string;
}

export interface BuzzMessage {
  readonly channel_id: string;
  readonly thread_root: string;
  readonly text: string;
}

export type BuzzSend = (config: CueIdentityConfig, message: BuzzMessage) => Promise<void>;

export class CueBuzzAdapter {
  constructor(private readonly config: CueIdentityConfig | undefined, private readonly sendViaRelay: BuzzSend) {}

  async send(message: BuzzMessage): Promise<'sent' | 'identity_unconfigured'> {
    if (!this.config) return 'identity_unconfigured';
    await this.sendViaRelay(this.config, message);
    return 'sent';
  }
}
