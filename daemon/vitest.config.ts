import { defineConfig } from 'vitest/config';
// Default harness budget only. Tests that declare their own timeout keep that exact
// contract; this covers real-process suites (spawned controllers, Git staging, owned
// process identity) that legitimately exceed vitest's 5s default on slower hosts.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], exclude: ['dist/**', 'node_modules/**'], testTimeout: 30_000 } });
