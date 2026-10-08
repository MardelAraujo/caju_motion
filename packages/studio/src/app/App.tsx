import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CanvasArea } from './components/CanvasArea';
import { LeftRail } from './components/LeftRail';
import { RightRail } from './components/RightRail';
import { Timeline, useFitTimeline } from './components/Timeline';
import { TimelineToolbar } from './components/TimelineToolbar';
import { TopBar } from './components/TopBar';
import { AudioLayer, SHORTCUTS, usePlaybackClock, useShortcuts } from './playback';
import { useRenderJobs } from './renderJobs';
import { hasUnsavedChanges, useEditor } from './store';

/**
 * Layout no modelo do CapCut:
 *  [trilho esq.][painel esq.][ barra superior                    ]
 *                            [ canvas            ][painel][trilho]
 *                            [ barra da timeline                  ]
 *                            [ timeline                           ]
 */
export function App() {
  const project = useEditor((s) => s.project);
  const leftOpen = useEditor((s) => s.leftOpen);
  const toast = useEditor((s) => s.toast);
  const [error, setError] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fitTimeline = useFitTimeline(scrollRef);

  usePlaybackClock();
  useShortcuts();

  // export em andamento (ex.: a página foi recarregada): volta a acompanhar
  const projectId = project?.id;
  useEffect(() => {
    if (projectId) void useRenderJobs.getState().recover(projectId);
  }, [projectId]);

  useEffect(() => {
    const { loadProjects, openProject } = useEditor.getState();
    (async () => {
      await loadProjects();
      const list = useEditor.getState().projects.filter((p) => p.valid);
      let last: string | null = null;
      try {
        last = localStorage.getItem('caju:lastProject') ?? localStorage.getItem('frame:lastProject');
      } catch {
        /* armazenamento indisponível */
      }
      const target = list.find((p) => p.id === last) ?? list[0];
      if (target) await openProject(target.id);
    })().catch((err: Error) => setError(err.message));

    // fechar/recarregar com alterações não salvas: o navegador pede confirmação
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);

    // o projeto pode mudar no disco (gerador, outra aba): confere a cada 4 s e ao voltar para a janela
    const check = () => void useEditor.getState().checkDisk();
    const timer = window.setInterval(check, 4000);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className={`app ${leftOpen ? '' : 'left-closed'}`}>
      <LeftRail onShowShortcuts={() => setShortcuts(true)} />

      <div className="main-col">
        <TopBar />
        <div className="workspace">
          <CanvasArea />
          <RightRail />
        </div>
        <TimelineToolbar onFit={fitTimeline} />
        <Timeline scrollRef={scrollRef} />
      </div>

      <AudioLayer />

      {!project && !error && <div className="boot">Carregando projeto…</div>}
      {error && <div className="boot is-error">{error}</div>}
      {toast && <div className="toast">{toast}</div>}

      {shortcuts && (
        <div className="modal-backdrop" onClick={() => setShortcuts(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Atalhos de teclado</h3>
              <button type="button" className="icon-btn" onClick={() => setShortcuts(false)}>
                <X size={16} />
              </button>
            </header>
            <dl className="shortcut-list">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
