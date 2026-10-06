import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApi } from '@caju-motion/server';
import { renderRoutes } from './routes';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/projects');
const app = () => createApi({ projectsDir: FIXTURES, extensions: [renderRoutes()] });
const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('renderRoutes (sem navegador)', () => {
  it('valida a configuração antes de enfileirar', async () => {
    const res = await app().request('/api/projects/hello-reel/render', post({ settings: { format: 'avi' } }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/formato inválido/);
  });

  it('projeto inexistente → 404; job inexistente → 404', async () => {
    const a = app();
    expect((await a.request('/api/projects/nao-existe/render', post({}))).status).toBe(404);
    expect((await a.request('/api/render/jobs/xyz')).status).toBe(404);
    expect((await a.request('/api/render/jobs/xyz/cancel', { method: 'POST' })).status).toBe(404);
  });

  it('lista vazia de jobs', async () => {
    const res = await app().request('/api/render/jobs');
    expect(await res.json()).toEqual([]);
  });
});
