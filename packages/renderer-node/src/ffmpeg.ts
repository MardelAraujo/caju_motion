import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  crfFor,
  exportFormatInfo,
  type ExportSettings,
} from '@caju-motion/schema';
import type { AudioMix } from '@caju-motion/audio';
import { ffmpegPath } from '@caju-motion/media';

/** O caminho do FFmpeg vem do @caju-motion/media (`CAJU_FFMPEG_PATH` > ffmpeg-static > PATH). */
export { ffmpegPath };

export type EncodeInput = {
  settings: ExportSettings;
  /** Tamanho final do vídeo (pares). */
  width: number;
  height: number;
  /** Quadros chegam por stdin como JPEG (false) ou PNG (true). */
  lossless: boolean;
  /** Mixagem já montada com `inputOffset: 1` (ou null = sem áudio). */
  audio: AudioMix | null;
  /** Arquivo de saída; para `png-seq`, a PASTA de quadros. */
  output: string;
};

/** Argumentos do codec de vídeo por formato. */
function videoCodecArgs(s: ExportSettings): string[] {
  const crf = crfFor(s.format, s.quality);
  switch (s.format) {
    case 'mp4-h264':
      return ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
    case 'mp4-h265':
      return [
        '-c:v', 'libx265', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p',
        '-tag:v', 'hvc1', '-x265-params', 'log-level=error', '-movflags', '+faststart',
      ];
    case 'webm-vp9':
      return [
        '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-pix_fmt', 'yuv420p',
        '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
      ];
    case 'mov-prores':
      return ['-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0'];
    case 'gif':
      return ['-loop', '0'];
    case 'png-seq':
      return ['-c:v', 'png', '-start_number', '0'];
  }
}

function audioCodecArgs(s: ExportSettings): string[] {
  switch (s.format) {
    case 'mov-prores':
      return ['-c:a', 'pcm_s16le'];
    case 'webm-vp9':
      return ['-c:a', 'libopus', '-b:a', '160k'];
    default:
      return ['-c:a', 'aac', '-b:a', '192k'];
  }
}

/**
 * Comando completo do FFmpeg (função pura, testável): quadros por stdin (`image2pipe`),
 * escala exata para o tamanho de saída e, se houver, a mixagem de áudio do documento.
 */
export function buildEncodeArgs({ settings, width, height, lossless, audio, output }: EncodeInput): string[] {
  const info = exportFormatInfo(settings.format);
  const useAudio = info.audio && settings.audio && audio !== null;
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'];

  args.push('-f', 'image2pipe', '-framerate', String(settings.fps), '-c:v', lossless ? 'png' : 'mjpeg', '-i', 'pipe:0');
  if (useAudio) for (const file of audio.inputs) args.push('-i', file);

  const scale = `scale=${width}:${height}:flags=lanczos`;
  const video =
    settings.format === 'gif'
      ? `[0:v]${scale},split[g0][g1];[g0]palettegen=stats_mode=diff[gp];[g1][gp]paletteuse=dither=sierra2_4a[v]`
      : `[0:v]${scale},setsar=1[v]`;
  args.push('-filter_complex', useAudio ? `${video};${audio.filterComplex}` : video);
  args.push('-map', '[v]');
  if (useAudio) args.push('-map', `[${audio.outputLabel}]`);

  args.push(...videoCodecArgs(settings), '-r', String(settings.fps));
  if (useAudio) args.push(...audioCodecArgs(settings), '-ar', '48000', '-ac', '2');

  if (settings.format === 'png-seq') {
    args.push('-f', 'image2', `${output.replace(/[\\/]+$/, '')}/frame-%05d.png`);
  } else {
    args.push(output);
  }
  return args;
}

export type FfmpegProcess = {
  proc: ChildProcessWithoutNullStreams;
  /** Escreve um quadro no stdin, respeitando backpressure. */
  write(chunk: Buffer): Promise<void>;
  /** Fecha o stdin e espera o FFmpeg terminar (rejeita com o stderr se falhar). */
  finish(): Promise<void>;
  kill(): void;
};

/** Inicia o FFmpeg com stdin aberto para os quadros. `signal` aborta (mata o processo). */
export function startFfmpeg(args: string[], signal?: AbortSignal): FfmpegProcess {
  const proc = spawn(ffmpegPath(), args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  proc.stderr.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-8000);
  });
  proc.stdout.resume();
  let stdinError: Error | null = null;
  proc.stdin.on('error', (e) => {
    stdinError = e;
  });

  const exited = new Promise<void>((resolve, reject) => {
    proc.once('error', (e: NodeJS.ErrnoException) =>
      reject(e.code === 'ENOENT' ? new Error('FFmpeg não encontrado (instale ffmpeg-static ou defina CAJU_FFMPEG_PATH)') : e),
    );
    proc.once('close', (code, sig) => {
      if (code === 0) resolve();
      else if (signal?.aborted) reject(new Error('renderização cancelada'));
      else reject(new Error(`FFmpeg falhou (código ${code ?? sig}): ${stderr.trim() || 'sem detalhes'}`));
    });
  });
  exited.catch(() => undefined);

  const kill = () => {
    if (proc.exitCode === null && !proc.killed) proc.kill('SIGKILL');
  };
  const onAbort = () => kill();
  signal?.addEventListener('abort', onAbort, { once: true });
  void exited.finally(() => signal?.removeEventListener('abort', onAbort)).catch(() => undefined);

  return {
    proc,
    async write(chunk) {
      if (stdinError) throw await exited.then(() => stdinError!, (e: Error) => e);
      if (proc.exitCode !== null) await exited;
      if (!proc.stdin.write(chunk)) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            proc.off('close', onClose);
            resolve();
          };
          const onClose = () => {
            proc.stdin.off('drain', onDrain);
            exited.then(() => reject(new Error('FFmpeg encerrou antes do fim dos quadros')), reject);
          };
          proc.stdin.once('drain', onDrain);
          proc.once('close', onClose);
        });
      }
    },
    async finish() {
      proc.stdin.end();
      await exited;
    },
    kill,
  };
}

/** Roda o FFmpeg até o fim (sem stdin) e devolve o stderr. */
export function runFfmpeg(args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    const onAbort = () => proc.kill('SIGKILL');
    signal?.addEventListener('abort', onAbort, { once: true });
    proc.once('error', reject);
    proc.once('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (code === 0) resolve(stderr);
      else reject(new Error(signal?.aborted ? 'cancelado' : `FFmpeg falhou (código ${code}): ${stderr.trim()}`));
    });
  });
}

/** O arquivo de mídia tem trilha de áudio? (usa `ffmpeg -i`, que existe mesmo sem ffprobe) */
export function probeHasAudio(file: string): boolean {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-i', file], { encoding: 'utf8', windowsHide: true });
  return /Stream #\d+:\d+.*: Audio:/.test(r.stderr ?? '');
}
