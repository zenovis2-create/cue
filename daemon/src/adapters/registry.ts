// Registry records what tools exist. It does NOT record what they are allowed to do.
// Eligibility is never declared here; it is derived only from measured capability probes
// (see docs/P13_SPEC.md). A value that can be written down can be written down falsely.
export const adapterRegistry = Object.freeze([
  Object.freeze({ name: 'codex' }),
]);
