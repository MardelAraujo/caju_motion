import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

/** Página demo do player (`npm run demo -w @caju-motion/player`); os projetos são lidos pelo /@fs/ do Vite. */
export default defineConfig({
  root: path.join(import.meta.dirname, 'demo'),
  plugins: [react()],
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: { fs: { allow: [path.resolve(import.meta.dirname, '../..')] } },
  build: { target: 'es2022' },
});
