import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Asset, Project } from '@caju-motion/schema';
import { createProxy, hashFile, thumbnail, waveform } from './derive';
import { probeMedia, type MediaInfo } from './probe';

/**
 * Cache de mídia do projeto: `<projeto>/.caju/media/` (ignorado pelo git).
 *
 *   index.json              src → { hash, size, mtimeMs }   (evita recalcular o hash de arquivos iguais)
 *   <hash16>/info.json      MediaInfo
 *   <hash16>/thumb.jpg      miniatura (vídeo/imagem)
 *   <hash16>/peaks.json     forma de onda (áudio e vídeo com áudio)
 *   <hash16>/proxy.mp4      proxy de edição (vídeo)
 *
 * Os derivados são indexados pelo conteúdo: renomear o arquivo não refaz nada.
 */
export const MEDIA_CACHE_DIR = path.join('.caju', 'media');

export type DerivedKind = 'thumb' | 'peaks' | 'proxy';
const DERIVED_FILE: Record<DerivedKind, string> = { thumb: 'thumb.jpg', peaks: 'peaks.json', proxy: 'proxy.mp4' };

type IndexEntry = { hash: string; size: number; mtimeMs: number };
type Index = Record<string, IndexEntry>;

const short = (hash: string) => hash.slice(0, 16);
const indexFile = (projectDir: string) => path.join(projectDir, MEDIA_CACHE_DIR, 'index.json');

export function mediaCacheDir(projectDir: string, hash: string): string {
  return path.join(projectDir, MEDIA_CACHE_DIR, short(hash));
}

async function readIndex(projectDir: string): Promise<Index> {
  try {
    return JSON.parse(await readFile(indexFile(projectDir), 'utf8')) as Index;
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(data), 'utf8');
  await rename(tmp, file);
}

/** Hash do arquivo, reaproveitando o índice quando tamanho e data não mudaram. */
async function hashFor(projectDir: string, index: Index, src: string, file: string): Promise<string> {
  const st = await stat(file);
  const hit = index[src];
  if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.hash;
  const hash = await hashFile(file);
  index[src] = { hash, size: st.size, mtimeMs: st.mtimeMs };
  return hash;
}

/**
 * Caminho de um derivado já gerado para o asset `src` (relativo ao projeto), ou `null`.
 * Barato: só olha o índice e confere se o arquivo original não mudou.
 */
export async function findDerived(projectDir: string, src: string, kind: DerivedKind): Promise<string | null> {
  const entry = (await readIndex(projectDir))[src];
  if (!entry) return null;
  try {
    const st = await stat(path.join(projectDir, src));
    if (st.size !== entry.size || st.mtimeMs !== entry.mtimeMs) return null;
  } catch {
    return null;
  }
  const file = path.join(mediaCacheDir(projectDir, entry.hash), DERIVED_FILE[kind]);
  return existsSync(file) ? file : null;
}

export type ProxyMode = false | 'auto' | 'all';

export type AnalyzeOptions = {
  /** Miniaturas de vídeos e imagens (padrão true). */
  thumbnails?: boolean;
  /** Formas de onda de áudios e vídeos com som (padrão true). */
  peaks?: boolean;
  /**
   * Proxies de edição: `'auto'` só para vídeos pesados (acima de `proxyHeight` ou codec que não é H.264),
   * `'all'` para todos. Padrão `false`.
   */
  proxies?: ProxyMode;
  /** Altura dos proxies (padrão 540). */
  proxyHeight?: number;
  /** Refaz os derivados mesmo se já existirem. */
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (asset: Asset, step: string) => void;
};

export type AssetReport = {
  id: string;
  src: string;
  status: 'ok' | 'missing' | 'error' | 'skipped';
  error?: string;
  info?: MediaInfo;
  /** Campos de `meta` que mudaram. */
  changed: string[];
  derived: Partial<Record<DerivedKind, string>>;
};

export type AnalyzeResult = { project: Project; reports: AssetReport[] };

/** Proxy vale a pena para este vídeo? */
export function needsProxy(info: MediaInfo, mode: ProxyMode, proxyHeight = 540): boolean {
  if (!mode || !info.hasVideo) return false;
  if (mode === 'all') return true;
  return (info.height ?? 0) > proxyHeight * 1.34 || (info.videoCodec !== undefined && info.videoCodec !== 'h264');
}

/**
 * Lê todos os assets locais do projeto: preenche `meta` (duração, tamanho, fps, áudio) e `hash`,
 * e gera miniaturas, formas de onda e (opcionalmente) proxies no cache. Devolve um projeto novo;
 * quem chama decide se grava.
 */
export async function analyzeProject(projectDir: string, project: Project, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const { thumbnails = true, peaks = true, proxies = false, proxyHeight = 540, force = false, signal, onProgress } = opts;
  const index = await readIndex(projectDir);
  const reports: AssetReport[] = [];
  const assets: Asset[] = [];

  for (const asset of project.assets) {
    signal?.throwIfAborted();
    const report: AssetReport = { id: asset.id, src: asset.src, status: 'ok', changed: [], derived: {} };
    reports.push(report);
    if (/^[a-z][\w+.-]*:\/\//i.test(asset.src) || asset.kind === 'lottie') {
      report.status = 'skipped';
      assets.push(asset);
      continue;
    }
    const file = path.join(projectDir, asset.src);
    if (!existsSync(file)) {
      report.status = 'missing';
      assets.push(asset);
      continue;
    }
    try {
      onProgress?.(asset, 'lendo');
      const hash = await hashFor(projectDir, index, asset.src, file);
      const dir = mediaCacheDir(projectDir, hash);
      const infoFile = path.join(dir, 'info.json');
      let info: MediaInfo;
      if (!force && existsSync(infoFile)) info = JSON.parse(await readFile(infoFile, 'utf8')) as MediaInfo;
      else {
        info = await probeMedia(file);
        await writeJson(infoFile, info);
      }
      report.info = info;

      const meta = { ...asset.meta };
      const set = <K extends keyof Asset['meta']>(k: K, v: Asset['meta'][K] | undefined) => {
        if (v === undefined || meta[k] === v) return;
        meta[k] = v;
        report.changed.push(k);
      };
      if (asset.kind === 'video' || asset.kind === 'audio') set('durationSec', info.durationSec && Math.round(info.durationSec * 1000) / 1000);
      if (asset.kind === 'video' || asset.kind === 'image') {
        set('width', info.width);
        set('height', info.height);
      }
      if (asset.kind === 'video') {
        set('fps', info.fps);
        set('hasAudio', info.hasAudio);
      }
      const next: Asset = { ...asset, meta };
      if (asset.hash !== short(hash)) {
        next.hash = short(hash);
        report.changed.push('hash');
      }
      assets.push(next);

      const derive = async (kind: DerivedKind, make: (out: string) => Promise<unknown>) => {
        const out = path.join(dir, DERIVED_FILE[kind]);
        if (force || !existsSync(out)) {
          onProgress?.(asset, kind);
          await make(out);
        }
        report.derived[kind] = out;
      };
      if (thumbnails && (info.kind === 'video' || (info.kind === 'image' && path.extname(file).toLowerCase() !== '.svg'))) {
        await derive('thumb', (out) => thumbnail(file, { out, signal }));
      }
      if (peaks && info.hasAudio) {
        await derive('peaks', async (out) => writeJson(out, await waveform(file, { signal })));
      }
      if (info.kind === 'video' && needsProxy(info, proxies, proxyHeight)) {
        await derive('proxy', (out) => createProxy(file, { out, height: proxyHeight, signal }));
      }
    } catch (err) {
      report.status = 'error';
      report.error = err instanceof Error ? err.message : String(err);
      if (assets.length < reports.length) assets.push(asset);
    }
  }
  await writeJson(indexFile(projectDir), index);
  return { project: { ...project, assets }, reports };
}
