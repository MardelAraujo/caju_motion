import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashFile, probeMedia, runFfmpegOk } from '@caju-motion/media';
import { ClipSchema, TrackSchema, type Clip, type Project, type Track } from '@caju-motion/schema';
import { estimateWords, parseSubtitles, toSrt, wordsToCues, type Cue, type CueOptions, type Word } from './captions';
import type { SttProvider } from './stt';
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

export type TranscriptionOptions = {
  projectDir: string;
  /** Nome base: `assets/data/<name>.words.json` e `.srt`. */
  name: string;
  /** Áudio ou vídeo (absoluto ou relativo ao projeto). */
  file: string;
  provider: SttProvider;
  language?: string;
  force?: boolean;
  cues?: CueOptions;
  signal?: AbortSignal;
};

export type TranscriptionResult = Omit<VoiceoverResult, 'audioSrc' | 'timed'> & { text: string; source: string };

/**
 * Transcreve um áudio/vídeo que já existe (talking-head, podcast, locução gravada) em palavras com
 * tempo + SRT, no mesmo formato da locução gerada (`caju captions --from <name>.words.json`).
 * Extrai a fala com o FFmpeg (mono 16 kHz) antes de enviar. Mesmo arquivo + provedor reaproveita.
 */
export async function transcription(opts: TranscriptionOptions): Promise<TranscriptionResult> {
  const { projectDir, provider, cues: cueOpts } = opts;
  const name = safeName(opts.name);
  const file = path.resolve(projectDir, opts.file);
  if (!existsSync(file)) throw new Error(`arquivo não encontrado: ${opts.file}`);
  const source = path.relative(projectDir, file).split(path.sep).join('/');
  const wordsSrc = `assets/data/${name}.words.json`;
  const srtSrc = `assets/data/${name}.srt`;
  const key = createHash('sha256')
    .update(JSON.stringify([provider.id, opts.language ?? '', await hashFile(file)]))
    .digest('hex')
    .slice(0, 16);

  const wordsFile = path.join(projectDir, wordsSrc);
  if (!opts.force && existsSync(wordsFile)) {
    const prev = JSON.parse(await readFile(wordsFile, 'utf8')) as WordsFile;
    if (prev.key === key) {
      return { wordsSrc, srtSrc, source, text: prev.text, durationSec: prev.durationSec, words: prev.words, cues: wordsToCues(prev.words, cueOpts), cached: true };
    }
  }

  const { stdout } = await runFfmpegOk(['-i', file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', '-f', 'mp3', 'pipe:1'], {
    captureStdout: true,
    signal: opts.signal,
  });
  if (!stdout.length) throw new Error(`${opts.file}: sem trilha de áudio`);
  const res = await provider.transcribe({ audio: new Uint8Array(stdout), filename: `${name}.mp3`, language: opts.language, signal: opts.signal });
  if (!res.words.length) throw new Error(`${opts.file}: nenhuma fala reconhecida`);
  const durationSec = res.durationSec ?? (await probeMedia(file)).durationSec ?? res.words[res.words.length - 1]!.end;
  const cues = wordsToCues(res.words, cueOpts);
  const out: WordsFile = { version: 1, key, provider: provider.id, text: res.text, audio: source, durationSec, timed: true, words: res.words };
  await writeAtomic(wordsFile, JSON.stringify(out, null, 2) + '\n');
  await writeAtomic(path.join(projectDir, srtSrc), toSrt(cues));
  return { wordsSrc, srtSrc, source, text: res.text, durationSec, words: res.words, cues, cached: false };
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
  /** Início no vídeo (s). Padrão: onde o clipe já está (se existir) ou 0. */
  startSec?: number;
  trackId?: string;
  trackName?: string;
  volume?: number;
};

const overlaps = (clips: Clip[], start: number, duration: number, except?: Clip) =>
  clips.some((c) => c !== except && start < c.start + c.duration && start + duration > c.start);

/**
 * Registra o áudio da locução (asset + clipe numa trilha de áudio).
 *
 * Rodar de novo (texto corrigido) atualiza o clipe que já existe sem desfazer o que foi editado no
 * Studio: trilha, posição, volume, fades e corte ficam; só a duração acompanha o áudio novo. Um
 * clipe novo vai para a primeira trilha "Locução" livre naquele trecho (os clipes de uma trilha
 * não podem se sobrepor).
 */
export function addVoiceover(project: Project, vo: Pick<VoiceoverResult, 'audioSrc' | 'durationSec'>, opts: AddVoiceoverOptions = {}): Project {
  const next: Project = structuredClone(project);
  const assetId = opts.assetId ?? path.basename(vo.audioSrc).replace(/\.[^.]+$/, '');
  const asset = { id: assetId, kind: 'audio' as const, name: assetId, src: vo.audioSrc, meta: { durationSec: vo.durationSec } };
  const i = next.assets.findIndex((a) => a.id === assetId);
  if (i >= 0) next.assets[i] = { ...next.assets[i]!, ...asset };
  else next.assets.push(asset);

  const clipId = `${assetId}-clip`;
  const sourceFrames = Math.max(1, sec(next, vo.durationSec));
  const prevTrack = next.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  const prev = prevTrack?.clips.find((c) => c.id === clipId);
  const start = opts.startSec !== undefined ? sec(next, opts.startSec) : (prev?.start ?? 0);
  const duration = prev ? Math.max(1, Math.floor((sourceFrames - prev.trimIn) / prev.speed)) : sourceFrames;

  if (prevTrack && prev && !overlaps(prevTrack.clips, start, duration, prev)) {
    Object.assign(prev, { start, duration, ...(opts.volume !== undefined ? { audio: { ...prev.audio, volume: opts.volume } } : {}) });
    prevTrack.clips.sort((a, b) => a.start - b.start);
    return next;
  }
  if (prevTrack && prev) prevTrack.clips = prevTrack.clips.filter((c) => c !== prev);

  const clip: Clip = ClipSchema.parse({
    ...(prev ?? {}),
    id: clipId,
    type: 'audio',
    name: prev?.name ?? assetId,
    assetId,
    start,
    duration,
    ...(opts.volume !== undefined ? { audio: { ...prev?.audio, volume: opts.volume } } : {}),
  });
  // ids são globais no projeto (assets, trilhas e clipes): a trilha não pode se chamar como o asset
  const base = opts.trackId ?? 'trilha-locucao';
  const name = opts.trackName ?? 'Locução';
  for (let n = 1; ; n++) {
    const track = ensureTrack(next, n === 1 ? base : `${base}-${n}`, 'audio', n === 1 ? name : `${name} ${n}`, 'bottom');
    if (overlaps(track.clips, clip.start, clip.duration)) continue;
    track.clips.push(clip);
    track.clips.sort((a, b) => a.start - b.start);
    return next;
  }
}

/** Início (s) do clipe da locução `assetId`, onde quer que esteja (ex.: movido no Studio). */
export function voiceoverStartSec(project: Project, assetId: string): number | undefined {
  const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === `${assetId}-clip`);
  return clip ? clip.start / project.settings.fps : undefined;
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
