import { projectDuration } from '@caju-motion/schema';
import {
  copySelected,
  cutSelected,
  deleteSelected,
  duplicateSelected,
  nudgeSelected,
  pasteAtPlayhead,
  rippleDeleteSelected,
  selectAll,
  splitAtPlayhead,
  togglePlay,
  trimAtPlayhead,
} from './commands';
import { useEditor } from './store';

/**
 * Registro de ações do Studio: cada ação tem id, rótulo, grupo e atalhos padrão. Os atalhos são
 * remapeáveis (guardados no navegador) e a janela de atalhos é gerada daqui, então o que aparece
 * lá é sempre o que funciona.
 *
 * Formato do atalho: `mod+shift+alt+tecla` (mod = Ctrl, ou ⌘ no Mac), tecla em minúsculas;
 * nomes especiais: space, left, right, up, down, delete, backspace, home, end, escape.
 */

export type ActionGroup = 'Arquivo' | 'Reprodução' | 'Edição' | 'Seleção' | 'Navegação' | 'Ferramentas';
export type ActionDef = {
  id: string;
  label: string;
  group: ActionGroup;
  keys: string[];
  run(): void;
  /** Funciona mesmo com o foco num campo de texto. */
  global?: boolean;
};

const st = () => useEditor.getState();
const step = (frames: number) => {
  const s = st();
  if (s.project) s.setFrame(s.frame + frames);
};
const fps = () => st().project?.settings.fps ?? 30;

export const ACTIONS: ActionDef[] = [
  { id: 'save', label: 'Salvar alterações', group: 'Arquivo', keys: ['mod+s'], run: () => void st().save(), global: true },
  { id: 'play', label: 'Reproduzir / pausar', group: 'Reprodução', keys: ['space', 'k'], run: togglePlay },
  { id: 'frame-back', label: 'Quadro anterior', group: 'Navegação', keys: ['left'], run: () => step(-1) },
  { id: 'frame-forward', label: 'Próximo quadro', group: 'Navegação', keys: ['right'], run: () => step(1) },
  { id: 'second-back', label: 'Voltar 1 s', group: 'Navegação', keys: ['shift+left', 'j'], run: () => step(-fps()) },
  { id: 'second-forward', label: 'Avançar 1 s', group: 'Navegação', keys: ['shift+right', 'l'], run: () => step(fps()) },
  { id: 'go-start', label: 'Ir para o início', group: 'Navegação', keys: ['home'], run: () => st().setFrame(0) },
  {
    id: 'go-end',
    label: 'Ir para o fim',
    group: 'Navegação',
    keys: ['end'],
    run: () => {
      const p = st().project;
      if (p) st().setFrame(projectDuration(p));
    },
  },
  { id: 'undo', label: 'Desfazer', group: 'Edição', keys: ['mod+z'], run: () => st().undo() },
  { id: 'redo', label: 'Refazer', group: 'Edição', keys: ['mod+shift+z', 'mod+y'], run: () => st().redo() },
  { id: 'split', label: 'Dividir no playhead', group: 'Edição', keys: ['s', 'mod+b'], run: splitAtPlayhead },
  { id: 'trim-left', label: 'Apagar à esquerda do playhead', group: 'Edição', keys: ['q'], run: () => trimAtPlayhead('left') },
  { id: 'trim-right', label: 'Apagar à direita do playhead', group: 'Edição', keys: ['w'], run: () => trimAtPlayhead('right') },
  { id: 'delete', label: 'Excluir', group: 'Edição', keys: ['delete', 'backspace'], run: deleteSelected },
  { id: 'ripple-delete', label: 'Excluir e fechar o espaço', group: 'Edição', keys: ['shift+delete', 'shift+backspace'], run: rippleDeleteSelected },
  { id: 'duplicate', label: 'Duplicar', group: 'Edição', keys: ['mod+d'], run: duplicateSelected },
  { id: 'copy', label: 'Copiar', group: 'Edição', keys: ['mod+c'], run: () => void copySelected() },
  { id: 'cut', label: 'Recortar', group: 'Edição', keys: ['mod+x'], run: cutSelected },
  { id: 'paste', label: 'Colar no playhead', group: 'Edição', keys: ['mod+v'], run: pasteAtPlayhead },
  { id: 'nudge-left', label: 'Empurrar seleção 1 quadro para a esquerda', group: 'Edição', keys: ['alt+left'], run: () => nudgeSelected(-1) },
  { id: 'nudge-right', label: 'Empurrar seleção 1 quadro para a direita', group: 'Edição', keys: ['alt+right'], run: () => nudgeSelected(1) },
  { id: 'select-all', label: 'Selecionar tudo', group: 'Seleção', keys: ['mod+a'], run: selectAll },
  { id: 'deselect', label: 'Tirar seleção', group: 'Seleção', keys: ['escape'], run: () => st().select(null) },
  { id: 'tool-select', label: 'Ferramenta selecionar', group: 'Ferramentas', keys: ['v'], run: () => st().set({ tool: 'select' }) },
  { id: 'tool-hand', label: 'Ferramenta mover tela', group: 'Ferramentas', keys: ['h'], run: () => st().set({ tool: 'hand' }) },
  { id: 'zoom-in', label: 'Zoom da timeline +', group: 'Ferramentas', keys: ['=', 'plus'], run: () => st().set({ pxPerFrame: Math.min(24, st().pxPerFrame * 1.4) }) },
  { id: 'zoom-out', label: 'Zoom da timeline −', group: 'Ferramentas', keys: ['-'], run: () => st().set({ pxPerFrame: Math.max(0.05, st().pxPerFrame / 1.4) }) },
];

// ---------------------------------------------------------------- atalhos

const KEY_NAMES: Record<string, string> = {
  ' ': 'space',
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  del: 'delete',
  esc: 'escape',
  '+': 'plus',
};

/** Atalho normalizado de um evento de teclado (`mod+shift+z`). Só modificadores: `null`. */
export function comboOf(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): string | null {
  const raw = e.key.toLowerCase();
  if (['control', 'meta', 'shift', 'alt', 'os'].includes(raw)) return null;
  const key = KEY_NAMES[raw] ?? raw;
  // símbolos (+, =, -) dependem do layout do teclado: o Shift usado para digitá-los não conta
  const symbol = raw.length === 1 && !/[a-z0-9]/.test(raw);
  return [e.ctrlKey || e.metaKey ? 'mod' : '', e.shiftKey && !symbol ? 'shift' : '', e.altKey ? 'alt' : '', key].filter(Boolean).join('+');
}

const LABELS: Record<string, string> = { mod: 'Ctrl', shift: 'Shift', alt: 'Alt', space: 'Espaço', left: '←', right: '→', up: '↑', down: '↓', delete: 'Delete', backspace: 'Backspace', escape: 'Esc', home: 'Home', end: 'End', plus: '+' };

/** Texto do atalho para a interface (`Ctrl+Shift+Z`). */
export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .filter(Boolean)
    .map((p) => LABELS[p] ?? (p.length === 1 ? p.toUpperCase() : p))
    .join('+');
}

const STORAGE_KEY = 'caju:keybindings';
type Overrides = Record<string, string[]>;

function readOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : {};
    return data && typeof data === 'object' ? (data as Overrides) : {};
  } catch {
    return {};
  }
}

function writeOverrides(o: Overrides) {
  try {
    if (Object.keys(o).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento indisponível: o atalho vale só nesta sessão
  }
  overrides = o;
}

let overrides: Overrides = typeof localStorage === 'undefined' ? {} : readOverrides();

/** Atalhos efetivos de cada ação (personalizados ou padrão). */
export function bindings(): Record<string, string[]> {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, overrides[a.id] ?? a.keys]));
}

/**
 * Define o atalho de uma ação. Se outra ação usava o mesmo atalho, ele sai dela (um atalho, uma
 * ação). Retorna o rótulo da ação que perdeu o atalho, para avisar.
 */
export function setBinding(actionId: string, combo: string): string | null {
  const current = bindings();
  let taken: string | null = null;
  const next: Overrides = { ...overrides };
  for (const a of ACTIONS) {
    if (a.id !== actionId && current[a.id]!.includes(combo)) {
      next[a.id] = current[a.id]!.filter((k) => k !== combo);
      taken = a.label;
    }
  }
  next[actionId] = [combo];
  writeOverrides(next);
  return taken;
}

export function resetBindings() {
  writeOverrides({});
}

/** Ação do atalho, considerando as personalizações. */
export function actionFor(combo: string): ActionDef | undefined {
  const b = bindings();
  return ACTIONS.find((a) => b[a.id]!.includes(combo));
}
