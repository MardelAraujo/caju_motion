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
  startedAt?: string;
  finishedAt?: string;
  fileName?: string;
  /** Caminho completo da saída no disco. */
  outputPath?: string;
  sizeBytes?: number;
  error?: string;
};

export const isActive = (j: RenderJob | null): boolean => !!j && (j.status === 'queued' || j.status === 'running');
export const jobFileUrl = (j: RenderJob) => `/api/render/jobs/${encodeURIComponent(j.id)}/file`;
/** A saída é um arquivo baixável (a sequência PNG é uma pasta). */
export const jobDownloadable = (j: RenderJob) => j.status === 'done' && !!j.fileName && j.settings.format !== 'png-seq';

/** Fração concluída (0..1), contando a codificação final como o último pedaço. */
export function jobFraction(j: RenderJob): number {
  if (j.status === 'done') return 1;
  const { frame, total, stage } = j.progress;
  if (stage === 'encoding') return 0.99;
  return total > 0 ? Math.min(0.98, frame / total) : 0;
}

type RenderJobsState = {
  job: RenderJob | null;
  /** Quando (relógio local) o job entrou na etapa atual: mostra "há N s" enquanto nada muda. */
  stageSince: number;
  /** Falhas seguidas ao consultar o servidor (rede, servidor reiniciando). */
  pollFailures: number;
  start(projectId: string, settings: ExportSettings): Promise<RenderJob>;
  cancel(): Promise<void>;
  clear(): void;
  /** Ao abrir um projeto: retoma o acompanhamento de um export em andamento (ex.: após recarregar a página). */
  recover(projectId: string): Promise<void>;
};

const POLL_MS = 500;
/** ~15 s sem conseguir falar com o servidor → desiste e mostra o erro. */
const MAX_POLL_FAILURES = 30;
let timer: ReturnType<typeof setTimeout> | null = null;

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `HTTP ${res.status}`;
}

const stageKey = (j: RenderJob | null) => (j ? `${j.id}:${j.status}:${j.progress.stage}` : '');

/** Job de export atual: inicia no servidor (`/api/projects/:id/render`) e acompanha por polling. */
export const useRenderJobs = create<RenderJobsState>((set, get) => {
  const setJob = (job: RenderJob) => {
    const prev = get().job;
    set({ job, pollFailures: 0, ...(stageKey(prev) !== stageKey(job) ? { stageSince: Date.now() } : {}) });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = isActive(get().job) ? setTimeout(poll, POLL_MS) : null;
  };

  const fail = (job: RenderJob, message: string) => {
    if (get().job?.id !== job.id) return;
    set({ job: { ...job, status: 'error', error: message } });
    useEditor.getState().showToast(`Exportação falhou: ${message}`);
  };

  const poll = () => {
    timer = null;
    const job = get().job;
    if (!job || !isActive(job)) return;
    void fetch(`/api/render/jobs/${encodeURIComponent(job.id)}`)
      .then(async (res) => {
        if (res.status === 404) {
          fail(job, 'o servidor do Studio foi reiniciado e este export se perdeu. Exporte de novo.');
          return;
        }
        if (!res.ok) throw new Error(await readError(res));
        const j = (await res.json()) as RenderJob;
        if (get().job?.id !== j.id) return;
        setJob(j);
        const toast = useEditor.getState().showToast;
        if (j.status === 'done') toast(`Exportação concluída: ${j.fileName ?? 'arquivo pronto'}.`);
        else if (j.status === 'error') toast(`Exportação falhou: ${j.error ?? 'erro desconhecido'}`);
      })
      .catch((e: Error) => {
        // falha pontual (rede, servidor ocupado): tenta de novo; só desiste depois de várias seguidas
        const failures = get().pollFailures + 1;
        set({ pollFailures: failures });
        if (failures >= MAX_POLL_FAILURES) fail(job, `sem resposta do servidor do Studio (${e.message}). Ele ainda está rodando?`);
      })
      .finally(schedule);
  };

  return {
    job: null,
    stageSince: 0,
    pollFailures: 0,
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
      setJob(job);
      schedule();
      return job;
    },
    async cancel() {
      const job = get().job;
      if (!job || !isActive(job)) return;
      try {
        const res = await fetch(`/api/render/jobs/${encodeURIComponent(job.id)}/cancel`, { method: 'POST' });
        if (!res.ok) throw new Error(await readError(res));
        setJob((await res.json()) as RenderJob);
        schedule();
      } catch (e) {
        useEditor.getState().showToast(`Não foi possível cancelar: ${(e as Error).message}`);
      }
    },
    clear() {
      if (!isActive(get().job)) set({ job: null, pollFailures: 0 });
    },
    async recover(projectId) {
      if (isActive(get().job)) return;
      try {
        const res = await fetch('/api/render/jobs');
        if (!res.ok) return;
        const jobs = (await res.json()) as RenderJob[];
        const active = jobs.filter((j) => j.projectId === projectId && isActive(j)).at(-1);
        if (active) {
          setJob(active);
          schedule();
        }
      } catch {
        // sem servidor de render: nada a retomar
      }
    },
  };
});
