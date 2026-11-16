import { env, failure, type FetchLike } from './http';

/**
 * Catálogo de vozes por provedor, num formato só (para o Studio mostrar e deixar escolher), e
 * verificação de chaves de API. As descrições da OpenAI são nossas (a API não descreve as vozes);
 * as da ElevenLabs vêm dos rótulos da própria conta, traduzidos.
 */

export type VoiceProviderId = 'voicestudio' | 'openai' | 'elevenlabs' | 'placeholder';

export type VoiceInfo = {
  id: string;
  name: string;
  /** Como ela é, em poucas palavras (ex.: "feminina · jovem · americana · animada"). */
  description: string;
  /** Amostra pronta e grátis (ElevenLabs). Sem ela, o Studio gera uma amostra curta sob demanda. */
  previewUrl?: string;
  /** Idioma principal (ISO 639-1), quando o provedor informa. */
  language?: string;
  /** premade, cloned, generated, professional, profile… */
  category?: string;
  /** Só funciona com estes modelos (ausente: todos). */
  models?: string[];
};

export type VoiceModel = { id: string; label: string; description: string };

// ---------------------------------------------------------------- OpenAI

/** Modelos de fala da OpenAI; o primeiro é o padrão do `caju tts`. */
export const OPENAI_TTS_MODELS: VoiceModel[] = [
  { id: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts', description: 'mais natural, aceita todas as vozes' },
  { id: 'tts-1', label: 'tts-1', description: 'rápido e barato' },
  { id: 'tts-1-hd', label: 'tts-1-hd', description: 'mais nítido que o tts-1' },
];

const MINI = ['gpt-4o-mini-tts'];

/** Vozes da OpenAI (a API não tem lista nem amostras: descrições aproximadas, ouça a amostra). */
export const OPENAI_VOICES: VoiceInfo[] = [
  { id: 'alloy', name: 'Alloy', description: 'neutra · equilibrada · versátil' },
  { id: 'ash', name: 'Ash', description: 'masculina · clara · expressiva' },
  { id: 'ballad', name: 'Ballad', description: 'masculina · suave · melódica', models: MINI },
  { id: 'coral', name: 'Coral', description: 'feminina · calorosa · amigável' },
  { id: 'echo', name: 'Echo', description: 'masculina · calma · ponderada' },
  { id: 'fable', name: 'Fable', description: 'masculina · narrador · sotaque britânico' },
  { id: 'nova', name: 'Nova', description: 'feminina · jovem · enérgica' },
  { id: 'onyx', name: 'Onyx', description: 'masculina · grave · firme' },
  { id: 'sage', name: 'Sage', description: 'feminina · serena · ponderada' },
  { id: 'shimmer', name: 'Shimmer', description: 'feminina · clara · suave' },
  { id: 'verse', name: 'Verse', description: 'masculina · versátil · expressiva', models: MINI },
].map((v) => ({ ...v, category: 'premade' }));

// ---------------------------------------------------------------- ElevenLabs

export const ELEVENLABS_MODELS: VoiceModel[] = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'melhor qualidade, 29 idiomas' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', description: 'rápido, metade do custo' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'o mais rápido e barato' },
];

const LABEL_PT: Record<string, string> = {
  male: 'masculina',
  female: 'feminina',
  neutral: 'neutra',
  'non-binary': 'neutra',
  young: 'jovem',
  middle_aged: 'meia-idade',
  'middle-aged': 'meia-idade',
  old: 'madura',
  american: 'americana',
  british: 'britânica',
  australian: 'australiana',
  irish: 'irlandesa',
  indian: 'indiana',
  african: 'africana',
  swedish: 'sueca',
  transatlantic: 'transatlântica',
  brazilian: 'brasileira',
  portuguese: 'portuguesa',
  standard: '',
  narration: 'narração',
  narrative_story: 'narração',
  conversational: 'conversa',
  social_media: 'redes sociais',
  characters: 'personagens',
  characters_animation: 'personagens',
  informative_educational: 'educativa',
  entertainment_tv: 'entretenimento',
  advertisement: 'publicidade',
  news: 'notícias',
  meditation: 'meditação',
  calm: 'calma',
  confident: 'confiante',
  warm: 'calorosa',
  deep: 'grave',
  casual: 'casual',
  energetic: 'enérgica',
  professional: 'profissional',
  crisp: 'nítida',
  upbeat: 'animada',
  classy: 'elegante',
  husky: 'rouca',
  mature: 'madura',
  relaxed: 'relaxada',
  playful: 'brincalhona',
  wise: 'sábia',
  sassy: 'atrevida',
  formal: 'formal',
  hyped: 'empolgada',
  fierce: 'intensa',
  smooth: 'suave',
};

const pt = (v: string | undefined) => {
  if (!v) return '';
  const k = v.trim().toLowerCase().replace(/\s+/g, '_');
  return LABEL_PT[k] ?? LABEL_PT[k.replace(/_/g, '-')] ?? v.trim().toLowerCase().replace(/_/g, ' ');
};

type ElevenVoice = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string | undefined> | null;
};

/** Normaliza uma voz da ElevenLabs: o nome curto ("Sarah") e o resto vira descrição. */
export function fromElevenLabs(v: ElevenVoice): VoiceInfo {
  const [short, ...rest] = v.name.split(' - ');
  const l = v.labels ?? {};
  const traits = [pt(l.gender), pt(l.age), pt(l.accent), pt(l.descriptive ?? l.description), pt(l.use_case ?? l['use case'])].filter(Boolean);
  // sem rótulos (vozes clonadas): usa o que vem depois do " - " no nome ou a descrição
  const description = [...new Set(traits)].join(' · ') || rest.join(' - ').trim() || (v.description ?? '').trim().slice(0, 80);
  return {
    id: v.voice_id,
    name: (short ?? v.name).trim(),
    description,
    ...(v.preview_url ? { previewUrl: v.preview_url } : {}),
    ...(l.language ? { language: l.language } : {}),
    ...(v.category ? { category: v.category } : {}),
  };
}

/** Vozes da conta ElevenLabs (prontas, clonadas e da biblioteca adicionadas à conta). */
export async function elevenLabsVoices(opts: { apiKey?: string; fetch?: FetchLike; baseUrl?: string; signal?: AbortSignal } = {}): Promise<VoiceInfo[]> {
  const apiKey = opts.apiKey ?? env('ELEVENLABS_API_KEY');
  if (!apiKey) throw new Error('ElevenLabs: defina a chave de API');
  const base = (opts.baseUrl ?? 'https://api.elevenlabs.io').replace(/\/$/, '');
  const doFetch = opts.fetch ?? fetch;
  const out: VoiceInfo[] = [];
  let token: string | undefined;
  // até 5 páginas de 100 (contas com muitas vozes da biblioteca)
  for (let page = 0; page < 5; page++) {
    const url = `${base}/v2/voices?page_size=100${token ? `&next_page_token=${encodeURIComponent(token)}` : ''}`;
    const res = await doFetch(url, { headers: { 'xi-api-key': apiKey }, signal: opts.signal });
    if (!res.ok) throw await failure(res, 'ElevenLabs (vozes)');
    const data = (await res.json()) as { voices?: ElevenVoice[]; has_more?: boolean; next_page_token?: string | null };
    out.push(...(data.voices ?? []).map(fromElevenLabs));
    if (!data.has_more || !data.next_page_token) break;
    token = data.next_page_token;
  }
  // as da pessoa (clonadas/geradas) primeiro, depois as prontas; por nome
  const rank = (v: VoiceInfo) => (v.category === 'premade' ? 1 : 0);
  return out.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- chaves

export type KeyProvider = 'openai' | 'elevenlabs';

export const KEY_ENV: Record<KeyProvider, string> = { openai: 'OPENAI_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY' };

/** Formato mínimo de uma chave: caracteres visíveis, sem espaços, tamanho plausível. */
export function plausibleKey(key: string): boolean {
  return /^[\x21-\x7e]{16,300}$/.test(key);
}

export type KeyCheck = { ok: true; warning?: string } | { ok: false; error: string };

/**
 * Testa a chave no provedor, sem custo (lista modelos/vozes). Chave restrita que não pode listar
 * vozes ainda vale para gerar fala: aceita com aviso.
 */
export async function checkApiKey(provider: KeyProvider, key: string, opts: { fetch?: FetchLike; signal?: AbortSignal } = {}): Promise<KeyCheck> {
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res =
      provider === 'openai'
        ? await doFetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${key}` }, signal: opts.signal })
        : await doFetch('https://api.elevenlabs.io/v2/voices?page_size=1', { headers: { 'xi-api-key': key }, signal: opts.signal });
  } catch (err) {
    return { ok: false, error: `não foi possível falar com ${provider === 'openai' ? 'a OpenAI' : 'a ElevenLabs'} (${(err as Error).message})` };
  }
  if (res.ok) return { ok: true };
  const body = await res.text().catch(() => '');
  if (provider === 'elevenlabs' && /missing_permissions/i.test(body)) {
    return { ok: true, warning: 'a chave não tem permissão para listar vozes; informe o voice_id manualmente' };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'chave recusada pelo provedor (inválida ou revogada)' };
  return { ok: false, error: `${provider === 'openai' ? 'OpenAI' : 'ElevenLabs'}: HTTP ${res.status}` };
}

/** Texto curto da amostra de voz, no idioma da locução. */
export function previewText(language?: string): string {
  switch (language) {
    case 'en':
      return 'Hi! This is how I sound. I can narrate your next video, from start to finish.';
    case 'es':
      return '¡Hola! Así suena mi voz. Puedo narrar tu próximo video, de principio a fin.';
    default:
      return 'Olá! Esta é a minha voz. Posso narrar o seu próximo vídeo, do começo ao fim.';
  }
}
