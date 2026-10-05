import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { createApi, type ApiExtension } from './api';
import { safeJoin, serveFile } from './files';

/**
 * Studio em produção: API (/api/*) + app já buildado (`appDir`) na mesma porta.
 * Rotas que não são arquivos caem no index.html (SPA), inclusive `/?render=<id>&frame=<n>`.
 */
export function createStudioServer({
  projectsDir,
  appDir,
  extensions,
}: {
  projectsDir: string;
  appDir: string;
  extensions?: ApiExtension[];
}) {
  const api = createApi({ projectsDir, extensions });
  const app = new Hono();
  app.route('/', api);

  app.get('*', async (c) => {
    const rel = decodeURIComponent(new URL(c.req.url).pathname).replace(/^\/+/, '');
    if (rel === 'api' || rel.startsWith('api/')) return c.json({ error: 'rota não encontrada' }, 404);
    let file: string;
    try {
      file = safeJoin(appDir, rel || 'index.html');
    } catch {
      return c.text('caminho inválido', 400);
    }
    const isFile = await stat(file).then((s) => s.isFile(), () => false);
    if (isFile) return serveFile(file, c.req.header('range'));
    // arquivo com extensão que não existe (ex.: /fonts/local/fonts.css opcional) → 404 de verdade
    if (path.extname(rel)) return c.text('não encontrado', 404);
    return serveFile(path.join(appDir, 'index.html'), undefined);
  });

  return app;
}
