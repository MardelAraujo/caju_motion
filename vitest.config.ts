import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // pacotes do monorepo pelo código-fonte (condição "source"), sem precisar buildar antes
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    // folga para máquinas carregadas: com CAJU_RENDER_IT=1 os testes de render (Chromium + FFmpeg)
    // disputam CPU com os outros e o limite padrão (5 s) estoura em testes que passam sozinhos
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
