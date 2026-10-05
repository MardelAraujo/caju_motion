import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RenderView } from './RenderView';
import { useEditor } from './store';
import './styles.css';

// gancho para automação/testes E2E (ex.: posicionar o playhead via script)
(window as unknown as { __cajuStudio: typeof useEditor }).__cajuStudio = useEditor;

const params = new URLSearchParams(location.search);
const renderId = params.get('render');
if (renderId) document.documentElement.classList.add('render-mode');

/**
 * Fontes locais opcionais (não versionadas): `public/fonts/local/fonts.css`.
 * Carregadas ANTES de montar, para o modo de render já esperar por elas em `document.fonts.ready`.
 */
async function loadLocalFonts(): Promise<void> {
  try {
    const res = await fetch('/fonts/local/fonts.css', { cache: 'no-cache' });
    if (!res.ok || !res.headers.get('content-type')?.includes('css')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/fonts/local/fonts.css';
    await new Promise((resolve) => {
      link.onload = link.onerror = resolve;
      document.head.append(link);
    });
  } catch {
    // sem fontes locais
  }
}

void loadLocalFonts().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {renderId ? <RenderView projectId={renderId} frame={Number(params.get('frame') ?? 0)} /> : <App />}
    </StrictMode>,
  ),
);
