import type { Ledger } from '../daemon/src/ledger.js';
export interface GeneratedJsonHandoffAuthority {
  authorizeHandoffArtifact(sourceRef:string,attemptId:string):boolean;
  resolveHandoffArtifact(sourceRef:string,attemptId:string):Uint8Array|null;
}
export function createGeneratedJsonHandoffAuthority(input:{db:Ledger}):Readonly<GeneratedJsonHandoffAuthority>;
