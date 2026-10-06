import { probeMedia, type MediaInfo } from '@caju-motion/media';

export type { MediaInfo };

/**
 * Lê duração/tamanho/fps de uma mídia (usa o FFmpeg do @caju-motion/media; não precisa de ffprobe).
 * Útil para cronometrar cenas pela locução: `p.sec((await measureMedia(vo)).durationSec!)`.
 */
export function measureMedia(file: string): Promise<MediaInfo> {
  return probeMedia(file);
}
