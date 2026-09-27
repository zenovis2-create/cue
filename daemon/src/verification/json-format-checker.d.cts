export interface JsonFormatVerdict {
  readonly contract: 'cue-json-format-v1';
  readonly status: 'pass' | 'fail' | 'unknown';
  readonly reason: string;
  readonly inputSha256: string | null;
  readonly outputSha256: string | null;
  readonly expectedSha256: string | null;
}
export function checkJsonFormat(inputBytes: Uint8Array, outputBytes: Uint8Array): Readonly<JsonFormatVerdict>;
export const CONTRACT: 'cue-json-format-v1';
export const MAX_BYTES: 1048576;
export const MAX_DEPTH: 64;
