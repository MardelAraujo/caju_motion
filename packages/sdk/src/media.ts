import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type MediaInfo = {
  /** Duração em segundos (áudio/vídeo). */
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
};

/**
 * Lê duração/tamanho de uma mídia com o `ffprobe` (no PATH, ou em `FFPROBE_PATH`).
 * Útil para cronometrar cenas pela locução: `p.sec((await measureMedia(vo)).durationSec!)`.
 */
export async function measureMedia(file: string): Promise<MediaInfo> {
  const bin = process.env.FFPROBE_PATH || 'ffprobe';
  let stdout: string;
  try {
    ({ stdout } = await run(bin, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
      maxBuffer: 8 * 1024 * 1024,
    }));
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === 'ENOENT') {
      throw new Error('measureMedia precisa do ffprobe (vem com o FFmpeg). Instale o FFmpeg ou defina FFPROBE_PATH.');
    }
    throw new Error(`ffprobe falhou em ${file}: ${(e.stderr || e.message).trim()}`);
  }
  type Stream = { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string };
  const data = JSON.parse(stdout) as { streams?: Stream[]; format?: { duration?: string } };
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration);
  const info: MediaInfo = { hasAudio: !!audio, hasVideo: !!video };
  if (Number.isFinite(duration) && duration > 0) info.durationSec = duration;
  if (video?.width) info.width = video.width;
  if (video?.height) info.height = video.height;
  const [n, d] = (video?.avg_frame_rate ?? '').split('/').map(Number);
  if (n && d) info.fps = n / d;
  return info;
}
