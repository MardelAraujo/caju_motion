import { useEffect, useRef, useState } from 'react';
import { renderGate } from '@caju-motion/core';
import { ProjectRenderer, RenderModeContext } from '@caju-motion/renderer';
import type { Project } from '@caju-motion/schema';
import { api, assetUrl } from './api';

/** API da página de render, usada pelo exportador (`@caju-motion/renderer-node`) via Playwright. */
export type CajuRenderApi = {
  /** Resolve quando o projeto carregou e o quadro inicial está pronto (rejeita se o projeto falhar). */
  ready: Promise<void>;
  /** Troca o quadro sem recarregar a página e resolve quando ele estiver pronto para captura. */
  setFrame(frame: number): Promise<void>;
  /** Rótulos dos handles ainda abertos no render gate (diagnóstico de travas). */
  pending(): string[];
  /** Dimensões e fps do projeto carregado. */
  info(): { width: number; height: number; fps: number } | null;
};

declare global {
  interface Window {
    __caju?: CajuRenderApi;
  }
}

/** Espera fontes, handles do render gate (imagens, vídeo, componentes) e uma pintura. */
async function settle(): Promise<void> {
  await document.fonts.ready;
  await renderGate.ready();
  // algo carregado no meio do caminho pode ter pedido mais fontes
  await document.fonts.ready;
  await renderGate.ready();
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

/**
 * Modo de render: `/?render=<projeto>&frame=<n>` mostra SÓ o quadro, em tamanho real
 * (sem editor). Base do export e das capturas de verificação.
 * Expõe `window.__caju` (ready / setFrame) e marca `data-frame-ready="1"` no <html> quando
 * o quadro atual está pronto (fontes, imagens decodificadas, vídeo no quadro exato).
 */
export function RenderView({ projectId, frame: initialFrame }: { projectId: string; frame: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrameState] = useState(initialFrame);

  const frameRef = useRef(initialFrame);
  const projectRef = useRef<Project | null>(null);
  /** Quem espera o próximo commit do React (setFrame / carga do projeto). */
  const commitWaiters = useRef<Array<() => void>>([]);
  const loaded = useRef<{ promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } | null>(null);

  if (!loaded.current) {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.catch(() => undefined); // evita "unhandled rejection" se ninguém estiver esperando
    loaded.current = { promise, resolve, reject };
  }

  useEffect(() => {
    const root = document.documentElement;
    const waitCommit = () => new Promise<void>((r) => commitWaiters.current.push(r));
    let chain: Promise<void> = Promise.resolve();

    const api: CajuRenderApi = {
      ready: loaded.current!.promise.then(settle).then(() => {
        root.dataset.frameReady = '1';
      }),
      setFrame(n) {
        // chamadas em sequência: um quadro de cada vez
        const run = chain.catch(() => undefined).then(async () => {
          await loaded.current!.promise;
          delete root.dataset.frameReady;
          if (n !== frameRef.current) {
            const committed = waitCommit();
            frameRef.current = n;
            setFrameState(n);
            await committed;
          }
          await settle();
          root.dataset.frameReady = '1';
        });
        chain = run;
        return run;
      },
      pending: () => renderGate.pending(),
      info: () => {
        const s = projectRef.current?.settings;
        return s ? { width: s.width, height: s.height, fps: s.fps } : null;
      },
    };
    api.ready.catch(() => undefined);
    window.__caju = api;
    return () => {
      if (window.__caju === api) delete window.__caju;
    };
  }, []);

  useEffect(() => {
    api.getProject(projectId).then(
      (r) => {
        projectRef.current = r.project;
        setProject(r.project);
      },
      (e: Error) => {
        setError(e.message);
        loaded.current!.reject(new Error(`projeto "${projectId}": ${e.message}`));
      },
    );
  }, [projectId]);

  // efeitos do pai rodam depois dos efeitos dos filhos: aqui os handles do quadro novo já foram abertos
  useEffect(() => {
    if (!project) return;
    loaded.current!.resolve();
    const waiters = commitWaiters.current;
    commitWaiters.current = [];
    waiters.forEach((r) => r());
  }, [project, frame]);

  if (error) return <pre style={{ color: 'red' }}>{error}</pre>;
  if (!project) return null;
  const { width, height } = project.settings;
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <RenderModeContext.Provider value={true}>
        <ProjectRenderer project={project} frame={frame} resolveAsset={(a) => assetUrl(project.id, a)} />
      </RenderModeContext.Provider>
    </div>
  );
}
