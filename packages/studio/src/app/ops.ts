import {
  ClipSchema,
  type Clip,
  type ClipInput,
  type ClipType,
  type Keyframe,
  type Project,
  type Track,
  type TrackKind,
} from '@caju-motion/schema';

/**
 * Operações de edição sobre o documento — funções que MUTAM um rascunho (immer draft).
 * Regras estilo CapCut:
 * - trilha `main` é MAGNÉTICA: sem buracos, os clipes ficam colados em sequência;
 * - demais trilhas são livres, sem sobreposição; se não couber, nasce uma trilha nova;
 * - trilhas vazias (exceto a principal) somem.
 */

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1e6;
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : String(idCounter);
  return `${prefix}-${rnd}`;
}

export const makeClip = (input: ClipInput): Clip => ClipSchema.parse(input);
/** Cópia profunda (funciona também com rascunhos do immer, onde structuredClone falha). */
export const cloneClip = (c: Clip): Clip => JSON.parse(JSON.stringify(c)) as Clip;
export const clipEnd = (c: Pick<Clip, 'start' | 'duration'>) => c.start + c.duration;

export type ClipRef = { track: Track; clip: Clip; trackIndex: number; clipIndex: number };

export function findClip(p: Project, clipId: string): ClipRef | null {
  for (let ti = 0; ti < p.tracks.length; ti++) {
    const track = p.tracks[ti]!;
    const ci = track.clips.findIndex((c) => c.id === clipId);
    if (ci >= 0) return { track, clip: track.clips[ci]!, trackIndex: ti, clipIndex: ci };
  }
  return null;
}

export function mainTrack(p: Project): Track {
  let main = p.tracks.find((t) => t.kind === 'main');
  if (!main) {
    main = { id: 'main', kind: 'main', name: 'Principal', locked: false, hidden: false, muted: false, clips: [] };
    p.tracks.unshift(main);
  }
  return main;
}

/** Frames disponíveis na mídia de origem (null = sem limite: imagem, texto, forma). */
export function mediaFrames(p: Project, clip: Pick<Clip, 'type' | 'assetId'>): number | null {
  if (clip.type !== 'video' && clip.type !== 'audio') return null;
  const asset = p.assets.find((a) => a.id === clip.assetId);
  const sec = asset?.meta.durationSec;
  return sec ? Math.floor(sec * p.settings.fps) : null;
}

/** Duração máxima do clipe dado corte e velocidade. */
export function maxDuration(p: Project, clip: Pick<Clip, 'type' | 'assetId' | 'trimIn' | 'speed'>): number {
  const total = mediaFrames(p, clip);
  if (total === null) return Infinity;
  return Math.max(1, Math.floor((total - clip.trimIn) / clip.speed));
}

export function acceptsClip(kind: TrackKind, type: ClipType): boolean {
  if (kind === 'audio') return type === 'audio';
  if (type === 'audio') return false;
  if (kind === 'main') return type === 'video' || type === 'image';
  return true;
}

export function trackKindFor(type: ClipType): TrackKind {
  if (type === 'audio') return 'audio';
  if (type === 'text') return 'text';
  return 'overlay';
}

const TRACK_NAMES: Record<TrackKind, string> = {
  main: 'Principal',
  overlay: 'Sobreposição',
  text: 'Texto',
  audio: 'Áudio',
  effect: 'Efeito',
};

function createTrack(p: Project, kind: TrackKind, index?: number): Track {
  const track: Track = { id: newId(kind), kind, name: TRACK_NAMES[kind], locked: false, hidden: false, muted: false, clips: [] };
  if (index === undefined || index >= p.tracks.length) p.tracks.push(track);
  else p.tracks.splice(Math.max(0, index), 0, track);
  return track;
}

export function isFree(track: Track, start: number, duration: number, ignoreId?: string): boolean {
  const end = start + duration;
  return track.clips.every((c) => c.id === ignoreId || end <= c.start || start >= clipEnd(c));
}

/** Espaço livre para a direita a partir de `start` (até o próximo clipe). */
function roomAfter(track: Track, start: number, ignoreId?: string): number {
  let next = Infinity;
  for (const c of track.clips) if (c.id !== ignoreId && c.start >= start) next = Math.min(next, c.start);
  return next - start;
}

/** Fim do clipe anterior (limite de extensão para a esquerda). */
function prevEnd(track: Track, start: number, ignoreId?: string): number {
  let prev = 0;
  for (const c of track.clips) if (c.id !== ignoreId && clipEnd(c) <= start) prev = Math.max(prev, clipEnd(c));
  return prev;
}

function sortClips(track: Track) {
  track.clips.sort((a, b) => a.start - b.start);
}

/** Trilha principal: ordena e cola os clipes a partir do 0. */
export function compactMain(p: Project) {
  const main = mainTrack(p);
  sortClips(main);
  let t = 0;
  for (const c of main.clips) {
    c.start = t;
    t += c.duration;
  }
}

export function normalize(p: Project) {
  compactMain(p);
  p.tracks = p.tracks.filter((t) => t.kind === 'main' || t.clips.length > 0);
  p.tracks.forEach(sortClips);
}

/** Mantém só keyframes dentro de [0, duration) após deslocar `shift` frames. */
function shiftKeyframes(clip: Clip, shift: number) {
  const out: Record<string, Keyframe[]> = {};
  for (const [prop, kfs] of Object.entries(clip.keyframes)) {
    const kept = kfs.map((k) => ({ ...k, frame: k.frame - shift })).filter((k) => k.frame >= 0 && k.frame < clip.duration);
    if (kept.length) out[prop] = kept;
  }
  clip.keyframes = out;
}

// ---------------------------------------------------------------- operações

/**
 * Insere um clipe. Mídia visual sem trilha indicada vai para a principal (na posição do playhead);
 * o resto procura uma trilha compatível livre, senão cria uma nova no topo.
 */
export function insertClip(p: Project, clip: Clip, targetTrackId?: string): string {
  const main = mainTrack(p);
  const target = targetTrackId ? p.tracks.find((t) => t.id === targetTrackId) : undefined;

  if (target && acceptsClip(target.kind, clip.type)) {
    if (target.kind === 'main') {
      target.clips.push(clip);
      normalize(p);
      return target.id;
    }
    if (isFree(target, clip.start, clip.duration)) {
      target.clips.push(clip);
      normalize(p);
      return target.id;
    }
    const created = createTrack(p, trackKindFor(clip.type), p.tracks.indexOf(target) + 1);
    created.clips.push(clip);
    normalize(p);
    return created.id;
  }

  if (!target && acceptsClip('main', clip.type)) {
    main.clips.push(clip);
    normalize(p);
    return main.id;
  }

  const kind = trackKindFor(clip.type);
  const existing = p.tracks.find(
    (t) => t.kind !== 'main' && t.kind === kind && !t.locked && isFree(t, clip.start, clip.duration),
  );
  const track = existing ?? createTrack(p, kind);
  track.clips.push(clip);
  normalize(p);
  return track.id;
}

/** Move para `start` na trilha alvo; `'new'` cria trilha nova acima da origem. */
export function moveClip(p: Project, clipId: string, start: number, targetTrackId: string | 'new'): void {
  const ref = findClip(p, clipId);
  if (!ref) return;
  const { clip, track: source } = ref;
  const target = targetTrackId === 'new' ? undefined : p.tracks.find((t) => t.id === targetTrackId);
  const newStart = Math.max(0, Math.round(start));

  // alvo incompatível → fica na trilha de origem
  const dest = target && acceptsClip(target.kind, clip.type) ? target : targetTrackId === 'new' ? undefined : source;

  source.clips.splice(ref.clipIndex, 1);
  clip.start = newStart;

  if (dest?.kind === 'main') {
    // reordenação: o -0.5 faz o clipe entrar ANTES de quem começa exatamente no mesmo frame
    dest.clips.push({ ...clip, start: newStart - 0.5 });
    normalize(p);
    return;
  }
  if (dest && isFree(dest, newStart, clip.duration)) {
    dest.clips.push(clip);
    normalize(p);
    return;
  }
  const baseIndex = dest ? p.tracks.indexOf(dest) : p.tracks.indexOf(source);
  const created = createTrack(p, trackKindFor(clip.type), baseIndex + 1);
  created.clips.push(clip);
  normalize(p);
}

/** Corta uma ponta do clipe em `delta` frames (positivo = para a direita). */
export function trimClip(p: Project, clipId: string, edge: 'start' | 'end', delta: number): void {
  const ref = findClip(p, clipId);
  if (!ref) return;
  const { clip, track } = ref;
  const isMain = track.kind === 'main';
  const isMedia = clip.type === 'video' || clip.type === 'audio';
  delta = Math.round(delta);

  if (edge === 'end') {
    let limit = maxDuration(p, clip);
    if (!isMain) limit = Math.min(limit, roomAfter(track, clip.start, clip.id));
    clip.duration = Math.max(1, Math.min(limit, clip.duration + delta));
  } else {
    let d = Math.min(delta, clip.duration - 1);
    // mídia não pode recuar antes do início do arquivo
    if (isMedia) d = Math.max(d, -Math.floor(clip.trimIn / clip.speed));
    // trilha livre: não invade o clipe anterior (nem passa do 0); a principal é recompactada depois
    if (!isMain) d = Math.max(d, prevEnd(track, clip.start, clip.id) - clip.start);
    clip.start += d;
    clip.duration -= d;
    if (isMedia) clip.trimIn = Math.max(0, Math.round(clip.trimIn + d * clip.speed));
    shiftKeyframes(clip, d);
  }
  normalize(p);
}

/** Divide o clipe no frame do projeto. Retorna o id da metade direita. */
export function splitClip(p: Project, clipId: string, atFrame: number): string | null {
  const ref = findClip(p, clipId);
  if (!ref) return null;
  const { clip, track, clipIndex } = ref;
  const at = Math.round(atFrame);
  if (at <= clip.start || at >= clipEnd(clip)) return null;

  const leftDuration = at - clip.start;
  const right: Clip = cloneClip(clip);
  right.id = newId(clip.type);
  right.start = at;
  right.duration = clipEnd(clip) - at;
  if (clip.type === 'video' || clip.type === 'audio') right.trimIn = Math.round(clip.trimIn + leftDuration * clip.speed);
  shiftKeyframes(right, leftDuration);
  if (right.audio) right.audio.fadeIn = 0;

  clip.duration = leftDuration;
  shiftKeyframes(clip, 0);
  if (clip.audio) clip.audio.fadeOut = 0;

  track.clips.splice(clipIndex + 1, 0, right);
  normalize(p);
  return right.id;
}

export function deleteClip(p: Project, clipId: string): void {
  const ref = findClip(p, clipId);
  if (!ref) return;
  ref.track.clips.splice(ref.clipIndex, 1);
  normalize(p);
}

/** Duplica logo após o original. Retorna o id da cópia. */
export function duplicateClip(p: Project, clipId: string): string | null {
  const ref = findClip(p, clipId);
  if (!ref) return null;
  const { clip, track } = ref;
  const copy: Clip = cloneClip(clip);
  copy.id = newId(clip.type);
  copy.origin = 'editor';
  copy.start = clipEnd(clip);

  if (track.kind === 'main') {
    // empurra os seguintes: insere com start "entre" o original e o próximo
    track.clips.splice(ref.clipIndex + 1, 0, { ...copy, start: clipEnd(clip) - 0.5 });
    normalize(p);
    return copy.id;
  }
  if (isFree(track, copy.start, copy.duration)) {
    track.clips.push(copy);
  } else {
    const created = createTrack(p, track.kind, ref.trackIndex + 1);
    created.clips.push(copy);
  }
  normalize(p);
  return copy.id;
}

/** Muda a velocidade mantendo o mesmo trecho da mídia (a duração na timeline muda). */
export function setSpeed(p: Project, clipId: string, speed: number): void {
  const ref = findClip(p, clipId);
  if (!ref) return;
  const { clip, track } = ref;
  const s = Math.min(10, Math.max(0.1, speed));
  const sourceFrames = clip.duration * clip.speed;
  clip.speed = s;
  let duration = Math.max(1, Math.round(sourceFrames / s));
  duration = Math.min(duration, maxDuration(p, clip));
  if (track.kind !== 'main') duration = Math.min(duration, roomAfter(track, clip.start, clip.id));
  clip.duration = Math.max(1, duration);
  shiftKeyframes(clip, 0);
  normalize(p);
}

export function updateClip(p: Project, clipId: string, fn: (clip: Clip) => void): void {
  const ref = findClip(p, clipId);
  if (ref) fn(ref.clip);
}

/** Clipe sob o playhead (prioriza a trilha mais alta visualmente). */
export function clipAt(p: Project, frame: number, types?: ClipType[]): Clip | null {
  for (let i = p.tracks.length - 1; i >= 0; i--) {
    const t = p.tracks[i]!;
    if (t.kind === 'audio') continue;
    const c = t.clips.find((c) => frame >= c.start && frame < clipEnd(c) && (!types || types.includes(c.type)));
    if (c) return c;
  }
  return null;
}
