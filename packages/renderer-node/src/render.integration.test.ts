/**
 * Integração real (Chromium do sistema + FFmpeg + Studio buildado). Pesado: só roda com
 * `CAJU_RENDER_IT=1` (ex.: `CAJU_RENDER_IT=1 npx vitest run packages/renderer-node --maxWorkers=1`).
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ffmpegPath } from './ffmpeg';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { createStudioServer } from '@caju-motion/server';
import { STUDIO_APP_DIR } from '@caju-motion/studio';
import { renderMedia, renderStill } from './render';
import { renderRoutes, type RenderJob } from './routes';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/projects');
const run = process.env.CAJU_RENDER_IT === '1';

function probe(file: string) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,width,height,nb_read_frames:format=duration', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (r.error) throw new Error(`ffprobe não encontrado no PATH (necessário só para verificar os arquivos): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffprobe falhou: ${r.stderr}`);
  return JSON.parse(r.stdout) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; nb_read_frames?: string }[];
    format: { duration: string };
  };
}

/** Instante (s) do primeiro quadro claro (claquete visual). */
function flashTime(file: string, fps: number): number {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const ys = [...(r.stderr ?? '').matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  const i = ys.findIndex((y) => y > 128);
  return i / fps;
}

/** Instante (s) em que o som começa (fim do primeiro silêncio). */
function audioOnset(file: string): number {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-i', file, '-af', 'silencedetect=n=-40dB:d=0.05', '-vn', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /silence_end: ([\d.]+)/.exec(r.stderr ?? '');
  return m ? Number(m[1]) : NaN;
}

describe.runIf(run)('render real', () => {
  let out: string;
  beforeAll(async () => {
    out = await mkdtemp(path.join(tmpdir(), 'caju-render-'));
  });
  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  it('MP4 com áudio: tamanho, duração, quadros e sincronia A/V', async () => {
    const file = path.join(out, 'audio.mp4');
    const progress: number[] = [];
    const r = await renderMedia({
      projectsDir: FIXTURES,
      projectId: 'landscape-audio',
      settings: { resolution: 720, quality: 'draft' },
      output: file,
      onProgress: (p) => progress.push(p.frame),
    });
    expect(r.hasAudio).toBe(true);
    const info = probe(file);
    const v = info.streams.find((s) => s.codec_type === 'video')!;
    const a = info.streams.find((s) => s.codec_type === 'audio');
    expect(v.codec_name).toBe('h264');
    expect([v.width, v.height]).toEqual([1280, 720]);
    expect(Number(v.nb_read_frames)).toBe(60);
    expect(a?.codec_name).toBe('aac');
    expect(Math.abs(Number(info.format.duration) - 2)).toBeLessThan(0.05);
    expect(progress.at(-1)).toBe(60);

    const offset = audioOnset(file) - flashTime(file, 30);
    console.log(`  A/V: flash ${flashTime(file, 30).toFixed(3)} s, som ${audioOnset(file).toFixed(3)} s, offset ${(offset * 1000).toFixed(1)} ms`);
    expect(Math.abs(offset)).toBeLessThan(1 / 30);
  }, 180_000);

  it('PNG de um quadro com imagem SVG', async () => {
    const file = path.join(out, 'still.png');
    const r = await renderStill({ projectsDir: FIXTURES, projectId: 'feed-image', frame: 30, output: file, resolution: 720 });
    expect(r.data.subarray(1, 4).toString()).toBe('PNG');
    const info = probe(file);
    expect([info.streams[0]!.width, info.streams[0]!.height]).toEqual([720, 900]);
  }, 120_000);

  it('WebM sem áudio, outro fps; sequência PNG', async () => {
    const webm = path.join(out, 'reel.webm');
    const r = await renderMedia({
      projectsDir: FIXTURES,
      projectId: 'hello-reel',
      settings: { format: 'webm-vp9', resolution: 720, fps: 24, quality: 'draft' },
      output: webm,
    });
    expect(r.frames).toBe(72);
    const v = probe(webm).streams.find((s) => s.codec_type === 'video')!;
    expect([v.codec_name, v.width, v.height]).toEqual(['vp9', 720, 1280]);
    expect(probe(webm).streams.some((s) => s.codec_type === 'audio')).toBe(false);

    const seq = path.join(out, 'seq');
    await renderMedia({ projectsDir: FIXTURES, projectId: 'feed-image', settings: { format: 'png-seq', resolution: 720 }, output: seq, concurrency: 1 });
    const files = (await readdir(seq)).sort();
    expect(files).toHaveLength(60);
    expect(files[0]).toBe('frame-00000.png');
  }, 300_000);

  it('cancelar aborta e não deixa arquivo', async () => {
    const file = path.join(out, 'cancel.mp4');
    const controller = new AbortController();
    const p = renderMedia({
      projectsDir: FIXTURES,
      projectId: 'hello-reel',
      settings: { resolution: 720 },
      output: file,
      signal: controller.signal,
      onProgress: (pr) => {
        if (pr.frame >= 4) controller.abort();
      },
    });
    await expect(p).rejects.toThrow(/cancelada/);
    expect((await readdir(out)).includes('cancel.mp4')).toBe(false);
  }, 120_000);

  it('HTTP: POST /render → job → download (serveUrl = origem da requisição)', async () => {
    const app = createStudioServer({ projectsDir: FIXTURES, appDir: STUDIO_APP_DIR, extensions: [renderRoutes()] });
    const server = await new Promise<Server>((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
      s.once('listening', () => resolve(s));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const res = await fetch(`${base}/api/projects/feed-image/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: { format: 'gif', resolution: 720, fps: 10 } }),
      });
      expect(res.status).toBe(202);
      let { job } = (await res.json()) as { job: RenderJob };
      for (let i = 0; i < 240 && ['queued', 'running'].includes(job.status); i++) {
        await new Promise((r) => setTimeout(r, 500));
        job = (await (await fetch(`${base}/api/render/jobs/${job.id}`)).json()) as RenderJob;
      }
      expect(job.error).toBeUndefined();
      expect(job.status).toBe('done');
      const file = await fetch(`${base}/api/render/jobs/${job.id}/file`);
      expect(file.headers.get('content-disposition')).toContain('.gif');
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(new TextDecoder().decode(bytes.subarray(0, 3))).toBe('GIF');
      expect(bytes.length).toBe(job.sizeBytes);
      // a saída padrão fica em <projeto>/renders: limpa para não sujar as fixtures
      await rm(path.join(FIXTURES, 'feed-image', 'renders'), { recursive: true, force: true });
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  }, 180_000);
});
