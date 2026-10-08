import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { buildAudioMix, type AudioMix } from '@caju-motion/audio';
import {
  exportFormatInfo,
  exportHasAudio,
  outputSize,
  parseExportSettings,
  projectDuration,
  type ExportSettings,
  type Project,
} from '@caju-motion/schema';
import { createProjectStore, type ApiExtension } from '@caju-motion/server';
import { launchBrowser, startRenderServer, type RenderServer } from './browser';
import { buildEncodeArgs, probeHasAudio, startFfmpeg } from './ffmpeg';
import { outputFrameCount, projectFrameFor } from './frames';

/** Máximo de abas capturando ao mesmo tempo (memória: cada aba é um renderer do Chromium). */
export const MAX_CONCURRENCY = 2;
/** Tempo máximo para UM quadro ficar pronto (fontes, imagens, vídeo, componentes). */
const FRAME_TIMEOUT_MS = 60_000;

export type RenderProgress = {
  stage: 'preparing' | 'rendering' | 'encoding' | 'done';
  /** Quadros de saída já gravados. */
  frame: number;
  total: number;
  /** Quadros por segundo de render (média desde o início da captura). */
  speed: number;
  /** Segundos restantes estimados (null = desconhecido). */
  etaSec: number | null;
};

export type RenderCommon = {
  projectsDir: string;
  projectId: string;
  /** URL de um Studio já rodando (ex.: `http://localhost:3700/`). Sem ela, sobe um servidor interno. */
  serveUrl?: string;
  /** Extensões da API para o servidor interno (ex.: rota de componentes). */
  extensions?: ApiExtension[];
  signal?: AbortSignal;
};

export type RenderMediaOptions = RenderCommon & {
  /** Configuração parcial; o resto vem do projeto (veja `parseExportSettings`). */
  settings?: Partial<ExportSettings> | unknown;
  /** Arquivo de saída (ou pasta, para png-seq). Padrão: `<projeto>/renders/<id>-<data>.<ext>`. */
  output?: string;
  /** Abas em paralelo (1..2). Padrão: 2. */
  concurrency?: number;
  onProgress?: (p: RenderProgress) => void;
};

export type RenderMediaResult = {
  output: string;
  settings: ExportSettings;
  width: number;
  height: number;
  frames: number;
  durationSec: number;
  hasAudio: boolean;
  elapsedMs: number;
};

type Session = { browser: Browser; server: RenderServer | null; baseUrl: string };

async function openSession(o: RenderCommon): Promise<Session> {
  const server = o.serveUrl ? null : await startRenderServer(o.projectsDir, o.extensions);
  try {
    const browser = await launchBrowser();
    const baseUrl = (o.serveUrl ?? server!.url).replace(/\/?$/, '/');
    return { browser, server, baseUrl };
  } catch (e) {
    await server?.close();
    throw e;
  }
}

async function closeSession(s: Session | null): Promise<void> {
  if (!s) return;
  // fechar os contextos antes: no Windows, browser.close() direto chega a levar ~20 s
  await Promise.all(s.browser.contexts().map((c) => c.close().catch(() => undefined)));
  await Promise.race([s.browser.close().catch(() => undefined), new Promise((r) => setTimeout(r, 10_000))]);
  await s.server?.close().catch(() => undefined);
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => Promise<Error>): Promise<T> {
  let timer: NodeJS.Timeout;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => void onTimeout().then(reject, reject), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

async function pendingError(page: Page, what: string): Promise<Error> {
  // com a thread da página bloqueada o evaluate não volta: limita, senão o tempo esgotado nunca chega
  const pending = await Promise.race([
    page
      .evaluate(() => (window as unknown as { __caju?: { pending(): string[] } }).__caju?.pending() ?? [])
      .catch(() => [] as string[]),
    new Promise<string[]>((r) => setTimeout(() => r(['(a página não responde)']), 5_000)),
  ]);
  return new Error(
    `${what}: tempo esgotado (${FRAME_TIMEOUT_MS / 1000} s)` + (pending.length ? ` — aguardando: ${pending.join(', ')}` : ''),
  );
}

/** Abre uma aba no modo de render já no tamanho de saída e espera o projeto carregar. */
async function openRenderPage(s: Session, project: Project, projectId: string, outWidth: number, firstFrame: number) {
  const { width, height } = project.settings;
  const page = await s.browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: outWidth / width,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = `${s.baseUrl}?render=${encodeURIComponent(projectId)}&frame=${firstFrame}`;
  await page.goto(url, { waitUntil: 'load', timeout: FRAME_TIMEOUT_MS });
  await withTimeout(
    page.waitForFunction(() => Boolean((window as unknown as { __caju?: unknown }).__caju), undefined, { timeout: FRAME_TIMEOUT_MS }).then(
      () => page.evaluate(() => (window as unknown as { __caju: { ready: Promise<void> } }).__caju.ready),
    ),
    FRAME_TIMEOUT_MS,
    () => pendingError(page, `carregar "${projectId}"`),
  ).catch((e: Error) => {
    throw new Error(
      e.message.includes('__caju')
        ? `a página de render não expõe window.__caju (Studio desatualizado? rode "npm run build -w @caju-motion/studio")`
        : e.message + (errors.length ? `\n  erros na página: ${errors.join(' | ')}` : ''),
    );
  });
  return page;
}

async function setFrame(page: Page, frame: number): Promise<void> {
  await withTimeout(
    page.evaluate((n) => (window as unknown as { __caju: { setFrame(n: number): Promise<void> } }).__caju.setFrame(n), frame),
    FRAME_TIMEOUT_MS,
    () => pendingError(page, `quadro ${frame}`),
  );
}

function capture(page: Page, project: Project, lossless: boolean): Promise<Buffer> {
  const { width, height } = project.settings;
  return page.screenshot({
    type: lossless ? 'png' : 'jpeg',
    ...(lossless ? {} : { quality: 95 }),
    clip: { x: 0, y: 0, width, height },
    caret: 'hide',
  });
}

/** Vídeos sem `meta.hasAudio` são sondados: entrar na mixagem sem trilha de áudio faria o FFmpeg falhar. */
function withProbedAudio(project: Project, projectDir: string): Project {
  const assets = project.assets.map((a) => {
    if (a.kind !== 'video' || a.meta.hasAudio !== undefined || a.src.includes('://')) return a;
    const file = path.isAbsolute(a.src) ? a.src : path.join(projectDir, a.src);
    return { ...a, meta: { ...a.meta, hasAudio: probeHasAudio(file) } };
  });
  return { ...project, assets };
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/**
 * Exporta o projeto para vídeo/GIF/sequência PNG: Chromium headless captura cada quadro
 * do modo de render (`/?render=<id>`), o FFmpeg codifica e mixa o áudio do documento.
 */
export async function renderMedia(o: RenderMediaOptions): Promise<RenderMediaResult> {
  const t0 = Date.now();
  const report = (p: RenderProgress) => o.onProgress?.(p);
  const store = createProjectStore(o.projectsDir);
  const projectDir = await store.dir(o.projectId);
  const project = await store.read(o.projectId);
  const settings = parseExportSettings(o.settings, project.settings);
  const info = exportFormatInfo(settings.format);
  const size = outputSize(project.settings, settings.resolution);
  const totalProject = projectDuration(project);
  if (totalProject <= 0) throw new Error(`projeto "${o.projectId}" está vazio (duração 0)`);
  const total = outputFrameCount(totalProject, project.settings.fps, settings.fps);
  const durationSec = total / settings.fps;

  const output = path.resolve(
    o.output ?? path.join(projectDir, 'renders', `${o.projectId}-${stamp()}${info.ext ? `.${info.ext}` : ''}`),
  );
  await mkdir(info.ext ? path.dirname(output) : output, { recursive: true });

  report({ stage: 'preparing', frame: 0, total, speed: 0, etaSec: null });
  let audio: AudioMix | null = null;
  if (exportHasAudio(settings)) {
    audio = buildAudioMix(withProbedAudio(project, projectDir), { projectDir, inputOffset: 1 });
  }

  const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(o.concurrency ?? MAX_CONCURRENCY), total));
  let session: Session | null = null;
  let ffmpeg: ReturnType<typeof startFfmpeg> | null = null;
  let ok = false;
  // cancelar (ou o watchdog do servidor) fecha o navegador: derruba qualquer espera da página
  // (carregar, setFrame, screenshot) em vez de esperar o próximo lote
  const onAbort = () => void session?.browser.close().catch(() => undefined);
  o.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    o.signal?.throwIfAborted();
    session = await openSession(o);
    if (o.signal?.aborted) onAbort();
    const pages: Page[] = [];
    for (let k = 0; k < concurrency; k++) {
      pages.push(await openRenderPage(session, project, o.projectId, size.width, projectFrameFor(k, totalProject, project.settings.fps, settings.fps)));
    }

    ffmpeg = startFfmpeg(
      buildEncodeArgs({ settings, width: size.width, height: size.height, lossless: info.lossless, audio, output }),
      o.signal,
    );

    const tCap = Date.now();
    // lotes de `concurrency` quadros: cada aba captura um; a escrita no FFmpeg segue a ordem
    for (let j = 0; j < total; j += concurrency) {
      o.signal?.throwIfAborted();
      const batch = pages.slice(0, Math.min(concurrency, total - j)).map(async (page, k) => {
        await setFrame(page, projectFrameFor(j + k, totalProject, project.settings.fps, settings.fps));
        return capture(page, project, info.lossless);
      });
      const shots = await Promise.all(batch);
      for (const shot of shots) await ffmpeg.write(shot);
      const done = Math.min(total, j + shots.length);
      const speed = done / Math.max(0.001, (Date.now() - tCap) / 1000);
      report({ stage: 'rendering', frame: done, total, speed, etaSec: (total - done) / speed });
    }
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));

    report({ stage: 'encoding', frame: total, total, speed: 0, etaSec: null });
    await ffmpeg.finish();
    ok = true;
    report({ stage: 'done', frame: total, total, speed: 0, etaSec: 0 });
    return {
      output,
      settings,
      width: size.width,
      height: size.height,
      frames: total,
      durationSec,
      hasAudio: audio !== null,
      elapsedMs: Date.now() - t0,
    };
  } catch (e) {
    if (o.signal?.aborted) {
      const reason: unknown = o.signal.reason;
      throw reason instanceof Error && reason.name !== 'AbortError' ? reason : new Error('renderização cancelada');
    }
    throw e;
  } finally {
    o.signal?.removeEventListener('abort', onAbort);
    if (!ok) ffmpeg?.kill();
    await closeSession(session);
    if (!ok) await rm(output, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type RenderStillOptions = RenderCommon & {
  frame: number;
  /** Lado menor da imagem (720/1080/1440/2160). Padrão: o do projeto. */
  resolution?: number;
  /** png (padrão) ou jpeg. */
  type?: 'png' | 'jpeg';
  /** Grava neste arquivo (além de devolver os bytes). */
  output?: string;
};

/** Um quadro só, como imagem. */
export async function renderStill(o: RenderStillOptions): Promise<{ data: Buffer; width: number; height: number; frame: number }> {
  const store = createProjectStore(o.projectsDir);
  const project = await store.read(o.projectId);
  const total = projectDuration(project);
  const frame = Math.min(Math.max(0, Math.floor(o.frame)), Math.max(0, total - 1));
  const short = Math.min(project.settings.width, project.settings.height);
  const size = outputSize(project.settings, o.resolution ?? short);
  let session: Session | null = null;
  try {
    session = await openSession(o);
    const page = await openRenderPage(session, project, o.projectId, size.width, frame);
    await setFrame(page, frame);
    const data = await page.screenshot({
      type: o.type ?? 'png',
      ...(o.type === 'jpeg' ? { quality: 95 } : {}),
      clip: { x: 0, y: 0, width: project.settings.width, height: project.settings.height },
      caret: 'hide',
    });
    await page.close();
    if (o.output) {
      await mkdir(path.dirname(path.resolve(o.output)), { recursive: true });
      await writeFile(o.output, data);
    }
    return { data, width: size.width, height: size.height, frame };
  } finally {
    await closeSession(session);
  }
}
