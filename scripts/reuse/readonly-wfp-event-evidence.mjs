import { types } from 'node:util';

const MAX_EVENTS = 64;
const MAX_APP_ID_BYTES = 4096;
const MAX_STRING = 512;
const REQUIRED_FLAGS = new Set([
  'FWPM_NET_EVENT_FLAG_PACKAGE_ID_SET',
  'FWPM_NET_EVENT_FLAG_APP_ID_SET',
  'FWPM_NET_EVENT_FLAG_IP_VERSION_SET',
  'FWPM_NET_EVENT_FLAG_IP_PROTOCOL_SET',
  'FWPM_NET_EVENT_FLAG_REMOTE_ADDR_SET',
  'FWPM_NET_EVENT_FLAG_REMOTE_PORT_SET',
]);

const UNKNOWN = Object.freeze({ kind: 'unknown' });

function ownDataRecord(value, keys) {
  if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const names = Object.keys(descriptors);
  if (names.length !== keys.length || !keys.every((key) => names.includes(key))) return false;
  return names.every((name) => 'value' in descriptors[name]);
}

function ownDataArray(value, maxLength) {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maxLength) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!('length' in descriptors)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !('value' in descriptor)) return false;
  }
  return Object.keys(descriptors).length === value.length + 1;
}

function boundedString(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING;
}

function filetime(value) {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value)
    && BigInt(value) <= 18446744073709551615n;
}

function uint64(value) {
  return filetime(value) && BigInt(value) <= 18446744073709551615n;
}

function byteArray(value) {
  return ownDataArray(value, MAX_APP_ID_BYTES) && value.length > 0 && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);
}

function exactBytes(left, right) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function validTarget(target) {
  return ownDataRecord(target, ['ipVersion', 'ipProtocol', 'remoteAddrV4', 'remotePort'])
    && target.ipVersion === 'FWP_IP_VERSION_V4'
    && target.ipProtocol === 6
    && target.remoteAddrV4 === 0x7f000001
    && target.remotePort === 48193;
}

function validContext(context) {
  const keys = [
    'collectionEnabled', 'subscriptionActiveBeforeResume', 'subscriptionHeldThroughVerifiedDeath',
    'lostEventCount', 'bufferOverflow', 'protectedProfileCount', 'sealedExecutableCount',
    'jobProcessCount', 'subscriptionActivatedAt', 'workerResumedAt', 'verifiedJobDeathAt',
    'packageSid', 'appIdBytes', 'target', 'expectedMissingCapability',
  ];
  if (!ownDataRecord(context, keys)) return false;
  if (context.collectionEnabled !== true || context.subscriptionActiveBeforeResume !== true
    || context.subscriptionHeldThroughVerifiedDeath !== true || context.lostEventCount !== 0
    || context.bufferOverflow !== false || context.protectedProfileCount !== 1
    || context.sealedExecutableCount !== 1 || context.jobProcessCount !== 1) return false;
  if (!filetime(context.subscriptionActivatedAt) || !filetime(context.workerResumedAt)
    || !filetime(context.verifiedJobDeathAt)) return false;
  const active = BigInt(context.subscriptionActivatedAt);
  const resumed = BigInt(context.workerResumedAt);
  const dead = BigInt(context.verifiedJobDeathAt);
  return active <= resumed && resumed <= dead && boundedString(context.packageSid)
    && byteArray(context.appIdBytes) && validTarget(context.target)
    && boundedString(context.expectedMissingCapability);
}

function matchesEvent(event, context) {
  if (!ownDataRecord(event, ['type', 'header', 'capabilityDrop'])) return false;
  if (event.type !== 'FWPM_NET_EVENT_TYPE_CAPABILITY_DROP') return false;
  const header = event.header;
  if (!ownDataRecord(header, [
    'timeStamp', 'flags', 'ipVersion', 'ipProtocol', 'remoteAddrV4', 'remotePort', 'appIdBytes', 'packageSid',
  ])) return false;
  if (!ownDataArray(header.flags, 16) || header.flags.some((flag) => !boundedString(flag))) return false;
  const flags = new Set(header.flags);
  if (flags.size !== header.flags.length || ![...REQUIRED_FLAGS].every((flag) => flags.has(flag))) return false;
  if (!filetime(header.timeStamp)) return false;
  const timestamp = BigInt(header.timeStamp);
  if (timestamp < BigInt(context.subscriptionActivatedAt) || timestamp > BigInt(context.verifiedJobDeathAt)) return false;
  if (header.ipVersion !== context.target.ipVersion || header.ipProtocol !== context.target.ipProtocol
    || header.remoteAddrV4 !== context.target.remoteAddrV4 || header.remotePort !== context.target.remotePort
    || header.packageSid !== context.packageSid || !byteArray(header.appIdBytes)
    || !exactBytes(header.appIdBytes, context.appIdBytes)) return false;
  const drop = event.capabilityDrop;
  return ownDataRecord(drop, ['networkCapabilityId', 'filterId', 'isLoopback'])
    && drop.networkCapabilityId === context.expectedMissingCapability
    && uint64(drop.filterId) && BigInt(drop.filterId) > 0n && drop.isLoopback === true;
}

export function inferReadonlyWfpPackageDrop(input) {
  try {
    if (!ownDataRecord(input, ['context', 'events']) || !validContext(input.context)
      || !ownDataArray(input.events, MAX_EVENTS)) return UNKNOWN;
    const matches = input.events.filter((event) => matchesEvent(event, input.context));
    if (matches.length !== 1) return UNKNOWN;
    const match = matches[0];
    return Object.freeze({
      kind: 'package-drop-inference',
      association: 'unique-package-app-exclusive-one-process-interval',
      networkCapabilityId: match.capabilityDrop.networkCapabilityId,
      filterId: match.capabilityDrop.filterId,
      eventTimeStamp: match.header.timeStamp,
    });
  } catch {
    return UNKNOWN;
  }
}
