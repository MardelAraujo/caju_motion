import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  api = createApi({ projectsDir: dir, extensions: [voiceRoutes({ envFile: path.join(dir, '.env'), previewDir: path.join(dir, 'previews') })] });
  await req('POST', '/api/projects', { id: 'v', format: 'reel-9x16' });
});
const saved = { openai: process.env.OPENAI_API_KEY, elevenlabs: process.env.ELEVENLABS_API_KEY };
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const [k, v] of [['OPENAI_API_KEY', saved.openai], ['ELEVENLABS_API_KEY', saved.elevenlabs]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
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

  it('chaves: testa no provedor, grava no .env, mostra só o fim e remove', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const seen: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push(String(url));
      const key = (init.headers as Record<string, string>)['xi-api-key'];
      return key === 'xi-boa-chave-0000000000001234' ? Response.json({ voices: [] }) : Response.json({ detail: 'invalid' }, { status: 401 });
    });
    const bad = await req('PUT', '/api/voice/keys', { elevenlabs: 'xi-chave-errada-000000000000' });
    expect(bad.status).toBe(422);
    expect((await bad.json()).error).toMatch(/recusada/);
    expect((await req('PUT', '/api/voice/keys', { elevenlabs: 'curta' })).status).toBe(400);

    const ok = await req('PUT', '/api/voice/keys', { elevenlabs: 'xi-boa-chave-0000000000001234' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ elevenlabs: { configured: true, hint: '…1234' } });
    expect(await readFile(path.join(dir, '.env'), 'utf8')).toBe('ELEVENLABS_API_KEY=xi-boa-chave-0000000000001234\n');
    expect(seen[seen.length - 1]).toMatch(/api\.elevenlabs\.io\/v2\/voices/);
    const status = await (await req('GET', '/api/voice')).json();
    expect(status.keys.elevenlabs).toBe(true);
    expect(status.keyHints.elevenlabs).toBe('…1234');
    expect(JSON.stringify(status)).not.toContain('xi-boa-chave');

    expect((await req('PUT', '/api/voice/keys', { elevenlabs: null })).status).toBe(200);
    expect(await readFile(path.join(dir, '.env'), 'utf8')).toBe('');
    expect(process.env.ELEVENLABS_API_KEY).toBeUndefined();
  });

  it('chaves e amostras só aceitam o próprio Studio no próprio computador', async () => {
    vi.stubGlobal('fetch', async () => Response.json({}));
    const key = { elevenlabs: 'xi-boa-chave-0000000000001234' };
    expect((await req('PUT', '/api/voice/keys', key, { origin: 'https://site-malicioso.com' })).status).toBe(403);
    expect((await req('PUT', '/api/voice/keys', key, { host: 'caju.example.com' })).status).toBe(403);
    expect((await req('PUT', '/api/voice/keys', key, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await req('POST', '/api/voice/preview', { provider: 'openai', voice: 'nova' }, { origin: 'http://evil.test' })).status).toBe(403);
    expect((await req('PUT', '/api/voice/keys', key, { origin: 'http://localhost' })).status).toBe(200);
  });

  it('vozes: catálogo da OpenAI e da conta ElevenLabs (com descrição e amostra)', async () => {
    const openai = await (await req('GET', '/api/voice/voices?provider=openai')).json();
    expect(openai.voices.find((v: { id: string }) => v.id === 'nova')).toMatchObject({ name: 'Nova', description: expect.stringContaining('feminina') });

    delete process.env.ELEVENLABS_API_KEY;
    expect((await req('GET', '/api/voice/voices?provider=elevenlabs')).status).toBe(422);
    process.env.ELEVENLABS_API_KEY = 'xi-boa-chave-0000000000001234';
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return Response.json({
        voices: [
          {
            voice_id: 'EXAV',
            name: 'Sarah - Mature, Reassuring, Confident',
            category: 'premade',
            preview_url: 'https://cdn.example/sarah.mp3',
            labels: { gender: 'female', age: 'young', accent: 'american', descriptive: 'confident', use_case: 'entertainment_tv', language: 'en' },
          },
          { voice_id: 'MINE', name: 'Minha voz', category: 'cloned', labels: {} },
        ],
        has_more: false,
      });
    });
    const eleven = await (await req('GET', '/api/voice/voices?provider=elevenlabs')).json();
    expect(eleven.voices).toEqual([
      { id: 'MINE', name: 'Minha voz', description: '', category: 'cloned' },
      {
        id: 'EXAV',
        name: 'Sarah',
        description: 'feminina · jovem · americana · confiante · entretenimento',
        previewUrl: 'https://cdn.example/sarah.mp3',
        language: 'en',
        category: 'premade',
      },
    ]);
    await req('GET', '/api/voice/voices?provider=elevenlabs');
    expect(calls).toBe(1); // em cache
  });

  it('amostra: gera uma vez com a voz escolhida e reaproveita', async () => {
    process.env.OPENAI_API_KEY = 'sk-teste-000000000000000000';
    const bodies: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const a = await req('POST', '/api/voice/preview', { provider: 'openai', voice: 'nova', language: 'pt' });
    expect(a.status).toBe(200);
    expect(a.headers.get('content-type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await a.arrayBuffer())]).toEqual([1, 2, 3]);
    await req('POST', '/api/voice/preview', { provider: 'openai', voice: 'nova', language: 'pt' });
    expect(bodies).toHaveLength(1); // sem transcrição e sem pagar de novo
    expect(bodies[0]).toMatchObject({ voice: 'nova', input: expect.stringContaining('Olá') });
    expect((await req('POST', '/api/voice/preview', { provider: 'elevenlabs' })).status).toBe(400);
  });

  it('tts com ElevenLabs exige a voz', async () => {
    const res = await req('POST', '/api/projects/v/tts', { text: 'Oi.', provider: 'elevenlabs' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/escolha uma voz/);
  });
});
