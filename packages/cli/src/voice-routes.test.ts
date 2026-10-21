import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '@caju-motion/server';
import { toneWav } from '@caju-motion/voice';
import { voiceRoutes } from './voice-routes';

let dir: string;
let api: ReturnType<typeof createApi>;

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  api.request(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { 'content-type': 'application/json', ...headers },
  });

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'caju-voice-routes-'));
  api = createApi({ projectsDir: dir, extensions: [voiceRoutes()] });
  await req('POST', '/api/projects', { id: 'v', format: 'reel-9x16' });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

const tracks = async () => ((await (await req('GET', '/api/projects/v')).json()) as { tracks: { name: string; clips: unknown[] }[] }).tracks;

describe('rotas de voz do Studio', () => {
  it('tts: gera a locução e as legendas no projeto, e respeita a versão aberta', async () => {
    const version = (await (await req('GET', '/api/projects/v/version')).json()).version as string;
    const res = await req('POST', '/api/projects/v/tts', { text: 'Olá mundo. Tudo bem?', provider: 'placeholder', name: 'vo-01' }, { 'x-caju-base': version });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ audioSrc: 'assets/audio/vo/vo-01.wav', cached: false, filesOnly: false });
    expect(res.headers.get('x-caju-version')).toBeTruthy();
    const names = (await tracks()).map((t) => t.name);
    expect(names).toContain('Locução');
    expect(names).toContain('Legendas');

    const stale = await req('POST', '/api/projects/v/tts', { text: 'Outro texto.', provider: 'placeholder', name: 'vo-02' }, { 'x-caju-base': version });
    expect(stale.status).toBe(409);
    expect((await req('POST', '/api/projects/v/tts', { provider: 'placeholder' })).status).toBe(400);
  });

  it('VoiceStudio fechado: erro legível (422), sem tocar no projeto', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    const res = await req('POST', '/api/projects/v/tts', { text: 'Oi.' });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/VoiceStudio não respondeu/);
    expect((await tracks()).every((t) => !t.clips.length)).toBe(true);
    const status = await (await req('GET', '/api/voice')).json();
    expect(status).toMatchObject({ defaultProvider: 'voicestudio', voicestudio: { ok: false } });
  });

  it('transcribe: legenda um asset do projeto pelo VoiceStudio', async () => {
    await writeFile(path.join(dir, 'v', 'fala.wav'), toneWav(1));
    vi.stubGlobal('fetch', async () => Response.json({ text: 'Oi gente.', words: [{ word: 'Oi', start: 0, end: 0.3 }, { word: 'gente.', start: 0.3, end: 0.8 }] }));
    const res = await req('POST', '/api/projects/v/transcribe', { src: 'fala.wav', language: 'pt' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ wordsSrc: 'assets/data/fala.words.json', cues: 1, filesOnly: false });
    expect((await tracks()).find((t) => t.name === 'Legendas')?.clips).toHaveLength(1);
    expect((await req('POST', '/api/projects/v/transcribe', { src: '../fora.wav' })).status).toBe(400);
  });
});
