import { getRequestListener } from '@hono/node-server';
import { createApi } from './api';

/**
 * Monta a API (/api/*) dentro do dev server do Vite: editor e API na MESMA porta.
 * Tipado estruturalmente para não acoplar este pacote à versão do Vite.
 */
export function cajuApiPlugin({ projectsDir }: { projectsDir: string }) {
  const listener = getRequestListener(createApi({ projectsDir }).fetch);
  return {
    name: 'caju-api',
    configureServer(server: {
      middlewares: { use(fn: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void): void };
    }) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/') || req.url === '/api') {
          void listener(req, res);
          return;
        }
        next();
      });
    },
  };
}
