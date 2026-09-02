import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('../dist/migrations/', import.meta.url), { recursive: true });
copyFileSync(new URL('../migrations/001_init.sql', import.meta.url), new URL('../dist/migrations/001_init.sql', import.meta.url));
