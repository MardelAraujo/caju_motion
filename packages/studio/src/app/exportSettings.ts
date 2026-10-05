/** Configuração de exportação (formato, resolução, fps, qualidade) e estimativas. */

export type ExportFormat = 'mp4-h264' | 'mp4-h265' | 'mov-prores' | 'webm-vp9' | 'gif' | 'png-seq';
export type ExportQuality = 'draft' | 'good' | 'high' | 'max';
export type ExportResolution = 720 | 1080 | 1440 | 2160;

export type ExportSettings = {
  format: ExportFormat;
  /** lado menor da saída, em px */
  resolution: ExportResolution;
  fps: number;
  quality: ExportQuality;
  audio: boolean;
};

export const EXPORT_FORMATS: { id: ExportFormat; label: string; detail: string; video: boolean; audio: boolean }[] = [
  { id: 'mp4-h264', label: 'MP4', detail: 'H.264 · compatível com tudo', video: true, audio: true },
  { id: 'mp4-h265', label: 'MP4 HEVC', detail: 'H.265 · arquivo menor', video: true, audio: true },
  { id: 'mov-prores', label: 'MOV ProRes', detail: 'ProRes 422 · para edição', video: true, audio: true },
  { id: 'webm-vp9', label: 'WebM', detail: 'VP9 · web', video: true, audio: true },
  { id: 'gif', label: 'GIF', detail: 'Animação sem áudio', video: false, audio: false },
  { id: 'png-seq', label: 'PNG', detail: 'Sequência de quadros', video: false, audio: false },
];

export const EXPORT_RESOLUTIONS: { id: ExportResolution; label: string }[] = [
  { id: 720, label: '720p' },
  { id: 1080, label: '1080p' },
  { id: 1440, label: '2K' },
  { id: 2160, label: '4K' },
];

export const EXPORT_FPS = [24, 25, 30, 50, 60];

/** CRF de referência (H.264/H.265/VP9): menor = mais qualidade. */
export const EXPORT_QUALITIES: { id: ExportQuality; label: string; crf: number; bpp: number }[] = [
  { id: 'draft', label: 'Rascunho', crf: 28, bpp: 0.04 },
  { id: 'good', label: 'Boa', crf: 23, bpp: 0.07 },
  { id: 'high', label: 'Alta', crf: 18, bpp: 0.11 },
  { id: 'max', label: 'Máxima', crf: 14, bpp: 0.18 },
];

const CODEC_FACTOR: Record<ExportFormat, number> = {
  'mp4-h264': 1,
  'mp4-h265': 0.6,
  'webm-vp9': 0.7,
  'mov-prores': 12,
  gif: 1.5,
  'png-seq': 25,
};

export function defaultExportSettings(project: { width: number; height: number; fps: number }): ExportSettings {
  const short = Math.min(project.width, project.height);
  const resolution = [...EXPORT_RESOLUTIONS].reverse().find((r) => r.id <= short)?.id ?? 720;
  return { format: 'mp4-h264', resolution, fps: project.fps, quality: 'high', audio: true };
}

/** Dimensões de saída: escala o quadro do projeto para o lado menor pedido (valores pares, exigência do H.264). */
export function outputSize(project: { width: number; height: number }, resolution: number) {
  const k = resolution / Math.min(project.width, project.height);
  const even = (v: number) => Math.max(2, Math.round((v * k) / 2) * 2);
  return { width: even(project.width), height: even(project.height) };
}

/** Estimativa grosseira do tamanho do arquivo, em bytes. */
export function estimateBytes(s: ExportSettings, project: { width: number; height: number }, seconds: number): number {
  const { width, height } = outputSize(project, s.resolution);
  const bpp = EXPORT_QUALITIES.find((q) => q.id === s.quality)!.bpp;
  const videoBits = width * height * s.fps * bpp * CODEC_FACTOR[s.format] * seconds;
  const audioBits = s.audio && EXPORT_FORMATS.find((f) => f.id === s.format)!.audio ? 192_000 * seconds : 0;
  return (videoBits + audioBits) / 8;
}

export function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}
