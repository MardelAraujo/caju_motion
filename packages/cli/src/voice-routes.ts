import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findVideoFile } from '@caju-motion/sdk';
import { createProjectStore, ProjectStoreError, type ApiExtension } from '@caju-motion/server';
import {
  addCaptions,
  addVoiceover,
  captionCount,
  checkApiKey,
  DEFAULT_PROVIDER,
  ELEVENLABS_MODELS,
  elevenLabsTts,
  elevenLabsVoices,
  engineNames,
  KEY_ENV,
  OPENAI_TTS_MODELS,
  OPENAI_VOICES,
  openAiTts,
  plausibleKey,
  previewText,
  providerByName,
  sttByName,
  transcription,
  voiceover,
  voiceoverStartSec,
  voiceStudioTts,
  voiceStudioUrl,
  voiceStudioVoices,
  type KeyProvider,
  type TtsProvider,
  type VoiceInfo,
} from '@caju-motion/voice';
import { setDotEnvValue } from './env';

export type VoiceRoutesOptions = {
  /** `.env` onde o Studio grava as chaves. Padrão: o da pasta atual (o mesmo que o `caju` lê). */
  envFile?: string;
  /** Pasta das amostras de voz geradas (cache). Padrão: `<tmp>/caju-voice-previews`. */
  previewDir?: string;
};

const KEY_PROVIDERS: KeyProvider[] = ['openai', 'elevenlabs'];
const keyOf = (p: KeyProvider) => process.env[KEY_ENV[p]]?.trim() || undefined;
/** Só o fim da chave, para a pessoa reconhecer qual está configurada. */
const hint = (key: string | undefined) => (key ? `…${key.slice(-4)}` : null);

/**
 * Rotas que mexem em chaves ou gastam créditos só aceitam o próprio computador, vindas do próprio
 * Studio: o servidor escuta em todas as interfaces e um site qualquer poderia mandar um POST.
 */
function assertLocal(c: {
  req: { url: string; header(name: string): string | undefined };
  env?: unknown;
}): void {
  const host = (c.req.header('host') ?? new URL(c.req.url).host).toLowerCase();
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) throw new ProjectStoreError('disponível só em localhost', 403);
  const origin = c.req.header('origin');
  if (origin && origin !== 'null') {
    let originHost = '';
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      // origem ilegível: recusa abaixo
    }
    if (originHost !== host) throw new ProjectStoreError('origem não permitida', 403);
  } else if (origin === 'null') throw new ProjectStoreError('origem não permitida', 403);
  const remote = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress;
  if (remote && !/^(127\.|::1$|::ffff:127\.)/.test(remote)) throw new ProjectStoreError('disponível só neste computador', 403);
  // JSON obriga o navegador a pedir permissão (preflight) antes de um POST de outro site
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) throw new ProjectStoreError('envie JSON', 415);
}

/**
 * Voz no Studio (extensão da API). O servidor gera os arquivos e edita o project.json como o
 * `caju tts`/`caju transcribe` (com a versão aberta pelo cliente: 409 se o disco mudou); o Studio
 * salva antes e recarrega depois.
 * - `GET  /api/voice` → provedor padrão, estado do VoiceStudio, chaves configuradas (só o fim) e modelos
 * - `GET  /api/voice/voices?provider=` → vozes do provedor (nome, descrição, amostra)
 * - `POST /api/voice/preview` `{ provider, voice, model?, language? }` → amostra curta (áudio, com cache)
 * - `PUT  /api/voice/keys` `{ openai?: string|null, elevenlabs?: string|null }` → testa e grava no `.env`
 * - `POST /api/projects/:id/tts` `{ text, name?, provider?, voice?, model?, seed?, speed?, language?, startSec?, captions? }`
 * - `POST /api/projects/:id/transcribe` `{ src, name?, provider?, language?, offsetSec? }` (legendas de um asset)
 */
export function voiceRoutes(opts: VoiceRoutesOptions = {}): ApiExtension {
  const envFile = () => opts.envFile ?? path.join(process.cwd(), '.env');
  const previewDir = opts.previewDir ?? path.join(os.tmpdir(), 'caju-voice-previews');
  /** Vozes da ElevenLabs por chave, por alguns minutos (a lista muda pouco). */
  let elevenCache: { key: string; at: number; voices: VoiceInfo[] } | undefined;

  return (app, { projectsDir }) => {
    const store = createProjectStore(projectsDir);

    app.get('/voice', async (c) => {
      const keys = { openai: !!keyOf('openai'), elevenlabs: !!keyOf('elevenlabs') };
      const keyHints = { openai: hint(keyOf('openai')), elevenlabs: hint(keyOf('elevenlabs')) };
      const base = { defaultProvider: DEFAULT_PROVIDER, keys, keyHints, envFile: envFile(), models: { openai: OPENAI_TTS_MODELS, elevenlabs: ELEVENLABS_MODELS } };
      try {
        const cat = await voiceStudioVoices({ signal: AbortSignal.timeout(2500) });
        return c.json({
          ...base,
          voicestudio: { ok: true, url: cat.url, engines: engineNames(cat.engines), voices: cat.voices.filter((v) => v.type === 'profile') },
        });
      } catch (err) {
        return c.json({ ...base, voicestudio: { ok: false, url: voiceStudioUrl(), error: (err as Error).message } });
      }
    });

    app.get('/voice/voices', async (c) => {
      const provider = c.req.query('provider') ?? DEFAULT_PROVIDER;
      if (provider === 'openai') return c.json({ provider, voices: OPENAI_VOICES });
      if (provider === 'elevenlabs') {
        const key = keyOf('elevenlabs');
        if (!key) throw new ProjectStoreError('configure a chave da ElevenLabs', 422);
        const fresh = elevenCache && elevenCache.key === key && Date.now() - elevenCache.at < 5 * 60_000 && c.req.query('refresh') !== '1';
        if (!fresh) {
          const voices = await providerCall(() => elevenLabsVoices({ apiKey: key, signal: AbortSignal.timeout(15_000) }));
          elevenCache = { key, at: Date.now(), voices };
        }
        return c.json({ provider, voices: elevenCache!.voices });
      }
      if (provider === 'voicestudio') {
        const cat = await providerCall(() => voiceStudioVoices({ signal: AbortSignal.timeout(5000) }));
        const voices: VoiceInfo[] = cat.voices
          .filter((v) => v.type === 'profile')
          .map((v) => ({ id: v.id, name: v.name, description: 'perfil do VoiceStudio', ...(v.language ? { language: v.language } : {}), category: 'profile' }));
        return c.json({ provider, voices });
      }
      if (provider === 'placeholder') return c.json({ provider, voices: [] });
      throw new ProjectStoreError(`provedor desconhecido: ${provider}`, 400);
    });

    app.post('/voice/preview', async (c) => {
      assertLocal(c);
      const b = await body<Record<string, unknown>>(c);
      const provider = str(b.provider);
      const voice = str(b.voice);
      const model = str(b.model);
      const language = str(b.language);
      if (!provider || !['openai', 'elevenlabs', 'voicestudio'].includes(provider)) throw new ProjectStoreError('campo "provider" inválido', 400);
      if (provider !== 'voicestudio' && !voice) throw new ProjectStoreError('campo "voice" obrigatório', 400);
      const text = previewText(language);
      // a mesma amostra não é paga duas vezes (a chave entra no hash: trocar de conta gera de novo)
      const id = createHash('sha256')
        .update(JSON.stringify([provider, voice ?? '', model ?? '', language ?? '', text, provider === 'voicestudio' ? '' : hint(keyOf(provider as KeyProvider))]))
        .digest('hex')
        .slice(0, 20);
      const file = path.join(previewDir, `${id}.mp3`);
      if (!existsSync(file)) {
        const tts: TtsProvider =
          provider === 'openai'
            ? openAiTts({ voice, model, alignWords: false })
            : provider === 'elevenlabs'
              ? elevenLabsTts({ voiceId: voice, modelId: model })
              : voiceStudioTts({ voice, engine: model, alignWords: false });
        const res = await providerCall(() => tts.synthesize({ text, format: 'mp3', language, signal: AbortSignal.timeout(60_000) }));
        await mkdir(previewDir, { recursive: true });
        await writeFile(file, res.audio);
      }
      return new Response(new Uint8Array(await readFile(file)), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
    });

    app.put('/voice/keys', async (c) => {
      assertLocal(c);
      const b = await body<Record<string, unknown>>(c);
      const result: Record<string, { configured: boolean; hint: string | null; warning?: string }> = {};
      for (const p of KEY_PROVIDERS) {
        if (!(p in b)) continue;
        const v = b[p];
        if (v === null || v === '') {
          await setDotEnvValue(envFile(), KEY_ENV[p], null);
          delete process.env[KEY_ENV[p]];
          if (p === 'elevenlabs') elevenCache = undefined;
          result[p] = { configured: false, hint: null };
          continue;
        }
        if (typeof v !== 'string' || !plausibleKey(v.trim())) throw new ProjectStoreError(`chave ${p === 'openai' ? 'da OpenAI' : 'da ElevenLabs'} com formato inválido`, 400);
        const key = v.trim();
        const check = await checkApiKey(p, key, { signal: AbortSignal.timeout(15_000) });
        if (!check.ok) throw new ProjectStoreError(`${p === 'openai' ? 'OpenAI' : 'ElevenLabs'}: ${check.error}`, 422);
        await setDotEnvValue(envFile(), KEY_ENV[p], key);
        process.env[KEY_ENV[p]] = key;
        if (p === 'elevenlabs') elevenCache = undefined;
        result[p] = { configured: true, hint: hint(key), ...(check.warning ? { warning: check.warning } : {}) };
      }
      if (!Object.keys(result).length) throw new ProjectStoreError('informe "openai" e/ou "elevenlabs"', 400);
      return c.json(result);
    });

    app.post('/projects/:id/tts', async (c) => {
      const id = c.req.param('id');
      const projectDir = await store.dir(id);
      const b = await body<Record<string, unknown>>(c);
      const text = str(b.text);
      if (!text) throw new ProjectStoreError('campo "text" obrigatório', 400);
      const name = str(b.name) ?? 'locucao';
      const providerName = str(b.provider) ?? DEFAULT_PROVIDER;
      const voice = str(b.voice);
      if (providerName === 'elevenlabs' && !voice) throw new ProjectStoreError('escolha uma voz da ElevenLabs', 400);
      const provider = await providerCall(async () => providerByName(providerName, { voice, model: str(b.model), seed: num(b.seed) }));
      const vo = await providerCall(() =>
        voiceover({ projectDir, name, text, provider, voice, speed: num(b.speed) || undefined, language: str(b.language) }),
      );
      const result = { audioSrc: vo.audioSrc, durationSec: vo.durationSec, timed: vo.timed, cached: vo.cached, cues: vo.cues.length, parts: vo.parts, warnings: vo.warnings };
      if (findVideoFile(projectDir)) return c.json({ ...result, filesOnly: true });
      let project = await store.read(id);
      project = addVoiceover(project, vo, { assetId: name, startSec: num(b.startSec) });
      if (b.captions !== false) project = addCaptions(project, vo.cues, { prefix: `${name}-legenda`, offsetSec: voiceoverStartSec(project, name) ?? 0 });
      await store.write(id, project, new Date(), c.req.header('x-caju-base'));
      c.header('x-caju-version', await store.version(id));
      return c.json({ ...result, captionsAdded: b.captions !== false ? captionCount(project, `${name}-legenda`) : 0, filesOnly: false });
    });

    app.post('/projects/:id/transcribe', async (c) => {
      const id = c.req.param('id');
      const projectDir = await store.dir(id);
      const b = await body<Record<string, unknown>>(c);
      const src = str(b.src);
      if (!src || src.includes('..') || /^[a-z]+:/i.test(src)) throw new ProjectStoreError('campo "src" (asset do projeto) inválido', 400);
      const name = str(b.name) ?? src.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-');
      const provider = await providerCall(async () => sttByName(str(b.provider) ?? DEFAULT_PROVIDER));
      const tr = await providerCall(() => transcription({ projectDir, name, file: src, provider, language: str(b.language) }));
      const result = { wordsSrc: tr.wordsSrc, srtSrc: tr.srtSrc, cues: tr.cues.length, cached: tr.cached };
      if (findVideoFile(projectDir)) return c.json({ ...result, filesOnly: true });
      const project = addCaptions(await store.read(id), tr.cues, { prefix: `${name}-legenda`, offsetSec: num(b.offsetSec) ?? 0 });
      await store.write(id, project, new Date(), c.req.header('x-caju-base'));
      c.header('x-caju-version', await store.version(id));
      return c.json({ ...result, captionsAdded: captionCount(project, `${name}-legenda`), filesOnly: false });
    });
  };
}

const body = async <T>(c: { req: { json(): Promise<unknown> } }): Promise<T> =>
  (await c.req.json().catch(() => {
    throw new ProjectStoreError('corpo não é JSON válido', 400);
  })) as T;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
/** Erro do provedor (fechado, voz inválida, sem chave) é do pedido, não do servidor. */
async function providerCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ProjectStoreError) throw err;
    throw new ProjectStoreError((err as Error).message, 422);
  }
}
