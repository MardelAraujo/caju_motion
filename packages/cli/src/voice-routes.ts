import { findVideoFile } from '@caju-motion/sdk';
import { createProjectStore, ProjectStoreError, type ApiExtension } from '@caju-motion/server';
import {
  addCaptions,
  addVoiceover,
  captionCount,
  DEFAULT_PROVIDER,
  engineNames,
  providerByName,
  sttByName,
  transcription,
  voiceover,
  voiceoverStartSec,
  voiceStudioUrl,
  voiceStudioVoices,
} from '@caju-motion/voice';

/**
 * Voz no Studio (extensão da API). O servidor gera os arquivos e edita o project.json como o
 * `caju tts`/`caju transcribe` (com a versão aberta pelo cliente: 409 se o disco mudou); o Studio
 * salva antes e recarrega depois.
 * - `GET  /api/voice` → provedor padrão, estado do VoiceStudio (engines, perfis) e chaves configuradas
 * - `POST /api/projects/:id/tts` `{ text, name?, provider?, voice?, model?, seed?, speed?, language?, startSec?, captions? }`
 * - `POST /api/projects/:id/transcribe` `{ src, name?, provider?, language?, offsetSec? }` (legendas de um asset)
 */
export function voiceRoutes(): ApiExtension {
  return (app, { projectsDir }) => {
    const store = createProjectStore(projectsDir);

    app.get('/voice', async (c) => {
      const keys = { openai: !!process.env.OPENAI_API_KEY?.trim(), elevenlabs: !!process.env.ELEVENLABS_API_KEY?.trim() };
      try {
        const cat = await voiceStudioVoices({ signal: AbortSignal.timeout(2500) });
        return c.json({
          defaultProvider: DEFAULT_PROVIDER,
          keys,
          voicestudio: { ok: true, url: cat.url, engines: engineNames(cat.engines), voices: cat.voices.filter((v) => v.type === 'profile') },
        });
      } catch (err) {
        return c.json({ defaultProvider: DEFAULT_PROVIDER, keys, voicestudio: { ok: false, url: voiceStudioUrl(), error: (err as Error).message } });
      }
    });

    const body = async <T>(c: { req: { json(): Promise<unknown> } }): Promise<T> =>
      (await c.req.json().catch(() => {
        throw new ProjectStoreError('corpo não é JSON válido', 400);
      })) as T;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
    /** Erro do provedor (fechado, voz inválida, sem chave) é do pedido, não do servidor. */
    const providerCall = async <T>(run: () => Promise<T>): Promise<T> => {
      try {
        return await run();
      } catch (err) {
        if (err instanceof ProjectStoreError) throw err;
        throw new ProjectStoreError((err as Error).message, 422);
      }
    };

    app.post('/projects/:id/tts', async (c) => {
      const id = c.req.param('id');
      const projectDir = await store.dir(id);
      const b = await body<Record<string, unknown>>(c);
      const text = str(b.text);
      if (!text) throw new ProjectStoreError('campo "text" obrigatório', 400);
      const name = str(b.name) ?? 'locucao';
      const providerName = str(b.provider) ?? DEFAULT_PROVIDER;
      const voice = str(b.voice);
      const provider = await providerCall(async () => providerByName(providerName, { voice, model: str(b.model), seed: num(b.seed) }));
      const vo = await providerCall(() =>
        voiceover({ projectDir, name, text, provider, voice, speed: num(b.speed) || undefined, language: str(b.language) }),
      );
      const result = { audioSrc: vo.audioSrc, durationSec: vo.durationSec, timed: vo.timed, cached: vo.cached, cues: vo.cues.length };
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
