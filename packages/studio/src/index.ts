import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz do pacote do Studio (onde estão index.html e vite.config.ts). Vale tanto em src/ quanto em dist/. */
export const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** App do Studio já buildado (`vite build`), servido estático pela CLI. */
export const STUDIO_APP_DIR = path.join(STUDIO_ROOT, 'dist', 'app');
