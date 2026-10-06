import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFfmpeg, runFfmpegOk } from './ffmpeg';
import { probeMedia, type MediaInfo } from './probe';

/** SHA-256 do conteúdo (hex), lido em streaming. */
export function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

/** Grava em `<out>.tmp-<pid>` e renomeia no fim: um arquivo pela metade nunca fica no lugar do certo. */
async function atomicOutput(out: string, write: (tmp: string) => Promise<void>): Promise<string> {
  await mkdir(path.dirname(out), { recursive: true });
  const ext = path.extname(out);
  const tmp = `${out.slice(0, -ext.length || undefined)}.tmp-${process.pid}${ext}`;
  try {
    await write(tmp);
    await rename(tmp, out);
  } finally {
    await rm(tmp, { force: true });
  }
  return out;
}

export type ThumbnailOptions = {
  /** Arquivo de saída (.jpg/.png/.webp). */
  out: string;
  /** Instante do quadro (s). Padrão: 0,5 s ou o meio de vídeos curtos. */
  atSec?: number;
  /** Largura (px); a altura segue a proporção. Padrão 320. */
  width?: number;
  /** `probeMedia(file)` já lido (evita rodar o FFmpeg de novo). */
  info?: MediaInfo;
  signal?: AbortSignal;
};

/** Miniatura de um vídeo ou imagem. */
export async function thumbnail(file: string, { out, atSec, width = 320, info, signal }: ThumbnailOptions): Promise<string> {
  let at = atSec;
  if (at === undefined) {
    const { durationSec } = info ?? (await probeMedia(file));
    at = durationSec ? Math.min(0.5, durationSec / 2) : 0;
  }
  return atomicOutput(out, async (tmp) => {
    await runFfmpegOk(
      ['-ss', String(at), '-i', file, '-frames:v', '1', '-vf', `scale=${Math.round(width)}:-2`, '-q:v', '4', '-y', tmp],
      { signal },
    );
  });
}

export type Peaks = {
  /** Picos por segundo de áudio. */
  perSecond: number;
  durationSec: number;
  /** Pico absoluto (0–1) de cada janela, mono. */
  peaks: number[];
};

/** Picos da forma de onda (para desenhar o áudio na timeline), decodificando com o FFmpeg. */
export async function waveform(file: string, { perSecond = 100, signal }: { perSecond?: number; signal?: AbortSignal } = {}): Promise<Peaks> {
  const rate = 8000;
  const r = await execFfmpeg(['-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', 'pipe:1'], { signal, captureStdout: true });
  if (r.code !== 0) throw new Error(`não foi possível decodificar o áudio de ${path.basename(file)}: ${r.stderr.trim().split(/\r?\n/).pop()}`);
  const samples = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
  return peaksOf(samples, rate, perSecond);
}

/** Picos de amostras mono (exportado para testes e para quem já tem o PCM). */
export function peaksOf(samples: Float32Array, sampleRate: number, perSecond: number): Peaks {
  const bucket = Math.max(1, Math.round(sampleRate / perSecond));
  const count = Math.ceil(samples.length / bucket);
  const peaks: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const end = Math.min(samples.length, (i + 1) * bucket);
    for (let j = i * bucket; j < end; j++) {
      const v = Math.abs(samples[j]!);
      if (v > max) max = v;
    }
    peaks[i] = Math.round(Math.min(1, max) * 1000) / 1000;
  }
  return { perSecond: sampleRate / bucket, durationSec: samples.length / sampleRate, peaks };
}

export type ProxyOptions = {
  /** Arquivo de saída (.mp4). */
  out: string;
  /** Altura máxima (px). Padrão 540. Vídeos menores mantêm o tamanho. */
  height?: number;
  /** Distância entre quadros-chave (quadros). Pequena = busca rápida na timeline. Padrão 15. */
  keyint?: number;
  /** `probeMedia(file)` já lido (evita rodar o FFmpeg de novo). */
  info?: MediaInfo;
  signal?: AbortSignal;
};

/**
 * Proxy de edição: H.264 leve, com quadros-chave frequentes e `faststart`, para o Studio tocar e
 * buscar sem engasgar em vídeos 4K/HEVC. O export sempre usa o original.
 */
export async function createProxy(file: string, { out, height = 540, keyint = 15, info: known, signal }: ProxyOptions): Promise<string> {
  const info = known ?? (await probeMedia(file));
  if (!info.hasVideo) throw new Error(`${path.basename(file)} não tem vídeo`);
  const h = Math.min(height, info.height ?? height);
  const audio = info.hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an'];
  return atomicOutput(out, async (tmp) => {
    await runFfmpegOk(
      [
        '-i', file,
        '-map', '0:v:0', ...(info.hasAudio ? ['-map', '0:a:0'] : []),
        '-vf', `scale=-2:${h - (h % 2)}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p',
        '-g', String(keyint), '-keyint_min', String(keyint), '-sc_threshold', '0',
        ...audio,
        '-movflags', '+faststart', '-y', tmp,
      ],
      { signal },
    );
  });
}
