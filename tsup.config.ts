import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsup';

/**
 * Build compartilhado dos pacotes publicados (rodado de dentro de cada pacote:
 * `tsup --config ../../tsup.config.ts`). Saída: dist/index.js (ESM) + dist/index.d.ts.
 */
const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
  name: string;
  exports?: Record<string, { source?: string }>;
};
/** Um entry por export com condição `source` (ex.: `.` e `./web` no @caju-motion/media). */
const entries = Object.values(pkg.exports ?? {})
  .map((e) => e.source?.replace(/^\.\//, ''))
  .filter((e): e is string => !!e);
const isCli = pkg.name === '@caju-motion/cli' || pkg.name === 'create-caju';
/** Pacotes que rodam só no Node (usam node:fs etc.); os demais também rodam no navegador. */
const isNode =
  isCli || ['@caju-motion/server', '@caju-motion/studio', '@caju-motion/sdk', '@caju-motion/renderer-node', '@caju-motion/media', '@caju-motion/voice', 'create-caju'].includes(pkg.name);

export default defineConfig({
  entry: entries.length ? entries : ['src/index.ts'],
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
