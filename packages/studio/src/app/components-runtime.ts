import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxDevRuntime from 'react/jsx-dev-runtime';
import * as jsxRuntime from 'react/jsx-runtime';
import { create } from 'zustand';
import * as core from '@caju-motion/core';
import * as renderer from '@caju-motion/renderer';
import { componentsFromModule, setComponents } from '@caju-motion/renderer';

/**
 * Componentes do usuário no Studio: o servidor empacota `components/` (esbuild) com React e os
 * pacotes do Caju trocados por `globalThis.__cajuRuntime[...]`. Aqui preenchemos esse objeto
 * com as MESMAS instâncias do app (um React só) e importamos o bundle.
 * No editor, a pasta é vigiada (consulta de versão) e o registro é trocado a quente.
 */

declare global {
  // eslint-disable-next-line no-var
  var __cajuRuntime: Record<string, unknown> | undefined;
}

export function installRuntime(): void {
  globalThis.__cajuRuntime = {
    react: React,
    'react-dom': ReactDOM,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxDevRuntime,
    '@caju-motion/core': core,
    '@caju-motion/renderer': renderer,
  };
}

export type ComponentsStatus = {
  /** `unavailable`: servidor sem a rota de componentes. */
  state: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  version: string | null;
  dir: string | null;
  files: string[];
  errors: string[];
  /** Quantas vezes o registro foi recarregado (para avisos "atualizado"). */
  reloads: number;
};

export const useComponentsStatus = create<ComponentsStatus>(() => ({
  state: 'idle',
  version: null,
  dir: null,
  files: [],
  errors: [],
  reloads: 0,
}));

type VersionInfo = { version: string; dir: string; ok: boolean; files: string[]; errors?: string[] };

async function fetchVersion(): Promise<VersionInfo | null> {
  const res = await fetch('/api/components/version', { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as VersionInfo;
}

let loading: Promise<void> | null = null;

/** Carrega (ou recarrega) o bundle. Nunca rejeita: erros vão para `useComponentsStatus`. */
export function loadComponents(): Promise<void> {
  loading ??= (async () => {
    const set = useComponentsStatus.setState;
    try {
      const info = await fetchVersion();
      if (!info) {
        set({ state: 'unavailable' });
        return;
      }
      set({ dir: info.dir, files: info.files });
      if (!info.ok) {
        // mantém os componentes da última versão boa; mostra os erros
        set({ state: 'error', version: info.version, errors: info.errors ?? [] });
        return;
      }
      if (info.version === useComponentsStatus.getState().version && useComponentsStatus.getState().state === 'ready') return;
      set({ state: 'loading' });
      const url = `/api/components/bundle.js?v=${encodeURIComponent(info.version)}`;
      const mod = (await import(/* @vite-ignore */ url)) as { modules?: Record<string, unknown>[] };
      const defs = (mod.modules ?? []).flatMap((m) => componentsFromModule(m));
      const names = new Map<string, number>();
      for (const d of defs) names.set(d.name, (names.get(d.name) ?? 0) + 1);
      const dups = [...names].filter(([, n]) => n > 1).map(([n]) => `componente "${n}" definido mais de uma vez`);
      setComponents(defs);
      set((s) => ({ state: 'ready', version: info.version, errors: dups, reloads: s.reloads + 1 }));
    } catch (err) {
      set({ state: 'error', errors: [`falha ao carregar componentes: ${(err as Error).message}`] });
    }
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Recarga a quente: consulta a versão da pasta e recarrega quando mudar. Retorna o "parar". */
export function watchComponents(intervalMs = 1000): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    const s = useComponentsStatus.getState();
    if (s.state !== 'unavailable') {
      try {
        const info = await fetchVersion();
        if (info && (info.version !== s.version || (!info.ok && s.state !== 'error') || (info.ok && s.state === 'error'))) {
          await loadComponents();
        }
      } catch {
        // servidor fora do ar: tenta de novo no próximo ciclo
      }
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };
  timer = setTimeout(() => void tick(), intervalMs);
  // aba em segundo plano tem timers estrangulados: ao voltar, confere na hora
  const onVisible = () => {
    if (!document.hidden) void loadComponents();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
