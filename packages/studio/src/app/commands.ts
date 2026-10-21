import { componentDefaults, getComponent, intrinsicSize, TEXT_DEFAULTS, type TextProps } from '@caju-motion/renderer';
import { secondsToFrames, type Asset, type Clip, type Project } from '@caju-motion/schema';
import { api, type VoiceRequest } from './api';
import { kindOfFile, probeMedia } from './media';
import {
  clipEnd,
  copyClips,
  deleteClip,
  duplicateClip,
  findClip,
  insertClip,
  makeClip,
  maxDuration,
  moveClips,
  newId,
  pasteClips,
  rippleDelete,
  splitClip,
  trimToPlayhead,
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

/**
 * Componente do usuário (aba Componentes): clipe `component` com as props padrão do componente,
 * centralizado, na duração padrão dele (ou 3 s).
 */
export function addComponent(name: string, opts: { at?: number; trackId?: string } = {}) {
  const { project, frame } = st();
  const defn = getComponent(name);
  if (!project || !defn) return;
  const id = newId('component');
  const fps = project.settings.fps;
  st().apply((d) =>
    insertClip(
      d,
      makeClip({
        id,
        type: 'component',
        name: defn.label ?? defn.name,
        start: opts.at ?? frame,
        duration: Math.max(1, Math.round(defn.durationInFrames ?? secondsToFrames(3, fps))),
        transform: center(d),
        props: { ...componentDefaults(defn), component: defn.name },
      }),
      opts.trackId,
    ),
  );
  st().select(id);
  st().set({ rightTab: 'basic' });
}

/** Sobreposição em tela cheia (vinheta, faixas de cinema…) numa trilha de efeitos, no playhead. */
export function addOverlay(effect: string, opts: { at?: number; trackId?: string } = {}) {
  const { project, frame } = st();
  if (!project) return;
  const id = newId('effect');
  st().apply((d) =>
    insertClip(
      d,
      makeClip({ id, type: 'effect', name: effect, start: opts.at ?? frame, duration: secondsToFrames(3, d.settings.fps), props: { effect } }),
      opts.trackId,
    ),
  );
  st().select(id);
  st().set({ rightTab: 'basic' });
}

/** Camada de ajuste: os efeitos dela valem para tudo o que está abaixo. */
export function addAdjustment(opts: { at?: number; trackId?: string } = {}) {
  const { project, frame } = st();
  if (!project) return;
  const id = newId('adjustment');
  st().apply((d) =>
    insertClip(
      d,
      makeClip({
        id,
        type: 'adjustment',
        name: 'Ajuste',
        start: opts.at ?? frame,
        duration: secondsToFrames(3, d.settings.fps),
        effects: [{ id: newId('fx'), type: 'saturate', enabled: true, params: {} }],
      }),
      opts.trackId,
    ),
  );
  st().select(id);
  st().set({ rightTab: 'effects' });
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

// ---------------------------------------------------------------- voz

/**
 * Salva o que está aberto, pede ao servidor para gravar no projeto (locução, legendas) e recarrega.
 * O servidor edita o project.json como a CLI; salvar antes garante que nada do Studio se perca.
 */
async function writeOnServer<T>(run: (projectId: string, base: string | null) => Promise<T>): Promise<T | null> {
  const { project } = st();
  if (!project) return null;
  await st().save();
  const { saveState, diskVersion } = st();
  if (saveState !== 'saved') {
    st().showToast('Salve o projeto antes de gerar a voz.');
    return null;
  }
  const result = await run(project.id, diskVersion);
  await st().reloadProject();
  return result;
}

export async function generateVoiceover(req: VoiceRequest): Promise<boolean> {
  try {
    const r = await writeOnServer((id, base) => api.generateVoice(id, req, base));
    if (!r) return false;
    st().showToast(
      r.filesOnly
        ? `Locução gerada em ${r.audioSrc}. Projeto por código: ligue no video.ts e rode caju build.`
        : `Locução de ${r.durationSec.toFixed(1)} s${r.cached ? ' (reaproveitada)' : ''}${req.captions === false ? '' : `, ${r.cues} legenda(s)`}.`,
    );
    return true;
  } catch (err) {
    st().showToast(`Voz: ${(err as Error).message}`);
    return false;
  }
}

/** Legendas automáticas de um áudio/vídeo do projeto (transcrição local pelo VoiceStudio). */
export async function autoCaptions(asset: Asset, language?: string): Promise<boolean> {
  try {
    // as legendas começam onde o clipe desse asset começa na timeline (se houver)
    const fps = st().project?.settings.fps ?? 30;
    const clip = st().project?.tracks.flatMap((t) => t.clips).find((c) => c.assetId === asset.id);
    const offsetSec = clip ? Math.max(0, (clip.start - clip.trimIn / clip.speed) / fps) : 0;
    const r = await writeOnServer((id, base) => api.transcribeAsset(id, { src: asset.src, language, offsetSec }, base));
    if (!r) return false;
    st().showToast(r.filesOnly ? `Transcrição em ${r.wordsSrc}. Projeto por código: use readCaptions no video.ts.` : `${r.cues} legenda(s) de ${asset.name}.`);
    return true;
  } catch (err) {
    st().showToast(`Legendas: ${(err as Error).message}`);
    return false;
  }
}

// ---------------------------------------------------------------- edição

const hasSound = (c: Clip) => c.type === 'video' || c.type === 'audio';
const isVisual = (c: Clip) => c.type !== 'audio';
const containsFrame = (c: Clip, frame: number) => frame > c.start && frame < clipEnd(c);

/** Clipe sob o playhead que satisfaz `ok`: trilhas visuais primeiro (a mais alta), depois as de áudio. */
function clipUnder(p: Project, frame: number, ok: (c: Clip) => boolean = () => true): Clip | null {
  const order = [...p.tracks].reverse().sort((a, b) => Number(a.kind === 'audio') - Number(b.kind === 'audio'));
  for (const t of order) {
    const c = t.clips.find((c) => frame >= c.start && frame < clipEnd(c) && ok(c));
    if (c) return c;
  }
  return null;
}

export type EditTargets = {
  /** Duplicar/excluir: o clipe selecionado, ou o que está sob o playhead. */
  clip: Clip | null;
  /** Dividir: o selecionado se o playhead estiver dentro dele; senão o clipe sob o playhead. */
  split: Clip | null;
  /** Espelhar: como `clip`, só se for visual. */
  visual: Clip | null;
  /** Volume/Velocidade: vídeo ou áudio (selecionado, ou sob o playhead). */
  sound: Clip | null;
};

/**
 * Alvos das ferramentas da timeline. A barra de ferramentas e os atalhos usam a mesma regra,
 * então um botão habilitado sempre tem efeito.
 */
export function editTargets(p: Project | null, selectedClipId: string | null, frame: number): EditTargets {
  if (!p) return { clip: null, split: null, visual: null, sound: null };
  const sel = selectedClipId ? (findClip(p, selectedClipId)?.clip ?? null) : null;
  const under = clipUnder(p, frame);
  const clip = sel ?? under;
  const split = sel && containsFrame(sel, frame) ? sel : clipUnder(p, frame, (c) => containsFrame(c, frame));
  // sem seleção: qualquer vídeo/áudio sob o playhead (ex.: a locução embaixo de uma imagem)
  const sound = sel ? (hasSound(sel) ? sel : null) : clipUnder(p, frame, hasSound);
  return { clip, split, visual: clip && isVisual(clip) ? clip : null, sound };
}

const targets = () => {
  const { project, selectedClipId, frame } = st();
  return editTargets(project, selectedClipId, frame);
};

export function splitAtPlayhead() {
  const { selectedClipIds, frame: at, project } = st();
  // vários selecionados: divide todos os que o playhead atravessa (um passo só no desfazer)
  const many = project ? selectedClipIds.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c && containsFrame(c, at)) : [];
  if (many.length > 1) {
    const rights: string[] = [];
    st().apply((d) => {
      for (const c of many) {
        const r = splitClip(d, c.id, at);
        if (r) rights.push(r);
      }
    });
    st().selectMany(rights);
    return;
  }
  const target = targets().split;
  if (!target) return;
  let rightId: string | null = null;
  st().apply((d) => {
    rightId = splitClip(d, target.id, at);
  });
  if (rightId) st().select(rightId);
}

/** Q (`left`) / W (`right`): apaga a parte do clipe antes/depois do playhead. */
export function trimAtPlayhead(side: 'left' | 'right') {
  const target = targets().split;
  if (!target) return;
  const at = st().frame;
  st().apply((d) => void trimToPlayhead(d, target.id, at, side));
  st().select(target.id);
}

/** Ids da seleção (ou só o principal). */
const selection = (): string[] => {
  const { selectedClipIds, selectedClipId } = st();
  return selectedClipIds.length ? selectedClipIds : selectedClipId ? [selectedClipId] : [];
};

/** Exclui e fecha o buraco na trilha (Shift+Delete). */
export function rippleDeleteSelected() {
  const ids = selection();
  if (!ids.length) return;
  st().apply((d) => rippleDelete(d, ids));
  st().select(null);
}

export function copySelected(): boolean {
  const { project } = st();
  const ids = selection();
  if (!project || !ids.length) return false;
  const clipboard = copyClips(project, ids);
  st().set({ clipboard });
  if (clipboard) st().showToast(`${clipboard.items.length} clipe(s) copiado(s).`);
  return !!clipboard;
}

export function cutSelected() {
  if (copySelected()) deleteSelected();
}

/** Cola no playhead, nas trilhas de origem quando há espaço. */
export function pasteAtPlayhead() {
  const { clipboard, frame } = st();
  if (!clipboard) return;
  let ids: string[] = [];
  st().apply((d) => {
    ids = pasteClips(d, clipboard, frame);
  });
  st().selectMany(ids);
}

export function selectAll() {
  const { project } = st();
  if (!project) return;
  st().selectMany(project.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.filter((c) => !c.locked).map((c) => c.id)));
}

/** Empurra a seleção `frames` para o lado (← / → com Alt). */
export function nudgeSelected(frames: number) {
  const ids = selection();
  if (!ids.length) return;
  st().apply((d) => void moveClips(d, ids, frames), { coalesce: 'nudge' });
}

/** Abre o painel de Volume/Velocidade do clipe com som (selecionando-o, para o painel aparecer). */
export function openSoundPanel(tab: 'audio' | 'speed') {
  const target = targets().sound;
  if (!target) return;
  st().select(target.id);
  st().set({ rightTab: tab });
}

export function deleteSelected() {
  const ids = selection();
  if (!ids.length) return;
  st().apply((d) => {
    for (const id of ids) deleteClip(d, id);
  });
  st().select(null);
}

export function duplicateSelected() {
  const target = targets().clip;
  if (!target) return;
  let copyId: string | null = null;
  st().apply((d) => {
    copyId = duplicateClip(d, target.id);
  });
  if (copyId) st().select(copyId);
}

export function flipSelected(axis: 'x' | 'y') {
  const id = targets().visual?.id;
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
