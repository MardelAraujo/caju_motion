import { produce, type Draft } from 'immer';
import { create } from 'zustand';
import { projectDuration, type Project } from '@caju-motion/schema';
import { api, ConflictError, type ProjectSummary } from './api';
import type { Clipboard } from './ops';

export type LeftTab = 'media' | 'text' | 'audio' | 'voice' | 'elements' | 'components';
export type RightTab = 'basic' | 'audio' | 'speed' | 'project';
export type Tool = 'select' | 'hand';
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type Recipe = (draft: Draft<Project>) => void;

type EditorState = {
  projects: ProjectSummary[];
  project: Project | null;
  /** Última versão gravada no disco: há alteração não salva quando `project !== savedProject`. */
  savedProject: Project | null;
  /** Versão (hash) do arquivo no disco que corresponde a `savedProject`. */
  diskVersion: string | null;
  saveState: SaveState;
  saveError: string | null;

  past: Project[];
  future: Project[];
  gestureBase: Project | null;
  lastCoalesce: { key: string; at: number } | null;

  frame: number;
  playing: boolean;
  /** Clipe principal da seleção (o último clicado): painéis e canvas mostram este. */
  selectedClipId: string | null;
  /** Todos os selecionados (inclui o principal). Ações em grupo usam esta lista. */
  selectedClipIds: string[];
  /** Área de transferência interna (copiar/colar clipes). */
  clipboard: Clipboard | null;
  editingTextId: string | null;

  pxPerFrame: number;
  snapping: boolean;
  tool: Tool;
  canvasZoom: 'fit' | number;
  leftTab: LeftTab;
  leftOpen: boolean;
  rightTab: RightTab | null;
  toast: string | null;
  uploading: string[];
};

type EditorActions = {
  loadProjects(): Promise<void>;
  /** Abre um projeto. Com alterações não salvas, pergunta antes (retorna false se o usuário cancelar). */
  openProject(id: string): Promise<boolean>;
  /** Grava no disco (botão Salvar / Ctrl+S). */
  save(): Promise<void>;
  /** Relê o projeto do disco mantendo a posição do playhead. */
  reloadProject(): Promise<void>;
  /** Confere se o arquivo mudou no disco; recarrega sozinho se não houver alterações pendentes. */
  checkDisk(): Promise<void>;
  createProject(id: string, format: string): Promise<void>;

  /** Edição com histórico. `coalesce`: edições seguidas com a mesma chave (<1 s) viram um único passo. */
  apply(recipe: Recipe, opts?: { coalesce?: string }): void;
  /** Gestos (arrastar): uma entrada de histórico no fim, não uma por movimento. */
  beginGesture(): void;
  applyFromBase(recipe: Recipe): void;
  endGesture(): void;
  undo(): void;
  redo(): void;

  setFrame(frame: number): void;
  setPlaying(playing: boolean): void;
  /** `replace` (padrão) seleciona só este; `toggle` (Ctrl/Shift) inclui/tira da seleção. */
  select(clipId: string | null, mode?: 'replace' | 'toggle'): void;
  /** Seleção em grupo (ex.: retângulo na timeline). */
  selectMany(clipIds: string[], additive?: boolean): void;
  setEditingText(clipId: string | null): void;
  set(partial: Partial<EditorState>): void;
  showToast(msg: string): void;
};

const HISTORY_LIMIT = 150;

export const useEditor = create<EditorState & EditorActions>((set, get) => ({
  projects: [],
  project: null,
  savedProject: null,
  diskVersion: null,
  saveState: 'idle',
  saveError: null,
  past: [],
  future: [],
  gestureBase: null,
  lastCoalesce: null,
  frame: 0,
  playing: false,
  selectedClipId: null,
  selectedClipIds: [],
  clipboard: null,
  editingTextId: null,
  pxPerFrame: 4,
  snapping: true,
  tool: 'select',
  canvasZoom: 'fit',
  leftTab: 'media',
  leftOpen: true,
  rightTab: null,
  toast: null,
  uploading: [],

  async loadProjects() {
    set({ projects: await api.listProjects() });
  },

  async openProject(id) {
    if (hasUnsavedChanges() && !window.confirm('Há alterações não salvas neste projeto. Descartar e abrir outro?')) return false;
    const { project, version } = await api.getProject(id);
    set({
      project,
      savedProject: project,
      diskVersion: version,
      past: [],
      future: [],
      gestureBase: null,
      frame: 0,
      playing: false,
      selectedClipId: null,
      selectedClipIds: [],
      editingTextId: null,
      saveState: 'saved',
      saveError: null,
    });
    try {
      localStorage.setItem('caju:lastProject', id);
    } catch {
      /* armazenamento indisponível */
    }
    return true;
  },

  save() {
    return save();
  },

  async reloadProject() {
    const { project: current, frame, selectedClipId, selectedClipIds } = get();
    if (!current) return;
    const { project, version } = await api.getProject(current.id);
    set({
      project,
      savedProject: project,
      diskVersion: version,
      past: [],
      future: [],
      gestureBase: null,
      saveState: 'saved',
      saveError: null,
      editingTextId: null,
      selectedClipId: project.tracks.some((t) => t.clips.some((c) => c.id === selectedClipId)) ? selectedClipId : null,
      selectedClipIds: selectedClipIds.filter((id) => project.tracks.some((t) => t.clips.some((c) => c.id === id))),
    });
    get().setFrame(frame);
  },

  async checkDisk() {
    const { project, diskVersion, gestureBase, saveState } = get();
    if (!project || !diskVersion || gestureBase || saveState === 'saving' || diskChangeWarned === diskVersion) return;
    let version: string;
    try {
      version = await api.projectVersion(project.id);
    } catch {
      return;
    }
    if (version === diskVersion || get().project?.id !== project.id) return;
    if (!hasUnsavedChanges()) {
      await get().reloadProject();
      get().showToast('O projeto foi atualizado no disco e recarregado.');
    } else {
      diskChangeWarned = diskVersion;
      get().showToast('Atenção: o projeto mudou no disco. Ao salvar, você vai escolher se sobrescreve.');
    }
  },

  async createProject(id, format) {
    await api.createProject(id, format);
    await get().loadProjects();
    await get().openProject(id);
  },

  apply(recipe, opts) {
    const { project, past, lastCoalesce } = get();
    if (!project) return;
    // recipe envolvida: funções de edição podem retornar valores (ids), que o immer interpretaria como "substituir o doc"
    const next = produce(project, (d) => {
      recipe(d);
    });
    if (next === project) return;
    const now = Date.now();
    const merge = opts?.coalesce && lastCoalesce?.key === opts.coalesce && now - lastCoalesce.at < 1000;
    set({
      project: next,
      past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastCoalesce: opts?.coalesce ? { key: opts.coalesce, at: now } : null,
    });
    markDirty();
  },

  beginGesture() {
    set({ gestureBase: get().project, lastCoalesce: null });
  },

  applyFromBase(recipe) {
    const base = get().gestureBase;
    if (!base) return;
    set({
      project: produce(base, (d) => {
        recipe(d);
      }),
    });
  },

  endGesture() {
    const { gestureBase, project, past } = get();
    set({ gestureBase: null });
    if (!gestureBase || !project || gestureBase === project) return;
    if (JSON.stringify(gestureBase) === JSON.stringify(project)) {
      set({ project: gestureBase });
      return;
    }
    set({ past: [...past, gestureBase].slice(-HISTORY_LIMIT), future: [] });
    markDirty();
  },

  undo() {
    const { past, future, project } = get();
    const prev = past[past.length - 1];
    if (!prev || !project) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastCoalesce: null, editingTextId: null });
    markDirty();
  },

  redo() {
    const { past, future, project } = get();
    const next = future[0];
    if (!next || !project) return;
    set({ project: next, past: [...past, project], future: future.slice(1), lastCoalesce: null, editingTextId: null });
    markDirty();
  },

  setFrame(frame) {
    const { project } = get();
    if (!project) return;
    const max = projectDuration(project) - 1;
    set({ frame: Math.max(0, Math.min(max, Math.round(frame))) });
  },

  setPlaying(playing) {
    const { project, frame } = get();
    if (playing && project && frame >= projectDuration(project) - 1) set({ frame: 0 });
    set({ playing, editingTextId: null });
  },

  select(clipId, mode = 'replace') {
    const { editingTextId, selectedClipIds } = get();
    if (mode === 'toggle' && clipId) {
      const has = selectedClipIds.includes(clipId);
      const ids = has ? selectedClipIds.filter((id) => id !== clipId) : [...selectedClipIds, clipId];
      set({ selectedClipIds: ids, selectedClipId: has ? (ids[ids.length - 1] ?? null) : clipId, editingTextId: null });
      return;
    }
    set({
      selectedClipId: clipId,
      selectedClipIds: clipId ? [clipId] : [],
      editingTextId: editingTextId === clipId ? editingTextId : null,
    });
  },

  selectMany(clipIds, additive = false) {
    const ids = additive ? [...new Set([...get().selectedClipIds, ...clipIds])] : [...new Set(clipIds)];
    set({ selectedClipIds: ids, selectedClipId: ids[ids.length - 1] ?? null, editingTextId: null });
  },

  setEditingText(clipId) {
    const selectedClipId = clipId ?? get().selectedClipId;
    set({ editingTextId: clipId, selectedClipId, selectedClipIds: selectedClipId ? [selectedClipId] : [], playing: false });
  },

  set(partial) {
    set(partial);
  },

  showToast(msg) {
    set({ toast: msg });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 3500);
  },
}));

let toastTimer = 0;
/** Evita repetir o aviso de "mudou no disco" para a mesma versão. */
let diskChangeWarned: string | null = null;

// ---------------------------------------------------------------- salvamento (manual)

let saving: Promise<void> | null = null;

export function hasUnsavedChanges(): boolean {
  const { project, savedProject } = useEditor.getState();
  return !!project && project !== savedProject;
}

/** Recalcula o estado de salvamento: desfazer até a versão salva volta a "salvo". */
function markDirty() {
  const { saveState } = useEditor.getState();
  if (saveState === 'saving') return;
  useEditor.setState({ saveState: hasUnsavedChanges() ? 'dirty' : 'saved' });
}

async function save(force = false): Promise<void> {
  if (saving) await saving;
  const { project, gestureBase, diskVersion } = useEditor.getState();
  if (!project || gestureBase || !hasUnsavedChanges()) return;
  useEditor.setState({ saveState: 'saving' });
  let conflict = false;
  saving = api
    .saveProject(project, diskVersion, force)
    .then((version) => {
      diskChangeWarned = null;
      useEditor.setState({ savedProject: project, diskVersion: version, saveError: null });
      useEditor.setState({ saveState: hasUnsavedChanges() ? 'dirty' : 'saved' });
      useEditor.getState().showToast('Alterações salvas.');
    })
    .catch((err: Error) => {
      if (err instanceof ConflictError) {
        conflict = true;
        useEditor.setState({ saveState: 'dirty' });
        return;
      }
      useEditor.setState({ saveState: 'error', saveError: err.message });
      useEditor.getState().showToast(`Não foi possível salvar: ${err.message}`);
    })
    .finally(() => {
      saving = null;
    });
  await saving;
  if (!conflict) return;
  const overwrite = window.confirm(
    'Este projeto foi alterado no disco depois que você o abriu (por exemplo, foi regenerado).\n\n' +
      'OK = salvar as SUAS alterações por cima (a versão do disco vai para o histórico).\n' +
      'Cancelar = não salvar agora (recarregue a página para ver a versão do disco).',
  );
  if (overwrite) await save(true);
}

/** Seletores úteis. */
export const selectedClip = (s: EditorState) => {
  if (!s.project || !s.selectedClipId) return null;
  for (const t of s.project.tracks) {
    const c = t.clips.find((c) => c.id === s.selectedClipId);
    if (c) return { clip: c, track: t };
  }
  return null;
};
