import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mediaCacheDir } from '@caju-motion/media';
import { createApi } from './api';

let dir: string;
let api: ReturnType<typeof createApi>;

const req = (method: string, url: string, body?: unknown) =>
  api.request(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  });

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'frame-api-'));
  api = createApi({ projectsDir: dir });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('API de projetos', () => {
  it('health', async () => {
    const res = await req('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('cria, lista, lê e salva com histórico', async () => {
    expect(await (await req('GET', '/api/projects')).json()).toEqual([]);

    const created = await req('POST', '/api/projects', { id: 'meu-video', name: 'Meu vídeo', format: 'feed-4x5' });
    expect(created.status).toBe(201);
    const project = await created.json();
    expect(project.settings).toMatchObject({ width: 1080, height: 1350 });

    const list = await (await req('GET', '/api/projects')).json();
    expect(list).toEqual([
      { id: 'meu-video', valid: true, name: 'Meu vídeo', format: 'feed-4x5', width: 1080, height: 1350, fps: 30 },
    ]);

    project.name = 'Renomeado';
    const saved = await req('PUT', '/api/projects/meu-video', project);
    expect(saved.status).toBe(200);
    expect((await (await req('GET', '/api/projects/meu-video')).json()).name).toBe('Renomeado');

    const history = await readdir(path.join(dir, 'meu-video', '.caju', 'history'));
    expect(history).toHaveLength(1);
  });

  it('recusa duplicado, id inválido e doc inválido', async () => {
    await req('POST', '/api/projects', { id: 'a' });
    expect((await req('POST', '/api/projects', { id: 'a' })).status).toBe(409);
    expect((await req('POST', '/api/projects', { id: '../fora' })).status).toBe(400);
    expect((await req('GET', '/api/projects/nao-existe')).status).toBe(404);

    const project = await (await req('GET', '/api/projects/a')).json();
    project.settings.width = -1;
    const bad = await req('PUT', '/api/projects/a', project);
    expect(bad.status).toBe(422);
    expect((await bad.json()).error).toMatch(/width/);
  });

  it('upload em stream, nomes únicos e download com Range', async () => {
    await req('POST', '/api/projects', { id: 'a' });
    const bytes = new TextEncoder().encode('0123456789');
    const up = (name: string) =>
      api.request(`/api/projects/a/assets?name=${encodeURIComponent(name)}`, { method: 'POST', body: bytes });

    const r1 = await up('Vídeo Final.mp4');
    expect(r1.status).toBe(201);
    expect(await r1.json()).toEqual({ src: 'assets/Video-Final.mp4', name: 'Vídeo Final.mp4' });
    expect((await (await up('Vídeo Final.mp4')).json()).src).toBe('assets/Video-Final-2.mp4');

    const full = await api.request('/api/projects/a/files/assets/Video-Final.mp4');
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('video/mp4');
    expect(await full.text()).toBe('0123456789');

    const part = await api.request('/api/projects/a/files/assets/Video-Final.mp4', { headers: { range: 'bytes=2-5' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await part.text()).toBe('2345');

    expect((await api.request('/api/projects/a/files/assets/nada.mp4')).status).toBe(404);
    expect((await api.request('/api/projects/a/files/..%2F..%2Fsegredo.txt')).status).toBe(400);
  });

  it('?proxy=1 serve o proxy do cache de mídia enquanto o original não muda', async () => {
    await req('POST', '/api/projects', { id: 'a' });
    const proj = path.join(dir, 'a');
    await mkdir(path.join(proj, 'assets'), { recursive: true });
    const original = path.join(proj, 'assets', 'clip.mp4');
    await writeFile(original, 'ORIGINAL');
    const st = await stat(original);
    const hash = 'ab'.repeat(32);
    const cache = mediaCacheDir(proj, hash);
    await mkdir(cache, { recursive: true });
    await writeFile(path.join(cache, 'proxy.mp4'), 'PROXY');
    await writeFile(path.join(cache, 'peaks.json'), '{"peaks":[0.5]}');
    await writeFile(
      path.join(proj, '.caju', 'media', 'index.json'),
      JSON.stringify({ 'assets/clip.mp4': { hash, size: st.size, mtimeMs: st.mtimeMs } }),
    );

    const proxied = await api.request('/api/projects/a/files/assets/clip.mp4?proxy=1');
    expect(await proxied.text()).toBe('PROXY');
    expect(proxied.headers.get('x-caju-proxy')).toBe('1');
    expect(await (await api.request('/api/projects/a/files/assets/clip.mp4')).text()).toBe('ORIGINAL');
    expect(await (await api.request('/api/projects/a/media/peaks/assets/clip.mp4')).json()).toEqual({ peaks: [0.5] });
    expect((await api.request('/api/projects/a/media/thumb/assets/clip.mp4')).status).toBe(404);
    expect((await api.request('/api/projects/a/media/proxy/assets/clip.mp4')).status).toBe(404);

    // original trocado: o proxy antigo deixa de valer
    await writeFile(original, 'ORIGINAL v2');
    const after = await api.request('/api/projects/a/files/assets/clip.mp4?proxy=1');
    expect(await after.text()).toBe('ORIGINAL v2');
    expect(after.headers.get('x-caju-proxy')).toBeNull();
  });

  it('detecta alteração no disco: versão muda e gravação com base antiga dá 409', async () => {
    await req('POST', '/api/projects', { id: 'a' });
    const r1 = await req('GET', '/api/projects/a');
    const v1 = r1.headers.get('x-caju-version')!;
    const doc = await r1.json();
    expect(v1).toMatch(/^[0-9a-f]{16}$/);

    // alguém grava por fora (ex.: gerador)
    doc.name = 'Mudou por fora';
    const other = await req('PUT', '/api/projects/a', doc);
    const v2 = other.headers.get('x-caju-version')!;
    expect(v2).not.toBe(v1);
    expect((await (await req('GET', '/api/projects/a/version')).json()).version).toBe(v2);

    // o Studio, ainda com a versão v1, tenta salvar → conflito
    doc.name = 'Edição do Studio';
    const conflict = await api.request('/api/projects/a', {
      method: 'PUT',
      body: JSON.stringify(doc),
      headers: { 'content-type': 'application/json', 'x-caju-base': v1 },
    });
    expect(conflict.status).toBe(409);

    // com a versão atual, ou forçando, grava
    const ok = await api.request('/api/projects/a', {
      method: 'PUT',
      body: JSON.stringify(doc),
      headers: { 'content-type': 'application/json', 'x-caju-base': v1, 'x-caju-force': '1' },
    });
    expect(ok.status).toBe(200);
  });

  it('recusa id do documento diferente da URL', async () => {
    await req('POST', '/api/projects', { id: 'a' });
    const project = await (await req('GET', '/api/projects/a')).json();
    project.id = 'b';
    expect((await req('PUT', '/api/projects/a', project)).status).toBe(400);
  });
});
