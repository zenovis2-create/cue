// Offline Cue-owned contract experiment. Model identifiers never grant permissions.
const roles = new Set(['planner', 'implementer', 'verifier']);
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u;
const roleIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;
function fail(code) { throw new TypeError(code); }
function object(value, allowed) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('object_required');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('prototype_rejected');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail('unknown_field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('accessor_rejected');
  }
}
function string(value, limit, identifier = false) {
  if (typeof value !== 'string' || value.trim().length === 0) fail('string_required');
  if (Buffer.byteLength(value, 'utf8') > limit) fail('size_exceeded');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('control_rejected');
  if (identifier && !idPattern.test(value)) fail('identifier_rejected');
  return value;
}
export function parseRole(input) {
  object(input, ['id', 'role', 'instructions', 'model']);
  for (const key of ['id', 'role', 'instructions']) if (!Object.hasOwn(input, key)) fail('required_field');
  const id = string(input.id, 128, true);
  if (!roleIdPattern.test(id)) fail('role_identifier_rejected');
  if (!roles.has(input.role)) fail('role_rejected');
  const instructions = string(input.instructions, 16384);
  const result = { id, role: input.role, instructions };
  if (Object.hasOwn(input, 'model')) {
    object(input.model, ['canonicalId']);
    if (!Object.hasOwn(input.model, 'canonicalId')) fail('required_field');
    result.model = Object.freeze({ canonicalId: string(input.model.canonicalId, 128, true) });
  }
  return Object.freeze(result);
}
export function serializeRole(input) {
  return `${JSON.stringify(parseRole(input))}\n`;
}
