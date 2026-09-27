export const WEB_KIND: 'web-claim-v1';
export const LOCAL_FILE_KIND: 'local-file-sha256-v1';
export const WEB_DIGEST_RULE: string;
export const LOCAL_FILE_DIGEST_RULE: string;
export const CLAIM_SOURCES: readonly (readonly string[])[];
export function webClaimDigest(reference: string, claim: string, observedDate: string): string;
export function generateSourceClaimsBytes(qwenBytes: Buffer): Buffer;
export function verifySourceClaimsBytes(bytes: Buffer, qwenBytes: Buffer): Readonly<{
  webClaims: number;
  localFileClaims: number;
  bytes: number;
  sha256: string;
}>;
