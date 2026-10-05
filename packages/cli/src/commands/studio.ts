import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import type { Server } from 'node:http';
import path from 'node:path';
import { STUDIO_APP_DIR, STUDIO_ROOT } from '@caju-motion/studio';
import { cajuApiPlugin, createStudioServer } from '@caju-motion/server';

type Opts = { dir: string; port: number; open: boolean; dev: boolean };

/** Sobe o Studio + API na mesma porta e fica rodando. */
export async function studioCommand({ dir, port, open, dev }: Opts): Promise<void> {
  const projectsDir = path.resolve(dir);
  await mkdir(projectsDir, { recursive: true });

  const built = existsSync(path.join(STUDIO_APP_DIR, 'index.html'));
  const url = dev || !built ? await devServer(projectsDir, port, open, built) : await prodServer(projectsDir, port, open);
  console.log(`\n  caju studio rodando em ${url}`);
  console.log(`  projetos: ${projectsDir}\n`);
}

/** App já buildado (pacote publicado): sem Vite, sem TypeScript em tempo de execução. */
async function prodServer(projectsDir: string, port: number, open: boolean): Promise<string> {
  const { serve } = await import('@hono/node-server');
  const app = createStudioServer({ projectsDir, appDir: STUDIO_APP_DIR });
  for (let p = port; p < port + 20; p++) {
    const ok = await new Promise<boolean>((resolve, reject) => {
      const server = serve({ fetch: app.fetch, port: p }) as Server;
      server.once('listening', () => resolve(true));
      server.once('error', (err: NodeJS.ErrnoException) => (err.code === 'EADDRINUSE' ? resolve(false) : reject(err)));
    });
    if (ok) {
      const url = `http://localhost:${p}/`;
      if (open) openBrowser(url);
      return url;
    }
  }
  throw new Error(`nenhuma porta livre entre ${port} e ${port + 19}`);
}

/** Modo de desenvolvimento do próprio Studio (Vite + HMR) — só funciona a partir do repositório. */
async function devServer(projectsDir: string, port: number, open: boolean, built: boolean): Promise<string> {
  if (!built) console.log('  (app do Studio não buildado: usando o modo dev com Vite)');
  let vite: typeof import('vite');
  try {
    vite = await import('vite');
  } catch {
    throw new Error('o modo --dev precisa do Vite (disponível só no repositório do Caju Motion). Rode sem --dev.');
  }
  const server = await vite.createServer({
    configFile: path.join(STUDIO_ROOT, 'vite.config.ts'),
    root: STUDIO_ROOT,
    plugins: [cajuApiPlugin({ projectsDir })],
    server: { port, strictPort: false, open },
    logLevel: 'warn',
  });
  await server.listen();
  return server.resolvedUrls?.local[0] ?? `http://localhost:${port}/`;
}

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).unref();
}
