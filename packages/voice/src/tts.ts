import { alignScript, estimateWords, round, type Word } from './captions';
import { env, failure, type FetchLike } from './http';
import { openAiStt, type SttProvider } from './stt';
import { voiceStudioStt, voiceStudioTts } from './voicestudio';

/**
 * Locução gerada (TTS) com provedores plugáveis. Cada provedor devolve o áudio e, quando sabe,
 * os tempos de cada palavra (para legendas exatas). Custos e chaves são do usuário.
 */

export type AudioFormat = 'mp3' | 'wav';

export type TtsRequest = {
  text: string;
  /** Voz do provedor (ex.: `alloy` na OpenAI, o voice_id na ElevenLabs). */
  voice?: string;
  format?: AudioFormat;
  /** Velocidade (1 = normal), se o provedor aceitar. */
  speed?: number;
  /** Instruções de estilo (ex.: "tom animado, ritmo de reel"), se o provedor aceitar. */
  instructions?: string;
  /** Idioma (ISO 639-1, ex.: `pt`), usado no alinhamento por transcrição. */
  language?: string;
  signal?: AbortSignal;
};

export type TtsResult = {
  audio: Uint8Array;
  format: AudioFormat;
  /** Tempos por palavra, com o texto do roteiro. Ausente: estime com `estimateWords`. */
  words?: Word[];
  /** `words` são estimativas (ex.: voz provisória), não tempos medidos no áudio. */
  estimated?: boolean;
};

export type TtsProvider = {
  /** Identifica provedor + voz + modelo (entra na chave de cache: trocar a voz gera de novo). */
  readonly id: string;
  synthesize(req: TtsRequest): Promise<TtsResult>;
};

// ---------------------------------------------------------------- OpenAI

export type OpenAiTtsOptions = {
  /** Padrão: `OPENAI_API_KEY`. */
  apiKey?: string;
  /** Padrão `gpt-4o-mini-tts`. */
  model?: string;
  /** Padrão `alloy`. */
  voice?: string;
  /**
   * Tempos por palavra transcrevendo o áudio gerado (Whisper, `timestamp_granularities=word`) e
   * alinhando com o roteiro. Custa uma chamada extra de transcrição. Padrão true.
   */
  alignWords?: boolean;
  /** Padrão `whisper-1`. */
  transcriptionModel?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

export function openAiTts(opts: OpenAiTtsOptions = {}): TtsProvider {
  const model = opts.model ?? 'gpt-4o-mini-tts';
  const voice = opts.voice ?? 'alloy';
  const base = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const doFetch = opts.fetch ?? fetch;
  const key = () => {
    const k = opts.apiKey ?? env('OPENAI_API_KEY');
    if (!k) throw new Error('OpenAI TTS: defina OPENAI_API_KEY (ou passe apiKey)');
    return k;
  };
  return {
    id: `openai:${model}:${voice}`,
    async synthesize(req) {
      const format = req.format ?? 'mp3';
      const apiKey = key();
      const res = await doFetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          voice: req.voice ?? voice,
          input: req.text,
          response_format: format,
          ...(req.speed ? { speed: req.speed } : {}),
          ...(req.instructions ? { instructions: req.instructions } : {}),
        }),
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, 'OpenAI TTS');
      const audio = new Uint8Array(await res.arrayBuffer());
      if (opts.alignWords === false) return { audio, format };

      const tr = await openAiStt({ apiKey, model: opts.transcriptionModel, baseUrl: base, fetch: doFetch }).transcribe({
        audio,
        filename: `speech.${format}`,
        language: req.language,
        signal: req.signal,
      });
      const timed = tr.words;
      return { audio, format, words: timed.length ? alignScript(req.text, timed) : undefined };
    },
  };
}

// ---------------------------------------------------------------- ElevenLabs

export type ElevenLabsTtsOptions = {
  /** Padrão: `ELEVENLABS_API_KEY`. */
  apiKey?: string;
  /** voice_id da ElevenLabs (obrigatório aqui ou em cada pedido). */
  voiceId?: string;
  /** Padrão `eleven_multilingual_v2`. */
  modelId?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

/** Palavras a partir do alinhamento por caractere da ElevenLabs (`/with-timestamps`). */
export function wordsFromCharacters(chars: string[], starts: number[], ends: number[]): Word[] {
  const words: Word[] = [];
  let text = '';
  let start = 0;
  let end = 0;
  const push = () => {
    if (text) words.push({ text, start: round(start), end: round(end) });
    text = '';
  };
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) return push();
    if (!text) start = starts[i]!;
    text += ch;
    end = ends[i]!;
  });
  push();
  return words;
}

export function elevenLabsTts(opts: ElevenLabsTtsOptions = {}): TtsProvider {
  const modelId = opts.modelId ?? 'eleven_multilingual_v2';
  const base = (opts.baseUrl ?? 'https://api.elevenlabs.io/v1').replace(/\/$/, '');
  const doFetch = opts.fetch ?? fetch;
  return {
    id: `elevenlabs:${modelId}:${opts.voiceId ?? ''}`,
    async synthesize(req) {
      if ((req.format ?? 'mp3') !== 'mp3') throw new Error('ElevenLabs: só mp3 por aqui');
      const apiKey = opts.apiKey ?? env('ELEVENLABS_API_KEY');
      if (!apiKey) throw new Error('ElevenLabs TTS: defina ELEVENLABS_API_KEY (ou passe apiKey)');
      const voiceId = req.voice ?? opts.voiceId;
      if (!voiceId) throw new Error('ElevenLabs TTS: informe a voz (voice_id)');
      const res = await doFetch(`${base}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          text: req.text,
          model_id: modelId,
          ...(req.speed ? { voice_settings: { speed: req.speed } } : {}),
          ...(req.language ? { language_code: req.language } : {}),
        }),
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, 'ElevenLabs TTS');
      const data = (await res.json()) as {
        audio_base64: string;
        alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
      };
      const audio = base64ToBytes(data.audio_base64);
      const a = data.alignment;
      const words = a ? wordsFromCharacters(a.characters, a.character_start_times_seconds, a.character_end_times_seconds) : undefined;
      return { audio, format: 'mp3', words };
    },
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- falso (testes, rascunho)

/**
 * Provedor local e grátis: gera um WAV com um tom baixo na duração estimada da fala (~14 caracteres/s)
 * e tempos estimados. Serve para montar e cronometrar o vídeo antes de pagar pela voz de verdade.
 */
export function placeholderTts({ charsPerSecond = 14, sampleRate = 16_000 } = {}): TtsProvider {
  return {
    id: `placeholder:${charsPerSecond}`,
    async synthesize(req) {
      const durationSec = Math.max(0.5, Math.round((req.text.length / charsPerSecond / (req.speed ?? 1)) * 100) / 100);
      return {
        audio: toneWav(durationSec, sampleRate),
        format: 'wav',
        words: estimateWords(req.text, durationSec),
        estimated: true,
      };
    },
  };
}

/** WAV PCM 16 bits mono com um tom suave de 220 Hz (audível, mas obviamente provisório). */
export function toneWav(durationSec: number, sampleRate = 16_000): Uint8Array {
  const n = Math.round(durationSec * sampleRate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.1 * 32767), true);
  return new Uint8Array(buf);
}

export type ProviderName = 'voicestudio' | 'openai' | 'elevenlabs' | 'placeholder';

/** Provedor padrão: o VoiceStudio, local e gratuito. */
export const DEFAULT_PROVIDER: ProviderName = 'voicestudio';

/** Provedor pelo nome (CLI). Em `voicestudio`, `model` é o engine. */
export function providerByName(name: ProviderName | string, opts: { voice?: string; model?: string; seed?: number } = {}): TtsProvider {
  switch (name) {
    case 'voicestudio':
      return voiceStudioTts({ voice: opts.voice, engine: opts.model, seed: opts.seed });
    case 'openai':
      return openAiTts({ voice: opts.voice, model: opts.model });
    case 'elevenlabs':
      return elevenLabsTts({ voiceId: opts.voice, modelId: opts.model });
    case 'placeholder':
      return placeholderTts();
    default:
      throw new Error(`provedor de voz desconhecido: ${name} (use voicestudio, openai, elevenlabs ou placeholder)`);
  }
}

/** Transcritor pelo nome (CLI): `voicestudio` (padrão, local) ou `openai` (Whisper, pago). */
export function sttByName(name: string = DEFAULT_PROVIDER, opts: { model?: string } = {}): SttProvider {
  switch (name) {
    case 'voicestudio':
      return voiceStudioStt({ model: opts.model });
    case 'openai':
      return openAiStt({ model: opts.model });
    default:
      throw new Error(`transcrição: provedor desconhecido: ${name} (use voicestudio ou openai)`);
  }
}
