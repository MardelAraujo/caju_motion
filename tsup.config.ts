import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsup';

/**
 * Build compartilhado dos pacotes publicados (rodado de dentro de cada pacote:
 * `tsup --config ../../tsup.config.ts`). Saída: dist/index.js (ESM) + dist/index.d.ts.
 */
const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as { name: string };
const isCli = pkg.name === '@caju-motion/cli';
/** Pacotes que rodam só no Node (usam node:fs etc.); os demais também rodam no navegador. */
const isNode = isCli || pkg.name === '@caju-motion/server' || pkg.name === '@caju-motion/studio';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: isNode ? 'node20' : 'es2022',
  platform: isNode ? 'node' : 'neutral',
  dts: !isCli,
  clean: true,
  sourcemap: true,
  tsconfig: path.resolve(import.meta.dirname, 'tsconfig.build.json'),
  banner: isCli ? { js: '#!/usr/bin/env node' } : undefined,
  // o Vite só é usado pelo `caju studio --dev` (import dinâmico) e não é dependência publicada
  external: ['vite', '@vitejs/plugin-react'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // dependências do monorepo resolvem pelo código-fonte só no dev; no build ficam externas (package.json)
    options.conditions = ['source'];
  },
});
