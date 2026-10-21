import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PlayerRef } from './Player';

declare global {
  interface Window {
    __player: PlayerRef | null;
    __events: string[];
  }
}

/**
 * O player num Chrome de verdade (relógio, áudio, controles, teclado). Lento e precisa de navegador:
 * roda com CAJU_RENDER_IT=1, como os testes de render.
 */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const FIXTURE = path.join(ROOT, 'fixtures', 'projects', 'landscape-audio'); // 60 frames a 30 fps, beep no frame 30

describe.runIf(process.env.CAJU_RENDER_IT === '1')('<Player> no navegador', () => {
  let server: ViteDevServer;
  let browser: Browser;
  let url: string;

  beforeAll(async () => {
    server = await createServer({
      configFile: path.join(import.meta.dirname, '..', 'vite.config.ts'),
      server: { port: 0, host: '127.0.0.1' },
      logLevel: 'error',
    });
    await server.listen();
    url = server.resolvedUrls!.local[0]!;
    const exe = process.env.CAJU_BROWSER_PATH;
    browser = await chromium.launch({
      ...(exe ? { executablePath: exe } : { channel: 'chrome' }),
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  async function open(query = ''): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${url}?dir=${encodeURIComponent(FIXTURE)}${query}`);
    await page.waitForFunction(() => !!window.__player, null, { timeout: 30_000 });
    expect(errors).toEqual([]);
    return page;
  }
  const frame = (p: Page) => p.evaluate(() => window.__player!.getCurrentFrame());
  const playing = (p: Page) => p.evaluate(() => window.__player!.isPlaying());
  const events = (p: Page) => p.evaluate(() => window.__events);

  it('encaixa o quadro 1920×1080 na largura do contêiner', async () => {
    const page = await open();
    const box = await page.locator('[data-caju-player]').boundingBox();
    expect(box!.width).toBe(640);
    expect(box!.height).toBe(360);
    const inner = await page.locator('[data-caju-player] > div').first().boundingBox();
    expect(inner).toMatchObject({ width: 640, height: 360 });
    await page.close();
  });

  it('toca pelo tempo real, pausa e busca', async () => {
    const page = await open();
    expect(await frame(page)).toBe(0);
    const t0 = await page.evaluate(() => {
      window.__player!.play();
      return performance.now();
    });
    await page.waitForTimeout(500);
    // tempo medido DENTRO da página: sob carga a ida e volta do teste passa dos 500 ms
    const { f, elapsed } = await page.evaluate((start) => ({ f: window.__player!.getCurrentFrame(), elapsed: performance.now() - start }), t0);
    const expected = (elapsed / 1000) * 30;
    expect(f).toBeGreaterThanOrEqual(Math.min(8, expected - 6));
    expect(f).toBeLessThanOrEqual(expected + 4);
    expect(await playing(page)).toBe(true);

    await page.evaluate(() => window.__player!.pause());
    const paused = await frame(page);
    await page.waitForTimeout(200);
    expect(await frame(page)).toBe(paused);

    await page.evaluate(() => window.__player!.seekTo(30));
    expect(await frame(page)).toBe(30);
    // o flash (shape no frame 30) aparece
    await expect.poll(() => page.locator('[data-clip-id]').count()).toBe(1);
    await page.evaluate(() => window.__player!.seekTo(999));
    expect(await frame(page)).toBe(59);
    expect(await events(page)).toEqual(['play', 'pause']);
    await page.close();
  });

  it('o áudio toca junto e respeita o mudo', async () => {
    const page = await open();
    await page.evaluate(() => {
      window.__player!.seekTo(28);
      window.__player!.play();
    });
    await page.waitForTimeout(400); // passa do início do clipe de áudio (frame 30)
    const audio = await page.evaluate(() => {
      const a = document.querySelector('audio')!;
      return { paused: a.paused, time: a.currentTime, muted: a.muted };
    });
    expect(audio.paused).toBe(false);
    expect(audio.muted).toBe(false);
    expect(audio.time).toBeGreaterThan(0);
    await page.evaluate(() => window.__player!.mute());
    await expect.poll(() => page.evaluate(() => document.querySelector('audio')!.muted)).toBe(true);
    await page.close();
  });

  it('playbackRate vale também para o áudio', async () => {
    const page = await open('&rate=2');
    await page.evaluate(() => {
      window.__player!.seekTo(28);
      window.__player!.play();
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.querySelector('audio')!.playbackRate)).toBe(2);
    expect(await frame(page)).toBeGreaterThan(40); // 300 ms a 2x ≈ 18 quadros
    await page.close();
  });

  it('para no fim com onEnded; com loop, dá a volta', async () => {
    const page = await open();
    await page.evaluate(() => {
      window.__player!.seekTo(50);
      window.__player!.play();
    });
    await expect.poll(() => events(page), { timeout: 5000 }).toEqual(['play', 'pause', 'ended']);
    expect(await frame(page)).toBe(59);
    expect(await playing(page)).toBe(false);
    // play no fim recomeça do início
    await page.evaluate(() => window.__player!.play());
    expect(await frame(page)).toBeLessThan(10);
    await page.close();

    const looped = await open('&loop=1');
    await looped.evaluate(() => {
      window.__player!.seekTo(50);
      window.__player!.play();
    });
    await looped.waitForTimeout(600);
    expect(await frame(looped)).toBeLessThan(30);
    expect(await playing(looped)).toBe(true);
    expect(await events(looped)).toEqual(['play']);
    await looped.close();
  });

  it('controles, clique no vídeo e teclado', async () => {
    const page = await open();
    await page.getByRole('button', { name: 'Play' }).click();
    expect(await playing(page)).toBe(true);
    await page.getByRole('button', { name: 'Pause' }).click();
    expect(await playing(page)).toBe(false);

    await page.locator('[data-caju-player] > div').first().click(); // clickToPlay
    expect(await playing(page)).toBe(true);
    await page.locator('[data-caju-player]').press(' ');
    expect(await playing(page)).toBe(false);

    await page.evaluate(() => window.__player!.seekTo(10));
    await page.locator('[data-caju-player]').press('ArrowRight');
    expect(await frame(page)).toBe(11);
    await page.locator('[data-caju-player]').press('Shift+ArrowLeft');
    expect(await frame(page)).toBe(0);

    await page.getByRole('slider', { name: 'Seek' }).fill('42');
    expect(await frame(page)).toBe(42);
    await page.getByRole('button', { name: 'Mute' }).click();
    expect(await page.evaluate(() => window.__player!.isMuted())).toBe(true);
    await page.close();
  });
}, 120_000);
