import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createApi } from '@caju-motion/server';
import type { RenderJob } from './routes';

// render que nunca avança: só termina quando o sinal aborta (como uma página de render travada)
vi.mock('./render', () => ({
  renderStill: vi.fn(),
  renderMedia: vi.fn(
    (o: { signal: AbortSignal }) =>
      new Promise((_, reject) => {
        o.signal.addEventListener('abort', () => {
          const reason: unknown = o.signal.reason;
          reject(reason instanceof Error && reason.name !== 'AbortError' ? reason : new Error('renderização cancelada'));
        });
      }),
  ),
}));

const { renderRoutes } = await import('./routes');

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/projects');
const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function start(app: ReturnType<typeof createApi>): Promise<RenderJob> {
  const res = await app.request('/api/projects/hello-reel/render', post({}));
  return ((await res.json()) as { job: RenderJob }).job;
}

async function waitJob(app: ReturnType<typeof createApi>, id: string, done: (j: RenderJob) => boolean): Promise<RenderJob> {
  for (let i = 0; i < 100; i++) {
    const j = (await (await app.request(`/api/render/jobs/${id}`)).json()) as RenderJob;
    if (done(j)) return j;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('o job não terminou');
}

describe('renderRoutes: job travado', () => {
  it('sem progresso → erro legível (não fica "renderizando" para sempre) e libera a fila', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApi({ projectsDir: FIXTURES, extensions: [renderRoutes({ stallMs: 100 })] });
    const job = await start(app);
    const second = await start(app);
    expect(second.status).toBe('queued');

    const failed = await waitJob(app, job.id, (j) => j.status !== 'running');
    expect(failed.status).toBe('error');
    expect(failed.error).toMatch(/parou de avançar há 0 s \(abrindo o navegador/);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('export de "hello-reel" falhou'));
    // o próximo da fila começou
    expect((await waitJob(app, second.id, (j) => j.status !== 'queued')).status).not.toBe('queued');
    error.mockRestore();
  });

  it('cancelar um job em andamento termina como "canceled"', async () => {
    const app = createApi({ projectsDir: FIXTURES, extensions: [renderRoutes()] });
    const job = await start(app);
    await app.request(`/api/render/jobs/${job.id}/cancel`, { method: 'POST' });
    const j = await waitJob(app, job.id, (x) => x.status !== 'running');
    expect(j.status).toBe('canceled');
  });
});
