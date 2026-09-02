export type PayloadClass = 'json' | 'text';

export function classifyPayload(bytes: Uint8Array): PayloadClass | undefined {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return undefined; }
  if (/\u0000/.test(text)) return undefined;
  try { JSON.parse(text); return 'json'; } catch { return text.length > 0 ? 'text' : undefined; }
}
