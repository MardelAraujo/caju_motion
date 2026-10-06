import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { createStudioServer, type ApiExtension } from '@caju-motion/server';
import { STUDIO_APP_DIR } from '@caju-motion/studio';

const BROWSER_ARGS = [
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--mute-audio',
  // várias abas capturando em paralelo: nenhuma pode ser "de fundo" (rAF/timers estrangulados)
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

/**
 * Abre o Chromium headless: `CAJU_BROWSER_PATH` > Google Chrome instalado > Microsoft Edge.
 * (playwright-core não baixa navegador; usamos o do sistema.)
 */
export async function launchBrowser(): Promise<Browser> {
  const exe = process.env.CAJU_BROWSER_PATH;
  if (exe) {
    if (!existsSync(exe)) throw new Error(`CAJU_BROWSER_PATH aponta para um arquivo que não existe: ${exe}`);
    return chromium.launch({ executablePath: exe, headless: true, args: BROWSER_ARGS });
  }
  const errors: string[] = [];
  for (const channel of ['chrome', 'msedge'] as const) {
    try {
      return await chromium.launch({ channel, headless: true, args: BROWSER_ARGS });
    } catch (e) {
      errors.push(`${channel}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  throw new Error(
    `nenhum navegador Chromium encontrado (instale o Google Chrome ou o Edge, ou defina CAJU_BROWSER_PATH).\n  ${errors.join('\n  ')}`,
  );
}

export type RenderServer = { url: string; close(): Promise<void> };

/**
 * Sobe um Studio interno (API + app buildado) em 127.0.0.1, porta livre, só para o render.
 */
export async function startRenderServer(projectsDir: string, extensions: ApiExtension[] = []): Promise<RenderServer> {
  if (!existsSync(path.join(STUDIO_APP_DIR, 'index.html'))) {
    throw new Error(
      `app do Studio não buildado (${STUDIO_APP_DIR} sem index.html). Rode "npm run build -w @caju-motion/studio" ou passe serveUrl de um Studio rodando.`,
    );
  }
  const { serve } = await import('@hono/node-server');
  const app = createStudioServer({ projectsDir, appDir: STUDIO_APP_DIR, extensions });
  const server = await new Promise<Server>((resolve, reject) => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
    s.once('listening', () => resolve(s));
    s.once('error', reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
