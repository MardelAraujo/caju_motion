import {
  ChevronDown,
  Cloud,
  CloudAlert,
  CloudUpload,
  Ellipsis,
  Hand,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { ExportPopover } from './ExportPopover';
import { FORMATS, FORMAT_IDS } from '@caju-motion/schema';
import { useEditor } from '../store';
import { Dropdown, IconButton } from '../ui';

const ZOOMS: ('fit' | number)[] = ['fit', 0.25, 0.5, 0.75, 1, 1.5, 2];

export function TopBar() {
  const project = useEditor((s) => s.project);
  const projects = useEditor((s) => s.projects);
  const saveState = useEditor((s) => s.saveState);
  const saveError = useEditor((s) => s.saveError);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.canvasZoom);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { set, undo, redo, openProject, createProject, showToast, save } = useEditor.getState();

  const dirty = saveState === 'dirty' || saveState === 'error';
  const SaveIcon = saveState === 'error' ? CloudAlert : saveState === 'saving' || dirty ? CloudUpload : Cloud;
  const saveLabel =
    saveState === 'error'
      ? `Erro ao salvar: ${saveError ?? ''}`
      : saveState === 'saving'
        ? 'Salvando…'
        : dirty
          ? 'Alterações não salvas (Ctrl+S para salvar)'
          : 'Todas as alterações foram salvas';

  const onNew = async (close: () => void) => {
    close();
    const id = window.prompt('Nome do novo projeto (ex.: campanha-outubro)')?.trim();
    if (!id) return;
    const format = window.prompt(`Formato (${FORMAT_IDS.join(', ')})`, 'reel-9x16')?.trim() || 'reel-9x16';
    try {
      await createProject(id.replace(/\s+/g, '-'), format);
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="brand-wordmark" aria-label="Caju Studio">
          <b>caju</b>
          <span>studio</span>
        </span>
        <span className="topbar-sep" />
        <span className={`save-state is-${saveState}`} title={saveLabel}>
          <SaveIcon size={18} strokeWidth={1.75} />
        </span>
        <Dropdown
          trigger={(open, toggle) => (
            <button type="button" className={`project-name ${open ? 'is-open' : ''}`} onClick={toggle}>
              <span>{project?.name ?? 'Sem projeto'}</span>
              <ChevronDown size={16} />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="menu-label">Projetos</div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`menu-item ${p.id === project?.id ? 'is-active' : ''}`}
                  disabled={!p.valid}
                  title={p.valid ? undefined : p.error}
                  onClick={() => {
                    close();
                    void openProject(p.id);
                  }}
                >
                  <span>{p.valid ? p.name : `${p.id} (inválido)`}</span>
                  {p.valid && <small>{FORMATS[p.format as keyof typeof FORMATS]?.label.split(' ')[0] ?? p.format}</small>}
                </button>
              ))}
              <div className="menu-sep" />
              <button type="button" className="menu-item" onClick={() => void onNew(close)}>
                <Plus size={14} /> <span>Novo projeto</span>
              </button>
            </>
          )}
        </Dropdown>
      </div>

      <div className="topbar-center">
        <div className="tool-group">
          <IconButton icon={MousePointer2} label="Selecionar (V)" active={tool === 'select'} onClick={() => set({ tool: 'select' })} />
          <IconButton icon={Hand} label="Mover a tela (H)" active={tool === 'hand'} onClick={() => set({ tool: 'hand' })} />
        </div>
        <Dropdown
          trigger={(open, toggle) => (
            <button type="button" className={`zoom-btn ${open ? 'is-open' : ''}`} onClick={toggle}>
              {zoom === 'fit' ? 'Ajustar' : `${Math.round(zoom * 100)}%`} <ChevronDown size={14} />
            </button>
          )}
        >
          {(close) =>
            ZOOMS.map((z) => (
              <button
                key={String(z)}
                type="button"
                className={`menu-item ${z === zoom ? 'is-active' : ''}`}
                onClick={() => {
                  set({ canvasZoom: z });
                  close();
                }}
              >
                {z === 'fit' ? 'Ajustar à tela' : `${Math.round(z * 100)}%`}
              </button>
            ))
          }
        </Dropdown>
        <span className="topbar-sep" />
        <IconButton icon={Undo2} label="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
        <IconButton icon={Redo2} label="Refazer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} />
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className={`save-btn ${dirty ? 'is-dirty' : ''}`}
          disabled={!dirty}
          onClick={() => void save()}
          title={saveLabel}
        >
          <Save size={16} strokeWidth={2} />
          {saveState === 'saving' ? 'Salvando…' : dirty ? 'Salvar' : 'Salvo'}
        </button>
        <ExportPopover />
        <IconButton icon={Ellipsis} label="Mais" onClick={() => showToast('Mais opções em breve.')} />
      </div>
    </header>
  );
}
