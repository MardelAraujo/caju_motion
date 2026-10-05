/**
 * Trava de render: qualquer recurso assíncrono (fonte, imagem, decode de vídeo) abre um
 * handle; o exportador só captura o frame quando TODOS os handles forem fechados.
 * Na preview isso é só informativo (spinner de carregamento).
 */

export type RenderHandle = number;

type PendingEntry = { label: string };

export type RenderGate = {
  delayRender(label?: string): RenderHandle;
  continueRender(handle: RenderHandle): void;
  pending(): string[];
  /** Resolve quando não houver pendências. */
  ready(): Promise<void>;
};

export function createRenderGate(): RenderGate {
  let nextHandle = 1;
  const pendingMap = new Map<RenderHandle, PendingEntry>();
  let waiters: Array<() => void> = [];

  const flush = () => {
    if (pendingMap.size > 0) return;
    const current = waiters;
    waiters = [];
    current.forEach((resolve) => resolve());
  };

  return {
    delayRender(label = 'sem rótulo') {
      const handle = nextHandle++;
      pendingMap.set(handle, { label });
      return handle;
    },
    continueRender(handle) {
      if (!pendingMap.delete(handle)) return;
      flush();
    },
    pending() {
      return [...pendingMap.values()].map((e) => e.label);
    },
    ready() {
      if (pendingMap.size === 0) return Promise.resolve();
      return new Promise<void>((resolve) => waiters.push(resolve));
    },
  };
}

/** Gate global da página (o exportador lê via `window.__caju.gate`). */
export const renderGate: RenderGate = createRenderGate();
export const delayRender = (label?: string) => renderGate.delayRender(label);
export const continueRender = (handle: RenderHandle) => renderGate.continueRender(handle);
