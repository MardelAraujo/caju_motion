import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

/** App do Caju Studio. `caju studio --dev` usa este arquivo; `npm run build` gera dist/app. */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  // pacotes do monorepo: usa o código-fonte (condição "source"), sem precisar buildar antes
  resolve: { conditions: ['source', ...defaultClientConditions] },
  build: { outDir: 'dist/app', emptyOutDir: true },
});
