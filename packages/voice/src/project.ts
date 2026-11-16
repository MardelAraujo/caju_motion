import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashFile, probeMedia, runFfmpegOk } from '@caju-motion/media';
import { ClipSchema, TrackSchema, type Clip, type Project, type Track } from '@caju-motion/schema';
import { estimateWords, parseSubtitles, round, toSrt, wordsToCues, type Cue, type CueOptions, type Word } from './captions';
import type { SttProvider } from './stt';
import type { TtsProvider, TtsRequest, TtsResult } from './tts';

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
  /** Em quantos pedidos ao provedor o texto foi dividido. */
  parts: number;
  /** Avisos do provedor (ex.: o alinhamento falhou e os tempos foram estimados). */
  warnings: string[];
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
 * Divide o roteiro em blocos de até `max` caracteres, quebrando em fim de frase (ou, numa frase
 * longa demais, entre palavras). Juntos, os blocos refazem o texto (espaços normalizados).
 */
export function splitScript(text: string, max: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean ? [clean] : [];
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+["')\]]?|$)\s*/g)?.map((t) => t.trim()).filter(Boolean) ?? [clean];
  const pieces: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      pieces.push(sentence);
      continue;
    }
    let cur = '';
    for (const word of sentence.split(' ')) {
      // palavra sozinha maior que o limite (ex.: uma URL enorme): corta no limite
      for (let w = word; w; w = w.slice(max)) {
        const part = w.slice(0, max);
        if (cur && cur.length + 1 + part.length > max) {
          pieces.push(cur);
          cur = part;
        } else cur = cur ? `${cur} ${part}` : part;
      }
    }
    if (cur) pieces.push(cur);
  }
  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last !== undefined && last.length + 1 + p.length <= max) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  return chunks;
}

/** Arquivos temporários fora do projeto, apagados no fim. */
async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'caju-vo-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Junta as partes da locução num arquivo só (FFmpeg, mono 44,1 kHz), no formato da primeira. */
async function concatAudio(parts: TtsResult[], out: string, signal?: AbortSignal): Promise<number[]> {
  return withTempDir(async (dir) => {
    const files: string[] = [];
    const durations: number[] = [];
    for (const [i, part] of parts.entries()) {
      const f = path.join(dir, `part-${i}.${part.format}`);
      await writeFile(f, part.audio);
      files.push(f);
      durations.push((await probeMedia(f)).durationSec ?? 0);
    }
    const format = parts[0]!.format;
    const inputs = files.map((_, i) => `[${i}:a]aresample=44100,aformat=sample_fmts=s16:channel_layouts=mono[a${i}]`).join(';');
    const graph = `${inputs};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[out]`;
    const codec = format === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '192k'] : ['-c:a', 'pcm_s16le'];
    const joined = path.join(dir, `joined.${format}`);
    await runFfmpegOk(['-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-map', '[out]', ...codec, joined], { signal });
    await writeAtomic(out, await readFile(joined));
    return durations;
  });
}

/**
 * Gera (ou reaproveita) a locução de `text` no projeto: áudio, tempos por palavra e SRT.
 * A chave de cache é provedor + voz + texto + velocidade/instruções/idioma: mudar qualquer um gera de novo.
 * Texto maior que o limite do provedor (`maxInput`) é dividido em frases, gerado em partes e juntado.
 */
export async function voiceover(opts: VoiceoverOptions): Promise<VoiceoverResult> {
  const { projectDir, text, provider, force = false, cues: cueOpts, ...req } = opts;
  const name = safeName(opts.name);
  const wordsSrc = `assets/data/${name}.words.json`;
  const srtSrc = `assets/data/${name}.srt`;
  const key = createHash('sha256')
    // o idioma só entra quando informado, para não invalidar as locuções que já existem sem ele
    .update(
      JSON.stringify([provider.id, req.voice ?? '', req.speed ?? 1, req.instructions ?? '', req.format ?? '', text, ...(req.language ? [req.language] : [])]),
    )
    .digest('hex')
    .slice(0, 16);

  const wordsFile = path.join(projectDir, wordsSrc);
  let prev: WordsFile | undefined;
  if (existsSync(wordsFile)) {
    try {
      prev = JSON.parse(await readFile(wordsFile, 'utf8')) as WordsFile;
    } catch {
      prev = undefined; // words.json ilegível: gera de novo
    }
  }
  if (!force && prev && prev.key === key && existsSync(path.join(projectDir, prev.audio))) {
    return {
      audioSrc: prev.audio,
      wordsSrc,
      srtSrc,
      durationSec: prev.durationSec,
      words: prev.words,
      cues: wordsToCues(prev.words, cueOpts),
      timed: prev.timed,
      cached: true,
      parts: 1,
      warnings: [],
    };
  }

  const chunks = provider.maxInput ? splitScript(text, provider.maxInput) : [text];
  if (!chunks.length) throw new Error('texto da locução vazio');
  const results: TtsResult[] = [];
  for (const chunk of chunks) results.push(await provider.synthesize({ ...req, text: chunk }));
  const warnings = [...new Set(results.map((r) => r.warning).filter((w): w is string => !!w))];

  const audioSrc = `assets/audio/vo/${name}.${results[0]!.format}`;
  const audioFile = path.join(projectDir, audioSrc);
  const isTimed = (r: TtsResult) => !!r.words?.length && !r.estimated;
  let words: Word[];
  if (results.length === 1) {
    await writeAtomic(audioFile, results[0]!.audio);
    words = results[0]!.words?.length ? results[0]!.words : estimateWords(text, (await probeMedia(audioFile)).durationSec ?? 0);
  } else {
    // tempos de cada parte deslocados pela duração das anteriores
    const durations = await concatAudio(results, audioFile, req.signal);
    words = [];
    let offset = 0;
    results.forEach((r, i) => {
      const partWords = r.words?.length ? r.words : estimateWords(chunks[i]!, durations[i]!);
      words.push(...partWords.map((w) => ({ text: w.text, start: round(w.start + offset), end: round(w.end + offset) })));
      offset += durations[i]!;
    });
  }
  const timed = results.every(isTimed);
  const durationSec = (await probeMedia(audioFile)).durationSec ?? 0;
  const cues = wordsToCues(words, cueOpts);
  const file: WordsFile = { version: 1, key, provider: provider.id, text, audio: audioSrc, durationSec, timed, words };
  await writeAtomic(wordsFile, JSON.stringify(file, null, 2) + '\n');
  await writeAtomic(path.join(projectDir, srtSrc), toSrt(cues));
  // trocou de formato (ex.: voz provisória .wav → VoiceStudio .mp3): apaga o áudio antigo desta locução
  if (prev && prev.audio !== audioSrc && prev.audio.replace(/\.(mp3|wav)$/, '') === `assets/audio/vo/${name}`) {
    await rm(path.join(projectDir, prev.audio), { force: true });
  }
  return { audioSrc, wordsSrc, srtSrc, durationSec, words, cues, timed, cached: false, parts: chunks.length, warnings };
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

export type TranscriptionResult = Omit<VoiceoverResult, 'audioSrc' | 'timed' | 'parts' | 'warnings'> & { text: string; source: string };

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

/** Quantas legendas com este prefixo estão no projeto (as que se sobrepõem a outras são ignoradas). */
export function captionCount(project: Project, prefix: string): number {
  return project.tracks.flatMap((t) => t.clips).filter((c) => c.id.startsWith(`${prefix}-`)).length;
}

/** Texto do resultado: "3 legenda(s)" ou "2 de 3 legenda(s) (1 ignorada por sobrepor outras)". */
export function captionSummary(added: number, total: number): string {
  return added < total ? `${added} de ${total} legenda(s) (${total - added} ignorada(s) por sobrepor outras legendas)` : `${total} legenda(s)`;
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
    // a trilha da locução comanda o ducking da música na mixagem
    track.role ??= 'voice';
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
