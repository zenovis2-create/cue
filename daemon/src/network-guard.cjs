const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');

const allowed = new Set(JSON.parse(process.env.CUE_EGRESS_JSON || '[]').map(String));
function hostOf(args) {
  const first = args[0];
  if (typeof first === 'object' && first) return String(first.hostname || first.host || 'localhost').replace(/^\[|\]$/g, '');
  if (typeof first === 'string' && /^https?:/.test(first)) return new URL(first).hostname;
  if (typeof args[1] === 'string') return args[1];
  return 'localhost';
}
function check(args) {
  const host = hostOf(args);
  if (!allowed.has(host)) throw Object.assign(new Error(`CUE_EGRESS_BLOCKED:${host}`), { code: 'CUE_EGRESS_BLOCKED' });
}
for (const mod of [net, tls]) {
  const original = mod.connect;
  mod.connect = function (...args) { check(args); return original.apply(this, args); };
  if (mod.createConnection) mod.createConnection = mod.connect;
}
for (const mod of [http, https]) {
  const request = mod.request;
  mod.request = function (...args) { check(args); return request.apply(this, args); };
  const get = mod.get;
  mod.get = function (...args) { check(args); return get.apply(this, args); };
}
if (globalThis.fetch) {
  const fetch = globalThis.fetch;
  globalThis.fetch = function (...args) { check(args); return fetch.apply(this, args); };
}
