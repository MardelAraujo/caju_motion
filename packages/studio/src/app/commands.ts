import { intrinsicSize, TEXT_DEFAULTS, type TextProps } from '@caju-motion/renderer';
import { secondsToFrames, type Asset, type Project } from '@caju-motion/schema';
import { api } from './api';
import { kindOfFile, probeMedia } from './media';
import {
  clipAt,
  deleteClip,
  duplicateClip,
  findClip,
  insertClip,
  makeClip,
  maxDuration,
  newId,
  splitClip,
  updateClip,
} from './ops';
import { useEditor } from './store';

/** Paleta rápida das amostras de cor (cores do Caju + neutros). Cores livres pelo seletor completo. */
export const BRAND_COLORS = ['#F6B73C', '#F47B35', '#E94B35', '#9A5B1F', '#171512', '#FFF8E9', '#FFFFFF'];

export type TextPreset = { id: string; label: string; sample: string; props: Partial<TextProps> };

export const TEXT_PRESETS: TextPreset[] = [
  { id: 'title', label: 'Título', sample: 'Título', props: { text: 'Título', fontFamily: 'Plus Jakarta Sans', fontSize: 140, fontWeight: 800 } },
  { id: 'subtitle', label: 'Subtítulo', sample: 'Subtítulo', props: { text: 'Subtítulo', fontSize: 72, fontWeight: 700 } },
  { id: 'body', label: 'Corpo', sample: 'Texto do corpo', props: { text: 'Texto do corpo', fontSize: 48, fontWeight: 400 } },
  {
    id: 'highlight',
    label: 'Destaque',
    sample: 'Destaque',
    props: { text: 'Destaque', fontFamily: 'Plus Jakarta Sans', fontSize: 96, fontWeight: 800, color: '#171512', background: '#F6B73C' },
  },
  {
    id: 'caption',
    label: 'Legenda',
    sample: 'Legenda na tela',
    props: { text: 'Legenda na tela', fontSize: 54, fontWeight: 700, background: '#171512' },
  },
  {
    id: 'label',
    label: 'Etiqueta',
    sample: 'Novidade',
    props: { text: 'Novidade', fontFamily: 'Plus Jakarta Sans', fontSize: 64, fontWeight: 700, color: '#171512', background: '#FFF8E9' },
  },
];

export const SHAPE_PRESETS = [
  { id: 'rect', label: 'Retângulo', shape: 'rect' as const, width: 600, height: 340 },
  { id: 'square', label: 'Quadrado', shape: 'rect' as const, width: 400, height: 400 },
  { id: 'circle', label: 'Círculo', shape: 'ellipse' as const, width: 400, height: 400 },
  { id: 'bar', label: 'Faixa', shape: 'rect' as const, width: 1080, height: 140 },
];

const DEFAULT_STILL_SECONDS = 5;

const st = () => useEditor.getState();

function center(p: Project) {
  return { x: p.settings.width / 2, y: p.settings.height / 2 };
}

/** Escala que faz a mídia caber (contain) ou cobrir (cover) o quadro. */
export function fitScale(p: Project, size: { width: number; height: number }, mode: 'contain' | 'cover'): number {
  const sx = p.settings.width / size.width;
  const sy = p.settings.height / size.height;
  return mode === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
}

// ---------------------------------------------------------------- adicionar

export function addAssetClip(assetId: string, opts: { at?: number; trackId?: string } = {}) {
  const { project, frame } = st();
  if (!project) return;
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset || (asset.kind !== 'video' && asset.kind !== 'image' && asset.kind !== 'audio')) return;
  const fps = project.settings.fps;
  const id = newId(asset.kind);
  const base = { id, type: asset.kind, assetId, start: opts.at ?? frame, name: asset.name };
  let duration =
    asset.kind === 'image'
      ? secondsToFrames(DEFAULT_STILL_SECONDS, fps)
      : Math.max(1, Math.floor((asset.meta.durationSec ?? DEFAULT_STILL_SECONDS) * fps));
  duration = Math.min(duration, maxDuration(project, { type: asset.kind, assetId, trimIn: 0, speed: 1 }));

  st().apply((d) => {
    if (asset.kind === 'audio') {
      insertClip(d, makeClip({ ...base, duration, audio: { volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 } }), opts.trackId);
      return;
    }
    const size = intrinsicSize(makeClip({ ...base, duration }), asset) ?? { width: 1080, height: 1080 };
    const clip = makeClip({
      ...base,
      duration,
      transform: { ...center(d), scale: fitScale(d, size, 'contain') },
      ...(asset.kind === 'video' ? { audio: { volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 } } : {}),
    });
    insertClip(d, clip, opts.trackId);
  });
  st().select(id);
}

export function addText(preset: TextPreset, opts: { at?: number; trackId?: string } = {}) {
  const { project, frame } = st();
  if (!project) return;
  const id = newId('text');
  st().apply((d) =>
    insertClip(
      d,
      makeClip({
        id,
        type: 'text',
        name: preset.label,
        start: opts.at ?? frame,
        duration: secondsToFrames(3, d.settings.fps),
        transform: center(d),
        props: { ...TEXT_DEFAULTS, ...preset.props },
      }),
      opts.trackId,
    ),
  );
  st().select(id);
  st().set({ rightTab: 'basic' });
}

export function addShape(
  shape: (typeof SHAPE_PRESETS)[number],
  fill: string,
  opts: { at?: number; trackId?: string } = {},
) {
  const { project, frame } = st();
  if (!project) return;
  const id = newId('shape');
  st().apply((d) =>
    insertClip(
      d,
      makeClip({
        id,
        type: 'shape',
        name: shape.label,
        start: opts.at ?? frame,
        duration: secondsToFrames(3, d.settings.fps),
        transform: center(d),
        props: { shape: shape.shape, width: shape.width, height: shape.height, fill },
      }),
      opts.trackId,
    ),
  );
  st().select(id);
}

// ---------------------------------------------------------------- upload

export async function uploadFiles(files: File[]): Promise<void> {
  const { project } = st();
  if (!project) return;
  for (const file of files) {
    const kind = kindOfFile(file);
    if (!kind) {
      st().showToast(`Formato não suportado: ${file.name}`);
      continue;
    }
    st().set({ uploading: [...st().uploading, file.name] });
    const localUrl = URL.createObjectURL(file);
    try {
      // envia primeiro (o arquivo fica salvo mesmo se a leitura falhar) e lê os metadados em paralelo
      const [{ src }, meta] = await Promise.all([api.uploadAsset(project.id, file), probeMedia(localUrl, kind)]);
      const asset: Asset = { id: newId(kind), kind, name: file.name, src, meta };
      st().apply((d) => {
        d.assets.push(asset);
      });
    } catch (err) {
      st().showToast(`Falha ao carregar ${file.name}: ${(err as Error).message}`);
    } finally {
      URL.revokeObjectURL(localUrl);
      st().set({ uploading: st().uploading.filter((n) => n !== file.name) });
    }
  }
}

// ---------------------------------------------------------------- edição

/** Alvo das ações: clipe selecionado, ou o que está sob o playhead. */
function targetClipId(): string | null {
  const { project, selectedClipId, frame } = st();
  if (!project) return null;
  if (selectedClipId && findClip(project, selectedClipId)) return selectedClipId;
  return clipAt(project, frame)?.id ?? null;
}

export function splitAtPlayhead() {
  const id = targetClipId();
  if (!id) return;
  const at = st().frame;
  let rightId: string | null = null;
  st().apply((d) => {
    rightId = splitClip(d, id, at);
  });
  if (rightId) st().select(rightId);
}

export function deleteSelected() {
  const { selectedClipId } = st();
  if (!selectedClipId) return;
  st().apply((d) => deleteClip(d, selectedClipId));
  st().select(null);
}

export function duplicateSelected() {
  const id = targetClipId();
  if (!id) return;
  let copyId: string | null = null;
  st().apply((d) => {
    copyId = duplicateClip(d, id);
  });
  if (copyId) st().select(copyId);
}

export function flipSelected(axis: 'x' | 'y') {
  const id = targetClipId();
  if (!id) return;
  st().apply((d) =>
    updateClip(d, id, (c) => {
      if (axis === 'x') c.transform.flipX = !c.transform.flipX;
      else c.transform.flipY = !c.transform.flipY;
    }),
  );
}

/** Ajustar (contain) / Preencher (cover) o quadro, centralizando. */
export function fitSelected(mode: 'contain' | 'cover') {
  const { project, selectedClipId } = st();
  if (!project || !selectedClipId) return;
  const ref = findClip(project, selectedClipId);
  if (!ref) return;
  const asset = project.assets.find((a) => a.id === ref.clip.assetId);
  const size = intrinsicSize(ref.clip, asset);
  if (!size) return;
  st().apply((d) =>
    updateClip(d, selectedClipId, (c) => {
      c.transform.scale = fitScale(d, size, mode);
      c.transform.rotation = 0;
      Object.assign(c.transform, center(d));
    }),
  );
}

export function togglePlay() {
  st().setPlaying(!st().playing);
}
