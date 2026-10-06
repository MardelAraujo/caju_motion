import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, defaultClientConditions, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runFfmpegOk } from './ffmpeg';

/**
 * Decode frame-exato (WebCodecs) num Chrome de verdade, comparado pixel a pixel com os quadros que o
 * FFmpeg extrai. Precisa de navegador: roda com CAJU_RENDER_IT=1.
 */
const FPS = 30;
const FRAMES = 90;

describe.runIf(process.env.CAJU_RENDER_IT === '1')('createFrameDecoder (WebCodecs)', () => {
  let dir: string;
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  const fsUrl = (file: string) => `/@fs/${file.replace(/\\/g, '/').replace(/^\//, '')}`;

  beforeAll(async () => {
    // caminho longo (no Windows o tmpdir pode vir como MARDEL~1 e o Vite recusaria o /@fs/)
    dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'caju-webcodecs-')));
    // B-frames (padrão do x264) e quadro-chave a cada 30: a ordem de decodificação difere da de exibição
    await runFfmpegOk([
      '-f', 'lavfi', '-i', `testsrc2=size=320x180:rate=${FPS}:duration=${FRAMES / FPS}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-bf', '3', '-crf', '18', '-y', path.join(dir, 'clip.mp4'),
    ]);
    // referência: todos os quadros como PNG, extraídos pelo FFmpeg
    // (com a matriz BT.709 que o Chrome usa para vídeo sem tag de cor; o padrão do FFmpeg seria BT.601)
    await runFfmpegOk([
      '-i', path.join(dir, 'clip.mp4'), '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgb24',
      '-fps_mode', 'passthrough', '-start_number', '0', '-y', path.join(dir, 'ref-%d.png'),
    ]);

    server = await createServer({
      configFile: false,
      root: path.join(import.meta.dirname, '..', 'test-page'),
      resolve: { conditions: ['source', ...defaultClientConditions] },
      server: { port: 0, host: '127.0.0.1', fs: { allow: [path.resolve(import.meta.dirname, '../../..'), dir] } },
      logLevel: 'error',
    });
    await server.listen();
    const exe = process.env.CAJU_BROWSER_PATH;
    browser = await chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true });
    page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true, null, { timeout: 30_000 });
    expect(errors).toEqual([]);
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Decodifica os quadros pedidos (na ordem dada) e devolve, para cada um, a diferença média por pixel
   * contra a referência do próprio quadro e dos vizinhos.
   */
  async function compare(frames: number[]) {
    return page.evaluate(
      async ({ src, refBase, frames, fps, total }) => {
        type Web = typeof import('./web');
        const web = (window as unknown as { __media: Web }).__media;
        const dec = await web.createFrameDecoder(src);
        const w = dec.width;
        const h = dec.height;
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const refs = new Map<number, Uint8ClampedArray>();
        const ref = async (n: number) => {
          if (!refs.has(n)) {
            const img = await createImageBitmap(await (await fetch(`${refBase}${n}.png`)).blob());
            ctx.drawImage(img, 0, 0, w, h);
            refs.set(n, ctx.getImageData(0, 0, w, h).data);
          }
          return refs.get(n)!;
        };
        const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
          let sum = 0;
          for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
          return sum / ((a.length / 4) * 3);
        };
        const out: { n: number; self: number; prev: number; next: number }[] = [];
        const t0 = performance.now();
        for (const n of frames) {
          await dec.drawFrameAt(ctx, n / fps);
          const got = ctx.getImageData(0, 0, w, h).data;
          out.push({
            n,
            self: diff(got, await ref(n)),
            prev: n > 0 ? diff(got, await ref(n - 1)) : Infinity,
            next: n < total - 1 ? diff(got, await ref(n + 1)) : Infinity,
          });
        }
        const ms = performance.now() - t0;
        const info = { codec: dec.codec, width: w, height: h, frameCount: dec.frameCount, fps: dec.fps, durationSec: dec.durationSec };
        dec.close();
        return { out, info, ms };
      },
      { src: fsUrl(path.join(dir, 'clip.mp4')), refBase: fsUrl(path.join(dir, 'ref-')), frames, fps: FPS, total: FRAMES },
    );
  }

  it('informa codec, tamanho e duração', async () => {
    const { info } = await compare([0]);
    expect(info).toMatchObject({ width: 320, height: 180, frameCount: FRAMES });
    expect(info.codec).toMatch(/^avc1\./);
    expect(info.fps).toBeCloseTo(FPS, 0);
    expect(info.durationSec).toBeCloseTo(FRAMES / FPS, 1);
  });

  it('cada quadro pedido é o quadro exato (não o vizinho), em qualquer ordem', async () => {
    // saltos para a frente, para trás, em volta do quadro-chave 30/60, B-frames e o último
    const { out } = await compare([0, 1, 29, 30, 31, 47, 89, 10, 59, 60, 2]);
    for (const r of out) {
      expect(r.self, `quadro ${r.n}: ${JSON.stringify(r)}`).toBeLessThan(2);
      expect(r.self, `quadro ${r.n} mais parecido com um vizinho`).toBeLessThan(Math.min(r.prev, r.next));
    }
  }, 60_000);

  it('leitura sequencial (como no render) continua exata', async () => {
    const frames = Array.from({ length: FRAMES }, (_, i) => i);
    const { out, ms } = await compare(frames);
    const wrong = out.filter((r) => !(r.self < 2 && r.self < Math.min(r.prev, r.next)));
    expect(wrong).toEqual([]);
    expect(ms).toBeLessThan(15_000);
  }, 60_000);
});
