import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { parseExportSettings, type ExportSettings } from '@caju-motion/schema';
import { createProjectStore, ProjectStoreError, serveFile, type ApiExtension } from '@caju-motion/server';
import { renderMedia, renderStill, type RenderProgress } from './render';

export type RenderJobStatus = 'queued' | 'running' | 'done' | 'error' | 'canceled';

export type RenderJob = {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  settings: ExportSettings;
  progress: RenderProgress;
  createdAt: string;
  finishedAt?: string;
  /** Nome do arquivo gerado (download em `/api/render/jobs/:id/file`). */
  fileName?: string;
  sizeBytes?: number;
  error?: string;
};

export type RenderRoutesOptions = {
  /** URL do Studio que serve as páginas de render. Padrão: a origem da própria requisição. */
  serveUrl?: string;
  /** Quantos jobs terminados manter na memória. */
  keepJobs?: number;
};

type Internal = { job: RenderJob; controller: AbortController; output?: string; projectsDir: string; serveUrl: string };

/**
 * Rotas de export (extensão da API do Studio):
 * - `POST /api/projects/:id/render` `{ settings }` → 202 `{ job }` (fila: um render por vez)
 * - `GET  /api/render/jobs` / `GET /api/render/jobs/:job`
 * - `POST /api/render/jobs/:job/cancel`
 * - `GET  /api/render/jobs/:job/file` → download
 * - `GET  /api/projects/:id/still?frame=n&resolution=1080` → PNG
 */
export function renderRoutes(opts: RenderRoutesOptions = {}): ApiExtension {
  const jobs = new Map<string, Internal>();
  const queue: Internal[] = [];
  let running: Internal | null = null;
  const keep = opts.keepJobs ?? 20;

  const prune = () => {
    const finished = [...jobs.values()].filter((j) => !['queued', 'running'].includes(j.job.status));
    for (const j of finished.slice(0, Math.max(0, finished.length - keep))) jobs.delete(j.job.id);
  };

  const pump = () => {
    if (running) return;
    const next = queue.shift();
    if (!next) return;
    running = next;
    next.job.status = 'running';
    void renderMedia({
      projectsDir: next.projectsDir,
      projectId: next.job.projectId,
      settings: next.job.settings,
      serveUrl: next.serveUrl,
      signal: next.controller.signal,
      onProgress: (p) => (next.job.progress = p),
    })
      .then(async (r) => {
        next.output = r.output;
        next.job.status = 'done';
        next.job.fileName = path.basename(r.output);
        next.job.sizeBytes = await stat(r.output).then((s) => (s.isFile() ? s.size : undefined), () => undefined);
      })
      .catch((e: Error) => {
        next.job.status = next.controller.signal.aborted ? 'canceled' : 'error';
        next.job.error = e.message;
      })
      .finally(() => {
        next.job.finishedAt = new Date().toISOString();
        running = null;
        prune();
        pump();
      });
  };

  const find = (id: string) => {
    const j = jobs.get(id);
    if (!j) throw new ProjectStoreError(`job de render "${id}" não encontrado`, 404);
    return j;
  };

  return (app, { projectsDir }) => {
    const store = createProjectStore(projectsDir);
    const origin = (url: string) => opts.serveUrl ?? `${new URL(url).origin}/`;

    app.post('/projects/:id/render', async (c) => {
      const projectId = c.req.param('id');
      const project = await store.read(projectId);
      const body = (await c.req.json().catch(() => ({}))) as { settings?: unknown };
      let settings: ExportSettings;
      try {
        settings = parseExportSettings(body.settings, project.settings);
      } catch (e) {
        return c.json({ error: (e as Error).message }, 400);
      }
      const job: RenderJob = {
        id: randomUUID(),
        projectId,
        status: 'queued',
        settings,
        progress: { stage: 'preparing', frame: 0, total: 0, speed: 0, etaSec: null },
        createdAt: new Date().toISOString(),
      };
      const entry: Internal = { job, controller: new AbortController(), projectsDir, serveUrl: origin(c.req.url) };
      jobs.set(job.id, entry);
      queue.push(entry);
      pump();
      return c.json({ job }, 202);
    });

    app.get('/render/jobs', (c) => c.json([...jobs.values()].map((j) => j.job)));

    app.get('/render/jobs/:job', (c) => c.json(find(c.req.param('job')).job));

    app.post('/render/jobs/:job/cancel', (c) => {
      const j = find(c.req.param('job'));
      if (j.job.status === 'queued') {
        queue.splice(queue.indexOf(j), 1);
        j.job.status = 'canceled';
        j.job.finishedAt = new Date().toISOString();
      } else if (j.job.status === 'running') {
        j.controller.abort();
      }
      return c.json(j.job);
    });

    app.get('/render/jobs/:job/file', async (c) => {
      const j = find(c.req.param('job'));
      if (j.job.status !== 'done' || !j.output) return c.json({ error: 'render ainda não terminou' }, 409);
      const isFile = await stat(j.output).then((s) => s.isFile(), () => false);
      if (!isFile) return c.json({ error: 'saída é uma pasta de quadros; veja a pasta renders do projeto', path: j.output }, 409);
      const res = await serveFile(j.output, c.req.header('range'));
      res.headers.set('content-disposition', `attachment; filename="${encodeURIComponent(path.basename(j.output))}"`);
      return res;
    });

    app.get('/projects/:id/still', async (c) => {
      const frame = Number(c.req.query('frame') ?? 0);
      const resolution = c.req.query('resolution') ? Number(c.req.query('resolution')) : undefined;
      if (!Number.isFinite(frame) || frame < 0) return c.json({ error: 'frame inválido' }, 400);
      const r = await renderStill({
        projectsDir,
        projectId: c.req.param('id'),
        frame,
        ...(resolution ? { resolution } : {}),
        serveUrl: origin(c.req.url),
      });
      return new Response(new Uint8Array(r.data), { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
    });
  };
}
