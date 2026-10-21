import { round, type Word } from './captions';
import { env, failure, mimeOf, type FetchLike } from './http';

/**
 * Transcrição (fala → texto com tempo por palavra). Serve para legendar áudio que não veio do
 * `caju tts` (talking-head, podcast, locução gravada) e para medir os tempos da voz gerada.
 */

export type SttRequest = {
  audio: Uint8Array;
  /** Nome do arquivo (a extensão define o tipo enviado). */
  filename: string;
  /** Idioma (ISO 639-1, ex.: `pt`). Ausente: o provedor detecta. */
  language?: string;
  signal?: AbortSignal;
};

export type SttResult = {
  words: Word[];
  text: string;
  language?: string;
  durationSec?: number;
};

export type SttProvider = {
  readonly id: string;
  transcribe(req: SttRequest): Promise<SttResult>;
};

type CompatibleSttOptions = {
  label: string;
  /** Base com o `/v1` (ex.: `https://api.openai.com/v1`). */
  base: string;
  model: string;
  /** Chave no momento da chamada; `undefined` = sem `authorization`. */
  apiKey: () => string | undefined;
  fetch: FetchLike;
  /** Embrulha o fetch (ex.: erro legível quando o servidor local está fechado). */
  send?: (url: string, init: RequestInit) => Promise<Response>;
};

/** Transcrição no formato da API da OpenAI (`/audio/transcriptions`, `verbose_json`, palavras). */
export function compatibleStt(o: CompatibleSttOptions): SttProvider {
  const send = o.send ?? ((url, init) => o.fetch(url, init));
  return {
    id: `${o.label}:${o.model}`,
    async transcribe(req) {
      const form = new FormData();
      form.append('file', new Blob([req.audio.slice()], { type: mimeOf(req.filename) }), req.filename);
      form.append('model', o.model);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      if (req.language) form.append('language', req.language);
      const key = o.apiKey();
      const res = await send(`${o.base}/audio/transcriptions`, {
        method: 'POST',
        headers: key ? { authorization: `Bearer ${key}` } : {},
        body: form,
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, `${o.label} (transcrição)`);
      const data = (await res.json()) as {
        text?: string;
        language?: string;
        duration?: number;
        words?: { word: string; start: number; end: number }[];
      };
      const words = (data.words ?? [])
        .map((w) => ({ text: w.word.trim(), start: round(w.start), end: round(w.end) }))
        .filter((w) => w.text);
      return { words, text: (data.text ?? words.map((w) => w.text).join(' ')).trim(), language: data.language, durationSec: data.duration };
    },
  };
}

export type OpenAiSttOptions = {
  /** Padrão: `OPENAI_API_KEY`. */
  apiKey?: string;
  /** Padrão `whisper-1`. */
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
  /** Nome nas mensagens de erro. */
  label?: string;
};

export function openAiStt(opts: OpenAiSttOptions = {}): SttProvider {
  return compatibleStt({
    label: opts.label ?? 'OpenAI',
    base: (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: opts.model ?? 'whisper-1',
    fetch: opts.fetch ?? fetch,
    apiKey: () => {
      const k = opts.apiKey ?? env('OPENAI_API_KEY');
      if (!k) throw new Error('OpenAI (transcrição): defina OPENAI_API_KEY (ou passe apiKey)');
      return k;
    },
  });
}
