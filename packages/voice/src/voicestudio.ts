import { alignScript } from './captions';
import { env, failure, type FetchLike } from './http';
import { compatibleStt, type SttProvider } from './stt';
import type { TtsProvider } from './tts';

/**
 * VoiceStudio (https://github.com/debpalash/VoiceStudio): estúdio de voz local e gratuito (TTS,
 * clonagem, desenho de voz, transcrição), com API compatível com a da OpenAI na porta 3900.
 * O Caju só conversa por HTTP: o VoiceStudio é instalado e aberto pelo usuário, à parte.
 */

export const VOICESTUDIO_DEFAULT_URL = 'http://127.0.0.1:3900';
/** Limite de caracteres por pedido de fala no VoiceStudio. */
export const VOICESTUDIO_MAX_INPUT = 4096;

export type VoiceStudioOptions = {
  /** Padrão: `VOICESTUDIO_URL` ou `http://127.0.0.1:3900`. */
  baseUrl?: string;
  /** Só fora do próprio computador. Padrão: `VOICESTUDIO_API_KEY`. */
  apiKey?: string;
  fetch?: FetchLike;
};

/** URL base sem barra final e sem `/v1`. */
export function voiceStudioUrl(baseUrl?: string): string {
  return (baseUrl ?? env('VOICESTUDIO_URL') ?? VOICESTUDIO_DEFAULT_URL).trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

export const VOICESTUDIO_OFFLINE_HINT =
  'abra o app VoiceStudio (Windows: irm https://voicestudio.sh/install | iex; ou Docker: ghcr.io/debpalash/voicestudio) ' +
  'ou use outro provedor: --provider placeholder (grátis, provisório), openai ou elevenlabs';

function client(opts: VoiceStudioOptions) {
  const root = voiceStudioUrl(opts.baseUrl);
  const doFetch = opts.fetch ?? fetch;
  const apiKey = () => opts.apiKey ?? env('VOICESTUDIO_API_KEY');
  /** fetch com erro legível quando o VoiceStudio está fechado (sem mascarar cancelamento). */
  const send = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const key = apiKey();
    const headers = { ...(init.headers as Record<string, string> | undefined), ...(key ? { authorization: `Bearer ${key}` } : {}) };
    try {
      return await doFetch(url, { ...init, headers });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || init.signal?.aborted) throw err;
      throw new Error(`VoiceStudio não respondeu em ${root} — ${VOICESTUDIO_OFFLINE_HINT}`, { cause: err });
    }
  };
  return { root, base: `${root}/v1`, doFetch, apiKey, send };
}

export type VoiceStudioTtsOptions = VoiceStudioOptions & {
  /** Engine (`model` da API): `omnivoice` (padrão), `cosyvoice`, `voxcpm2`, `kittentts`… */
  engine?: string;
  /** Perfil de voz (id ou nome, criado/clonado no app). Padrão: a voz padrão do engine. */
  voice?: string;
  /** Semente fixa: a mesma fala sai igual ao gerar de novo. */
  seed?: number;
  /** Tempos por palavra transcrevendo o áudio gerado no próprio VoiceStudio (local, sem custo). Padrão true. */
  alignWords?: boolean;
};

export function voiceStudioTts(opts: VoiceStudioTtsOptions = {}): TtsProvider {
  const engine = opts.engine ?? 'omnivoice';
  const voice = opts.voice ?? 'default';
  const c = client(opts);
  const stt = voiceStudioStt(opts);
  return {
    id: `voicestudio:${engine}:${voice}${opts.seed !== undefined ? `:${opts.seed}` : ''}`,
    async synthesize(req) {
      if (req.text.length > VOICESTUDIO_MAX_INPUT) {
        throw new Error(
          `VoiceStudio: o texto tem ${req.text.length} caracteres (máximo ${VOICESTUDIO_MAX_INPUT}); divida em blocos com --name diferentes`,
        );
      }
      const format = req.format ?? 'mp3';
      const res = await c.send(`${c.base}/audio/speech`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: engine,
          voice: req.voice ?? voice,
          input: req.text,
          response_format: format,
          ...(req.speed ? { speed: req.speed } : {}),
          ...(req.instructions ? { instructions: req.instructions } : {}),
          ...(req.language ? { language: req.language } : {}),
          ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        }),
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, 'VoiceStudio');
      const audio = new Uint8Array(await res.arrayBuffer());
      if (opts.alignWords === false) return { audio, format };
      const tr = await stt.transcribe({ audio, filename: `speech.${format}`, language: req.language, signal: req.signal });
      return { audio, format, words: tr.words.length ? alignScript(req.text, tr.words) : undefined };
    },
  };
}

export type VoiceStudioSttOptions = VoiceStudioOptions & {
  /** Modelo de ASR. `whisper-1` = o engine ativo no app (WhisperX por padrão). */
  model?: string;
};

export function voiceStudioStt(opts: VoiceStudioSttOptions = {}): SttProvider {
  const c = client(opts);
  // a autorização entra no `send`; aqui o transcritor não põe a sua
  return compatibleStt({ label: 'VoiceStudio', base: c.base, model: opts.model ?? 'whisper-1', fetch: c.doFetch, apiKey: () => undefined, send: c.send });
}

export type VoiceStudioVoice = { id: string; name: string; type: 'openai_alias' | 'profile' | string; language?: string | null };
export type VoiceStudioCatalog = { url: string; voices: VoiceStudioVoice[]; engines: unknown };

/** Vozes (perfis do app + apelidos OpenAI) e engines instalados: `GET /v1/audio/voices`. */
export async function voiceStudioVoices(opts: VoiceStudioOptions & { signal?: AbortSignal } = {}): Promise<VoiceStudioCatalog> {
  const c = client(opts);
  const res = await c.send(`${c.base}/audio/voices`, { signal: opts.signal });
  if (!res.ok) throw await failure(res, 'VoiceStudio');
  const data = (await res.json()) as { voices?: (VoiceStudioVoice & { voice_id?: string })[]; engines?: unknown };
  const voices = (data.voices ?? []).map((v) => ({ id: v.id ?? v.voice_id ?? v.name, name: v.name, type: v.type, language: v.language }));
  return { url: c.root, voices, engines: data.engines ?? [] };
}

/** Nomes dos engines, aceitando os formatos que o VoiceStudio já usou (lista de strings ou de objetos). */
export function engineNames(engines: unknown): string[] {
  if (!Array.isArray(engines)) return [];
  return engines
    .map((e) => (typeof e === 'string' ? e : (e as { id?: string; name?: string })?.id ?? (e as { name?: string })?.name))
    .filter((e): e is string => !!e);
}
