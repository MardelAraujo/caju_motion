import { create } from 'zustand';
import type { ExportSettings } from '@caju-motion/schema';
import { useEditor } from './store';

/** Espelho do `RenderJob` de `@caju-motion/renderer-node` (o Studio não importa código Node). */
export type RenderJob = {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'canceled';
  settings: ExportSettings;
  progress: { stage: 'preparing' | 'rendering' | 'encoding' | 'done'; frame: number; total: number; speed: number; etaSec: number | null };
  createdAt: string;
  finishedAt?: string;
  fileName?: string;
  sizeBytes?: number;
  error?: string;
};

export const isActive = (j: RenderJob | null): boolean => !!j && (j.status === 'queued' || j.status === 'running');
export const jobFileUrl = (j: RenderJob) => `/api/render/jobs/${encodeURIComponent(j.id)}/file`;

/** Fração concluída (0..1), contando a codificação final como o último pedaço. */
export function jobFraction(j: RenderJob): number {
  if (j.status === 'done') return 1;
  const { frame, total, stage } = j.progress;
  if (stage === 'encoding') return 0.99;
  return total > 0 ? Math.min(0.98, frame / total) : 0;
}

type RenderJobsState = {
  job: RenderJob | null;
  start(projectId: string, settings: ExportSettings): Promise<RenderJob>;
  cancel(): Promise<void>;
  clear(): void;
};

const POLL_MS = 500;
let timer: ReturnType<typeof setTimeout> | null = null;

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `HTTP ${res.status}`;
}

/** Job de export atual: inicia no servidor (`/api/projects/:id/render`) e acompanha por polling. */
export const useRenderJobs = create<RenderJobsState>((set, get) => {
  const poll = () => {
    timer = null;
    const job = get().job;
    if (!isActive(job)) return;
    void fetch(`/api/render/jobs/${encodeURIComponent(job!.id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        return (await res.json()) as RenderJob;
      })
      .then(
        (j) => {
          if (get().job?.id !== j.id) return;
          set({ job: j });
          const toast = useEditor.getState().showToast;
          if (j.status === 'done') toast(`Exportação concluída: ${j.fileName ?? 'arquivo pronto'}. Baixe pelo botão Exportar.`);
          else if (j.status === 'error') toast(`Exportação falhou: ${j.error ?? 'erro desconhecido'}`);
        },
        (e: Error) => {
          const cur = get().job;
          if (cur?.id === job!.id) set({ job: { ...cur, status: 'error', error: e.message } });
        },
      )
      .finally(() => {
        if (isActive(get().job)) timer = setTimeout(poll, POLL_MS);
      });
  };

  return {
    job: null,
    async start(projectId, settings) {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.status === 404 && !(await res.clone().json().catch(() => null))) {
        throw new Error('este servidor não tem a rota de render (atualize o caju)');
      }
      if (!res.ok) throw new Error(await readError(res));
      const { job } = (await res.json()) as { job: RenderJob };
      set({ job });
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, POLL_MS);
      return job;
    },
    async cancel() {
      const job = get().job;
      if (!isActive(job)) return;
      const res = await fetch(`/api/render/jobs/${encodeURIComponent(job!.id)}/cancel`, { method: 'POST' });
      if (res.ok) set({ job: (await res.json()) as RenderJob });
    },
    clear() {
      if (!isActive(get().job)) set({ job: null });
    },
  };
});
