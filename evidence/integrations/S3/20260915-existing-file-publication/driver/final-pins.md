# Frozen driver pins

- `app/orchestration-driver.mjs`: `2ed110d994e22910cd9b95deaf5d7a0167c033165c6a41cd7512221277a050f0`
- `app/orchestration-driver.d.mts`: `eabd94e34cc642b429e84f8af1502b04f780cc0c3ecbb990dc5e3e3ea65f5006`
- `daemon/test/integration-driver-publication.test.ts`: `1e2c82d5da0d58c1dc82fb6be7cb1dbe70158124c940df01e6126a22306752e1`

The seam is deliberately limited to a trusted host that explicitly advertises `attempt-owned-existing-files-v1`, registers the frozen staging-only contract, and supplies attempt-owned replacement bytes. Existing adapters without that capability fail before launch when staged publication is requested. This evidence does not qualify a production provider or claim isolation for adapters that retain direct write access to the original worktree.
