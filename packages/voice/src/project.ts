import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { probeMedia } from '@caju-motion/media';
import { ClipSchema, TrackSchema, type Clip, type Project, type Track } from '@caju-motion/schema';
import { estimateWords, parseSubtitles, toSrt, wordsToCues, type Cue, type CueOptions, type Word } from './captions';
import type { TtsProvider, TtsRequest } from './tts';

// ---------------------------------------------------------------- arquivos da locução

export type VoiceoverOptions = Omit<TtsRequest, 'text'> & {
  /** Pasta do projeto. */
  projectDir: string;
  /** Nome base dos arquivos (ex.: `vo-01`): `assets/audio/vo/<name>.<ext>` e `assets/data/<name>.words.json`. */
  name: string;
  text: string;
  provider: TtsProvider;
  /** Gera de novo mesmo com o mesmo texto/voz (padrão: reaproveita e não paga de novo). */
  force?: boolean;
  cues?: CueOptions;
};

export type VoiceoverResult = {
  /** Caminhos relativos ao projeto. */
  audioSrc: string;
  wordsSrc: string;
  srtSrc: string;
  durationSec: number;
  words: Word[];
  cues: Cue[];
  /** Tempos vieram do provedor (true) ou foram estimados (false). */
  timed: boolean;
  /** Reaproveitado do disco, sem chamar o provedor. */
  cached: boolean;
};

type WordsFile = { version: 1; key: string; provider: string; text: string; audio: string; durationSec: number; timed: boolean; words: Word[] };

const safeName = (name: string) => {
  if (!/^[\w.-]+$/.test(name)) throw new Error(`nome inválido para a locução: "${name}" (use letras, números, - _ .)`);
  return name;
};

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

/**
 * Gera (ou reaproveita) a locução de `text` no projeto: áudio, tempos por palavra e SRT.
 * A chave de cache é provedor + voz + texto + velocidade/instruções: mudar qualquer um gera de novo.
 */
export async function voiceover(opts: VoiceoverOptions): Promise<VoiceoverResult> {
  const { projectDir, text, provider, force = false, cues: cueOpts, ...req } = opts;
  const name = safeName(opts.name);
  const wordsSrc = `assets/data/${name}.words.json`;
  const srtSrc = `assets/data/${name}.srt`;
  const key = createHash('sha256')
    .update(JSON.stringify([provider.id, req.voice ?? '', req.speed ?? 1, req.instructions ?? '', req.format ?? '', text]))
    .digest('hex')
    .slice(0, 16);

  const wordsFile = path.join(projectDir, wordsSrc);
  if (!force && existsSync(wordsFile)) {
    const prev = JSON.parse(await readFile(wordsFile, 'utf8')) as WordsFile;
    if (prev.key === key && existsSync(path.join(projectDir, prev.audio))) {
      return {
        audioSrc: prev.audio,
        wordsSrc,
        srtSrc,
        durationSec: prev.durationSec,
        words: prev.words,
        cues: wordsToCues(prev.words, cueOpts),
        timed: prev.timed,
        cached: true,
      };
    }
  }

  const res = await provider.synthesize({ ...req, text });
  const audioSrc = `assets/audio/vo/${name}.${res.format}`;
  const audioFile = path.join(projectDir, audioSrc);
  await writeAtomic(audioFile, res.audio);
  const durationSec = (await probeMedia(audioFile)).durationSec ?? 0;
  const timed = !!res.words?.length && !res.estimated;
  const words = res.words?.length ? res.words : estimateWords(text, durationSec);
  const cues = wordsToCues(words, cueOpts);
  const file: WordsFile = { version: 1, key, provider: provider.id, text, audio: audioSrc, durationSec, timed, words };
  await writeAtomic(wordsFile, JSON.stringify(file, null, 2) + '\n');
  await writeAtomic(path.join(projectDir, srtSrc), toSrt(cues));
  return { audioSrc, wordsSrc, srtSrc, durationSec, words, cues, timed, cached: false };
}

/** Lê legendas de `.srt`, `.vtt` ou `.words.json` (gerado por `voiceover`). */
export async function readCaptions(file: string, cueOpts?: CueOptions): Promise<Cue[]> {
  const content = await readFile(file, 'utf8');
  if (file.endsWith('.json')) {
    const data = JSON.parse(content) as Partial<WordsFile> & { cues?: Cue[] };
    if (Array.isArray(data.words)) return wordsToCues(data.words, cueOpts);
    if (Array.isArray(data.cues)) return data.cues;
    throw new Error(`${path.basename(file)}: esperado { words: [...] } ou { cues: [...] }`);
  }
  return parseSubtitles(content);
}

// ---------------------------------------------------------------- edição do project.json

const sec = (project: Project, s: number) => Math.round(s * project.settings.fps);

function ensureTrack(project: Project, id: string, kind: Track['kind'], name: string, position: 'top' | 'bottom'): Track {
  let track = project.tracks.find((t) => t.id === id);
  if (!track) {
    track = TrackSchema.parse({ id, kind, name, clips: [] });
    if (position === 'top') project.tracks.push(track);
    else project.tracks.unshift(track);
  }
  return track;
}

export type AddVoiceoverOptions = {
  /** id do asset e do clipe (padrão: o nome do arquivo sem extensão). */
  assetId?: string;
  /** Início no vídeo (s). */
  startSec?: number;
  trackId?: string;
  trackName?: string;
  volume?: number;
};

/** Registra o áudio da locução (asset + clipe numa trilha de áudio). Substitui um clipe anterior do mesmo asset. */
export function addVoiceover(project: Project, vo: Pick<VoiceoverResult, 'audioSrc' | 'durationSec'>, opts: AddVoiceoverOptions = {}): Project {
  const next: Project = structuredClone(project);
  const assetId = opts.assetId ?? path.basename(vo.audioSrc).replace(/\.[^.]+$/, '');
  const asset = { id: assetId, kind: 'audio' as const, name: assetId, src: vo.audioSrc, meta: { durationSec: vo.durationSec } };
  const i = next.assets.findIndex((a) => a.id === assetId);
  if (i >= 0) next.assets[i] = { ...next.assets[i]!, ...asset };
  else next.assets.push(asset);

  for (const t of next.tracks) t.clips = t.clips.filter((c) => c.id !== `${assetId}-clip`);
  // ids são globais no projeto (assets, trilhas e clipes): a trilha não pode se chamar como o asset
  const track = ensureTrack(next, opts.trackId ?? 'trilha-locucao', 'audio', opts.trackName ?? 'Locução', 'bottom');
  const clip: Clip = ClipSchema.parse({
    id: `${assetId}-clip`,
    type: 'audio',
    name: assetId,
    assetId,
    start: sec(next, opts.startSec ?? 0),
    duration: Math.max(1, sec(next, vo.durationSec)),
    ...(opts.volume !== undefined ? { audio: { volume: opts.volume } } : {}),
  });
  track.clips.push(clip);
  track.clips.sort((a, b) => a.start - b.start);
  return next;
}

export type CaptionStyle = {
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  /** Fundo atrás do texto ('' = sem fundo). */
  background?: string;
  /** Altura da legenda, de 0 (topo) a 1 (base). Padrão 0,78 (acima da UI de reels). */
  y?: number;
};

export type AddCaptionsOptions = {
  /** Prefixo dos ids; legendas anteriores com o mesmo prefixo são substituídas. Padrão `legenda`. */
  prefix?: string;
  /** Desloca todas as legendas (s), ex.: quando a locução começa depois do zero. */
  offsetSec?: number;
  trackId?: string;
  trackName?: string;
  style?: CaptionStyle;
};

/** Legendas como clipes de texto numa trilha própria (editáveis no Studio). Nunca se sobrepõem. */
export function addCaptions(project: Project, cues: Cue[], opts: AddCaptionsOptions = {}): Project {
  const next: Project = structuredClone(project);
  const prefix = opts.prefix ?? 'legenda';
  const { width, height } = next.settings;
  const st = opts.style ?? {};
  for (const t of next.tracks) t.clips = t.clips.filter((c) => !c.id.startsWith(`${prefix}-`));
  const track = ensureTrack(next, opts.trackId ?? 'trilha-legendas', 'text', opts.trackName ?? 'Legendas', 'top');
  const offset = opts.offsetSec ?? 0;
  const frames = cues
    .map((c) => ({ c, from: Math.max(0, sec(next, c.start + offset)), to: sec(next, c.end + offset) }))
    .sort((a, b) => a.from - b.from);
  const occupied = track.clips.map((c) => [c.start, c.start + c.duration] as const);
  frames.forEach(({ c, from, to }, i) => {
    const nextFrom = frames[i + 1]?.from ?? Infinity;
    const end = Math.min(Math.max(to, from + 1), nextFrom);
    if (end <= from || occupied.some(([a, b]) => from < b && end > a)) return;
    track.clips.push(
      ClipSchema.parse({
        id: `${prefix}-${i + 1}`,
        type: 'text',
        name: c.text.slice(0, 40),
        start: from,
        duration: end - from,
        transform: { x: width / 2, y: Math.round(height * (st.y ?? 0.78)) },
        props: {
          text: c.text,
          fontFamily: st.fontFamily ?? 'Plus Jakarta Sans',
          fontSize: st.fontSize ?? Math.round(width / 20),
          fontWeight: st.fontWeight ?? 800,
          color: st.color ?? '#FFFFFF',
          align: 'center',
          lineHeight: 1.15,
          letterSpacing: 0,
          background: st.background ?? '#000000B3',
        },
      }),
    );
  });
  track.clips.sort((a, b) => a.start - b.start);
  return next;
}
