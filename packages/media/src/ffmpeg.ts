import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * Caminho do FFmpeg: `CAJU_FFMPEG_PATH` > binário do `ffmpeg-static` > `ffmpeg` do PATH.
 */
export function ffmpegPath(): string {
  const env = process.env.CAJU_FFMPEG_PATH;
  if (env) {
    if (!existsSync(env)) throw new Error(`CAJU_FFMPEG_PATH aponta para um arquivo que não existe: ${env}`);
    return env;
  }
  try {
    const req = createRequire(import.meta.url);
    const p = req('ffmpeg-static') as string | null;
    if (p && existsSync(p)) return p;
  } catch {
    // pacote opcional ausente: tenta o PATH
  }
  return 'ffmpeg';
}

export type FfmpegResult = { stdout: Buffer; stderr: string; code: number | null };

/**
 * Roda o FFmpeg até o fim e devolve stdout (binário) e stderr, sem rejeitar por código de saída
 * (`ffmpeg -i` sem saída sai com 1 e é assim que se lê o cabeçalho). Rejeita se o binário não existir.
 */
export function execFfmpeg(args: string[], opts: { signal?: AbortSignal; captureStdout?: boolean } = {}): Promise<FfmpegResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ['-hide_banner', '-nostdin', ...args], {
      stdio: ['ignore', opts.captureStdout ? 'pipe' : 'ignore', 'pipe'],
      windowsHide: true,
    });
    const out: Buffer[] = [];
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => out.push(d));
    proc.stderr!.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-64_000);
    });
    const onAbort = () => proc.kill('SIGKILL');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    proc.once('error', (e: NodeJS.ErrnoException) =>
      reject(e.code === 'ENOENT' ? new Error('FFmpeg não encontrado (instale ffmpeg-static ou defina CAJU_FFMPEG_PATH)') : e),
    );
    proc.once('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (opts.signal?.aborted) reject(new Error('cancelado'));
      else resolve({ stdout: Buffer.concat(out), stderr, code });
    });
  });
}

/** Roda o FFmpeg e rejeita com o stderr se ele falhar. */
export async function runFfmpegOk(args: string[], opts: { signal?: AbortSignal; captureStdout?: boolean } = {}): Promise<FfmpegResult> {
  const r = await execFfmpeg(args, opts);
  if (r.code !== 0) throw new Error(`FFmpeg falhou (código ${r.code}): ${lastLines(r.stderr)}`);
  return r;
}

const lastLines = (s: string, n = 6) => s.trim().split(/\r?\n/).slice(-n).join('\n') || 'sem detalhes';
