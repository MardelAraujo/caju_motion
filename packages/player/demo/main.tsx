import { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '../src';

/**
 * Página de teste do player (`npm run demo -w @caju-motion/player`, também usada pelo teste no navegador).
 * `?dir=<pasta do projeto>` (caminho absoluto, servido pelo /@fs/ do Vite), `&loop=1`, `&controls=0`.
 */
declare global {
  interface Window {
    __player: PlayerRef | null;
    __events: string[];
  }
}

const q = new URLSearchParams(location.search);
const dir = (q.get('dir') ?? '').replace(/\\/g, '/').replace(/\/?$/, '/');
const base = `/@fs/${dir.replace(/^\//, '')}`;
const ref = createRef<PlayerRef>();
window.__events = [];
const log = (e: string) => window.__events.push(e);

const project = await fetch(`${base}project.json`).then((r) => r.json());
Object.defineProperty(window, '__player', { get: () => ref.current });

createRoot(document.getElementById('root')!).render(
  <Player
    ref={ref}
    project={project}
    assetBase={base}
    controls={q.get('controls') !== '0'}
    loop={q.get('loop') === '1'}
    playbackRate={Number(q.get('rate') ?? 1)}
    onPlay={() => log('play')}
    onPause={() => log('pause')}
    onEnded={() => log('ended')}
    onError={(m) => log(`error:${m}`)}
  />,
);
