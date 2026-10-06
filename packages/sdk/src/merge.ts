import { ProjectSchema, type Clip, type ClipType, type Project, type Track, type TrackKind } from '@caju-motion/schema';

/**
 * Merge por `origin` (o coração do `caju build`):
 * - clipes `origin: 'editor'` (criados no Studio) são preservados, de preferência na mesma trilha;
 * - clipes `origin: 'code'` são substituídos pelos recém-gerados;
 * - se um clipe de código foi mexido no Studio desde o último build (difere do `lastGenerated`),
 *   isso é um CONFLITO: o código venceria e a edição se perderia.
 * Função pura: não lê nem grava nada.
 */

export type FieldChange = { path: string; before: unknown; after: unknown };

export type MergeConflict = {
  clipId: string;
  name?: string;
  /** `edited`: alterado no Studio; `removed`: apagado no Studio (o build vai recriá-lo). */
  kind: 'edited' | 'removed';
  /** `before` = último build, `after` = como está no project.json. */
  changes: FieldChange[];
};

export type MergeResult = {
  project: Project;
  conflicts: MergeConflict[];
  /** Clipes do editor preservados (ids finais). */
  editorClips: string[];
  /** Clipes do editor que mudaram de trilha (a trilha sumiu, não aceita o tipo ou houve sobreposição). */
  moved: { clipId: string; from: string; to: string }[];
  /** Clipes `code` desconhecidos do último build (ex.: metade de um corte no Studio) — viram `editor`. */
  adopted: string[];
  /** Ids renomeados por colidirem com clipes gerados. */
  renamed: { from: string; to: string }[];
};

export const STUDIO_EDITS_TRACK_NAME = 'Edições do Studio';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isPlainObject(v)) {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'undefined';
}

export const deepEqual = (a: unknown, b: unknown) => stable(a) === stable(b);

/** Campos que mudaram entre dois valores (desce em objetos; arrays são comparados inteiros). */
export function diffFields(before: unknown, after: unknown, prefix = ''): FieldChange[] {
  if (deepEqual(before, after)) return [];
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((k) => diffFields(before[k], after[k], prefix ? `${prefix}.${k}` : k));
  }
  return [{ path: prefix || '(valor)', before, after }];
}

type ClipRef = { clip: Clip; track: Track };

function indexClips(p: Project | null): Map<string, ClipRef> {
  const out = new Map<string, ClipRef>();
  for (const track of p?.tracks ?? []) for (const clip of track.clips) out.set(clip.id, { clip, track });
  return out;
}

function acceptsClip(kind: TrackKind, type: ClipType): boolean {
  if (kind === 'audio') return type === 'audio';
  if (type === 'audio') return false;
  if (kind === 'main') return type === 'video' || type === 'image';
  return true;
}

function laneKind(type: ClipType): 'overlay' | 'text' | 'audio' {
  if (type === 'audio') return 'audio';
  if (type === 'text') return 'text';
  return 'overlay';
}

const fits = (track: Track, clip: Clip) =>
  track.clips.every((c) => clip.start + clip.duration <= c.start || clip.start >= c.start + c.duration);

export function mergeBuild(existing: Project | null, generated: Project, lastGenerated: Project | null): MergeResult {
  const out = clone(generated);
  const result: MergeResult = { project: out, conflicts: [], editorClips: [], moved: [], adopted: [], renamed: [] };
  if (!existing) {
    result.project = ProjectSchema.parse(out);
    return result;
  }

  const last = indexClips(lastGenerated);
  const current = indexClips(existing);

  // ---- conflitos: clipes de código mexidos/apagados no Studio desde o último build
  const adopted = new Set<string>();
  for (const [id, cur] of current) {
    if (cur.clip.origin !== 'code') continue;
    const prev = last.get(id);
    if (!prev) {
      // sem registro no último build: se há registro, foi criado no Studio (corte/cópia) → passa a ser do editor
      if (lastGenerated) adopted.add(id);
      continue;
    }
    const changes = diffFields(prev.clip, cur.clip);
    if (prev.track.id !== cur.track.id) changes.push({ path: 'track', before: prev.track.id, after: cur.track.id });
    if (changes.length) result.conflicts.push({ clipId: id, name: cur.clip.name, kind: 'edited', changes });
  }
  for (const [id, prev] of last) {
    if (prev.clip.origin === 'code' && !current.has(id)) {
      result.conflicts.push({ clipId: id, name: prev.clip.name, kind: 'removed', changes: [] });
    }
  }

  // ---- trilhas: as geradas, com travas/ocultar/mudo herdados do Studio
  const existingTracks = new Map(existing.tracks.map((t) => [t.id, t]));
  for (const t of out.tracks) {
    const old = existingTracks.get(t.id);
    if (old) Object.assign(t, { locked: old.locked, hidden: old.hidden, muted: old.muted });
  }
  const generatedTrackIds = new Set(out.tracks.map((t) => t.id));
  const lastTrackIds = new Set(lastGenerated?.tracks.map((t) => t.id) ?? []);

  const usedClipIds = new Set(out.tracks.flatMap((t) => t.clips.map((c) => c.id)));
  const usedTrackIds = new Set(out.tracks.map((t) => t.id));
  const uniqueClipId = (id: string) => {
    if (!usedClipIds.has(id)) return id;
    let n = 1;
    let next = `${id}-studio`;
    while (usedClipIds.has(next)) next = `${id}-studio-${++n}`;
    return next;
  };
  const prepare = (c: Clip): Clip => {
    const clip = clone(c);
    if (adopted.has(c.id)) clip.origin = 'editor';
    const id = uniqueClipId(clip.id);
    if (id !== clip.id) result.renamed.push({ from: clip.id, to: id });
    clip.id = id;
    usedClipIds.add(id);
    result.editorClips.push(id);
    return clip;
  };
  const isEditor = (c: Clip) => c.origin === 'editor' || adopted.has(c.id);

  const overflow: { clip: Clip; from: string }[] = [];
  existing.tracks.forEach((t, ti) => {
    const editorClips = t.clips.filter(isEditor);
    const target = out.tracks.find((g) => g.id === t.id);
    if (target) {
      for (const c of editorClips) {
        const clip = prepare(c);
        if (acceptsClip(target.kind, clip.type) && fits(target, clip)) target.clips.push(clip);
        else overflow.push({ clip, from: t.id });
      }
      target.clips.sort((a, b) => a.start - b.start);
      return;
    }
    if (editorClips.length === 0) return;
    const wasCode = lastTrackIds.has(t.id) || t.clips.some((c) => !isEditor(c));
    if (wasCode) {
      // a trilha de código sumiu (ou mudou de id): os clipes do editor vão para "Edições do Studio"
      for (const c of editorClips) overflow.push({ clip: prepare(c), from: t.id });
      return;
    }
    // trilha criada no Studio: preservada, logo acima da trilha anterior que sobreviveu
    const kept: Track = { ...clone(t), clips: editorClips.map(prepare) };
    let at = 0;
    for (let i = ti - 1; i >= 0; i--) {
      const idx = out.tracks.findIndex((g) => g.id === existing.tracks[i]!.id);
      if (idx >= 0) {
        at = idx + 1;
        break;
      }
    }
    out.tracks.splice(at, 0, kept);
    usedTrackIds.add(kept.id);
  });

  // ---- transbordo: trilhas "Edições do Studio" (visuais no topo da pilha, áudio no fim)
  const byKind = new Map<'overlay' | 'text' | 'audio', { clip: Clip; from: string }[]>();
  for (const o of overflow) {
    const k = laneKind(o.clip.type);
    byKind.set(k, [...(byKind.get(k) ?? []), o]);
  }
  for (const kind of ['overlay', 'text', 'audio'] as const) {
    const items = (byKind.get(kind) ?? []).sort((a, b) => a.clip.start - b.clip.start);
    const lanes: Track[] = [];
    for (const item of items) {
      let lane = lanes.find((l) => fits(l, item.clip));
      if (!lane) {
        let id = `edicoes-studio-${kind}${lanes.length ? `-${lanes.length + 1}` : ''}`;
        while (usedTrackIds.has(id)) id += '-x';
        usedTrackIds.add(id);
        lane = {
          id,
          kind,
          name: lanes.length ? `${STUDIO_EDITS_TRACK_NAME} ${lanes.length + 1}` : STUDIO_EDITS_TRACK_NAME,
          locked: false,
          hidden: false,
          muted: false,
          clips: [],
        };
        lanes.push(lane);
      }
      lane.clips.push(item.clip);
      result.moved.push({ clipId: item.clip.id, from: item.from, to: lane.id });
    }
    if (!lanes.length) continue;
    if (kind === 'audio') out.tracks.push(...lanes);
    else {
      const lastVisual = out.tracks.reduce((acc, t, i) => (t.kind !== 'audio' ? i : acc), -1);
      out.tracks.splice(lastVisual + 1, 0, ...lanes);
    }
  }

  // ---- assets e marcadores do Studio; meta preservada
  const genAssets = new Set(out.assets.map((a) => a.id));
  out.assets.push(...existing.assets.filter((a) => !genAssets.has(a.id)).map(clone));
  const genMarkers = new Set(out.markers.map((m) => m.id));
  const lastMarkers = new Set(lastGenerated?.markers.map((m) => m.id) ?? []);
  out.markers.push(...existing.markers.filter((m) => !genMarkers.has(m.id) && !lastMarkers.has(m.id)).map(clone));
  out.markers.sort((a, b) => a.frame - b.frame);
  out.meta = { ...existing.meta, generator: generated.meta.generator };

  result.adopted = [...adopted];
  result.project = ProjectSchema.parse(out);
  return result;
}

/** Resumo legível dos conflitos (para o terminal). */
export function formatConflicts(conflicts: MergeConflict[], maxChanges = 6): string {
  const show = (v: unknown) => {
    const s = JSON.stringify(v) ?? '—';
    return s.length > 60 ? `${s.slice(0, 57)}...` : s;
  };
  return conflicts
    .map((c) => {
      const head = `  • ${c.clipId}${c.name ? ` ("${c.name}")` : ''}`;
      if (c.kind === 'removed') return `${head}: apagado no Studio (o build vai recriá-lo)`;
      const lines = c.changes.slice(0, maxChanges).map((ch) => `      ${ch.path}: ${show(ch.before)} → ${show(ch.after)}`);
      if (c.changes.length > maxChanges) lines.push(`      … e mais ${c.changes.length - maxChanges} campo(s)`);
      return `${head}: editado no Studio\n${lines.join('\n')}`;
    })
    .join('\n');
}
