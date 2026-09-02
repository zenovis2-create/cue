import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('../dist/migrations/', import.meta.url), { recursive: true });
copyFileSync(new URL('../migrations/001_init.sql', import.meta.url), new URL('../dist/migrations/001_init.sql', import.meta.url));
mkdirSync(new URL('../dist/src/', import.meta.url), { recursive: true });
copyFileSync(new URL('../src/network-guard.cjs', import.meta.url), new URL('../dist/src/network-guard.cjs', import.meta.url));
