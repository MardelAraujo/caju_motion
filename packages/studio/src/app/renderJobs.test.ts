import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toasts: string[] = [];
vi.mock('./store', () => ({ useEditor: { getState: () => ({ showToast: (m: string) => toasts.push(m) }) } }));

const { useRenderJobs } = await import('./renderJobs');
type Job = import('./renderJobs').RenderJob;

const job = (over: Partial<Job> = {}): Job => ({
  id: 'j1',
  projectId: 'p',
  status: 'running',
  settings: { format: 'mp4-h264' } as Job['settings'],
  progress: { stage: 'preparing', frame: 0, total: 10, speed: 0, etaSec: null },
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('useRenderJobs (polling)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toasts.length = 0;
    useRenderJobs.setState({ job: null, pollFailures: 0, stageSince: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('falha pontual de rede não vira erro: tenta de novo e segue o job', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/render')) return json({ job: job() }, 202);
        calls++;
        if (calls <= 3) throw new Error('rede caiu');
        return json(job({ status: 'done', progress: { stage: 'done', frame: 10, total: 10, speed: 0, etaSec: 0 }, fileName: 'p.mp4' }));
      }),
    );
    await useRenderJobs.getState().start('p', job().settings);
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(500);
    expect(useRenderJobs.getState().job?.status).toBe('done');
    expect(toasts.at(-1)).toMatch(/concluída/);
  });

  it('job sumiu do servidor (404, servidor reiniciado) → erro legível, sem "carregando" eterno', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.endsWith('/render') ? json({ job: job() }, 202) : json({ error: 'não encontrado' }, 404))),
    );
    await useRenderJobs.getState().start('p', job().settings);
    await vi.advanceTimersByTimeAsync(500);
    const j = useRenderJobs.getState().job!;
    expect(j.status).toBe('error');
    expect(j.error).toMatch(/reiniciado/);
  });

  it('servidor fora do ar por muito tempo → desiste com erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/render')) return json({ job: job() }, 202);
        throw new Error('ECONNREFUSED');
      }),
    );
    await useRenderJobs.getState().start('p', job().settings);
    for (let i = 0; i < 40; i++) await vi.advanceTimersByTimeAsync(500);
    expect(useRenderJobs.getState().job?.status).toBe('error');
    expect(useRenderJobs.getState().job?.error).toMatch(/sem resposta/);
  });

  it('recover retoma o export em andamento do projeto aberto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([job({ id: 'outro', projectId: 'x' }), job({ id: 'meu' })])));
    await useRenderJobs.getState().recover('p');
    expect(useRenderJobs.getState().job?.id).toBe('meu');
  });
});
