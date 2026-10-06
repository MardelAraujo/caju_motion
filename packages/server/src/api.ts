import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { Hono } from 'hono';
import { findDerived } from '@caju-motion/media';
import { FORMAT_IDS, type FormatId } from '@caju-motion/schema';
import { safeJoin, saveUpload, serveFile } from './files';
import { createProjectStore, ProjectStoreError } from './projects';

/** Versão do pacote (src/ e dist/ ficam ambos um nível abaixo do package.json). */
export const CAJU_VERSION: string = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;

/**
 * Extensão da API: recebe o app (já com basePath `/api`) e registra rotas próprias.
 * Usado por recursos que vivem em outros pacotes/arquivos (render, componentes) sem acoplar este módulo a eles.
 */
export type ApiExtension = (app: Hono, ctx: { projectsDir: string }) => void;

export type ApiOptions = { projectsDir: string; extensions?: ApiExtension[] };

export function createApi({ projectsDir, extensions = [] }: ApiOptions) {
  const store = createProjectStore(projectsDir);
  const app = new Hono().basePath('/api');
  for (const extend of extensions) extend(app, { projectsDir: store.root });

  app.onError((err, c) => {
    if (err instanceof ProjectStoreError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'erro interno do servidor' }, 500);
  });

  app.get('/health', (c) => c.json({ ok: true, version: CAJU_VERSION, projectsDir: store.root }));

  app.get('/projects', async (c) => c.json(await store.list()));

  app.post('/projects', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { id?: unknown; name?: unknown; format?: unknown };
    if (typeof body.id !== 'string') throw new ProjectStoreError('campo "id" obrigatório', 400);
    const format =
      typeof body.format === 'string' && (FORMAT_IDS as readonly string[]).includes(body.format)
        ? (body.format as FormatId)
        : undefined;
    const project = await store.create(body.id, {
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(format ? { format } : {}),
    });
    return c.json(project, 201);
  });

  app.get('/projects/:id', async (c) => {
    const id = c.req.param('id');
    const project = await store.read(id);
    c.header('x-caju-version', await store.version(id));
    return c.json(project);
  });

  app.get('/projects/:id/version', async (c) => c.json({ version: await store.version(c.req.param('id')) }));

  /** Grava. Com `x-caju-base` (versão aberta pelo cliente), recusa com 409 se o disco mudou. */
  app.put('/projects/:id', async (c) => {
    const id = c.req.param('id');
    const doc = await c.req.json().catch(() => {
      throw new ProjectStoreError('corpo não é JSON válido', 400);
    });
    const base = c.req.header('x-caju-force') === '1' ? undefined : c.req.header('x-caju-base');
    const saved = await store.write(id, doc, new Date(), base);
    c.header('x-caju-version', await store.version(id));
    return c.json(saved);
  });

  /** Upload de mídia em stream (corpo = bytes do arquivo; ?name=original.mp4). Não altera o project.json. */
  app.post('/projects/:id/assets', async (c) => {
    const dir = await store.dir(c.req.param('id'));
    const name = c.req.query('name');
    if (!name) throw new ProjectStoreError('parâmetro "name" obrigatório', 400);
    const body = c.req.raw.body;
    if (!body) throw new ProjectStoreError('corpo vazio', 400);
    const saved = await saveUpload(path.join(dir, 'assets'), name, body as unknown as WebReadableStream<Uint8Array>);
    return c.json({ src: `assets/${saved}`, name }, 201);
  });

  /**
   * Arquivos do projeto (mídia), com Range para seek. `?proxy=1`: o proxy de edição gerado por
   * `caju media`, se existir e o original não tiver mudado (senão, o próprio arquivo).
   */
  app.get('/projects/:id/files/*', async (c) => {
    const id = c.req.param('id');
    const dir = await store.dir(id);
    const prefix = `/api/projects/${id}/files/`;
    const rel = decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length));
    const file = safeJoin(dir, rel);
    if (c.req.query('proxy') === '1') {
      const proxy = await findDerived(dir, path.relative(dir, file).split(path.sep).join('/'), 'proxy');
      if (proxy) {
        const res = await serveFile(proxy, c.req.header('range'));
        res.headers.set('x-caju-proxy', '1');
        return res;
      }
    }
    return serveFile(file, c.req.header('range'));
  });

  /** Derivados do cache de mídia (`thumb` jpg, `peaks` json) de um asset; 404 se ainda não foram gerados. */
  app.get('/projects/:id/media/:kind/*', async (c) => {
    const { id, kind } = c.req.param();
    if (kind !== 'thumb' && kind !== 'peaks') throw new ProjectStoreError(`derivado desconhecido: ${kind}`, 404);
    const dir = await store.dir(id);
    const prefix = `/api/projects/${id}/media/${kind}/`;
    const file = safeJoin(dir, decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length)));
    const derived = await findDerived(dir, path.relative(dir, file).split(path.sep).join('/'), kind);
    if (!derived) throw new ProjectStoreError('ainda não gerado (rode caju media)', 404);
    return serveFile(derived, undefined);
  });

  return app;
}
