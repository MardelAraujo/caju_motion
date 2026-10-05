import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // pacotes do monorepo pelo código-fonte (condição "source"), sem precisar buildar antes
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
  },
});
