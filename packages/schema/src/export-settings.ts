/**
 * Configuração de exportação (formato, resolução, fps, qualidade) e estimativas.
 * Módulo puro, compartilhado pelo balão Exportar do Studio, pela CLI (`caju render`)
 * e pelo exportador (`@caju-motion/renderer-node`).
 */

export const EXPORT_FORMAT_IDS = ['mp4-h264', 'mp4-h265', 'mov-prores', 'webm-vp9', 'gif', 'png-seq'] as const;
export type ExportFormat = (typeof EXPORT_FORMAT_IDS)[number];
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

export type ExportFormatInfo = {
  id: ExportFormat;
  label: string;
  detail: string;
  /** Gera um arquivo de vídeo com codec de qualidade ajustável (CRF). */
  video: boolean;
  /** Aceita trilha de áudio. */
  audio: boolean;
  /** Extensão do arquivo de saída ('' = pasta de quadros). */
  ext: 'mp4' | 'mov' | 'webm' | 'gif' | '';
  /** Quadros capturados sem perdas (PNG) em vez de JPEG. */
  lossless: boolean;
};

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  { id: 'mp4-h264', label: 'MP4', detail: 'H.264 · compatível com tudo', video: true, audio: true, ext: 'mp4', lossless: false },
  { id: 'mp4-h265', label: 'MP4 HEVC', detail: 'H.265 · arquivo menor', video: true, audio: true, ext: 'mp4', lossless: false },
  { id: 'mov-prores', label: 'MOV ProRes', detail: 'ProRes 422 · para edição', video: true, audio: true, ext: 'mov', lossless: true },
  { id: 'webm-vp9', label: 'WebM', detail: 'VP9 · web', video: true, audio: true, ext: 'webm', lossless: false },
  { id: 'gif', label: 'GIF', detail: 'Animação sem áudio', video: false, audio: false, ext: 'gif', lossless: true },
  { id: 'png-seq', label: 'PNG', detail: 'Sequência de quadros', video: false, audio: false, ext: '', lossless: true },
];

export const EXPORT_RESOLUTIONS: { id: ExportResolution; label: string }[] = [
  { id: 720, label: '720p' },
  { id: 1080, label: '1080p' },
  { id: 1440, label: '2K' },
  { id: 2160, label: '4K' },
];

export const EXPORT_FPS = [24, 25, 30, 50, 60];

/** CRF de referência (H.264): menor = mais qualidade. Outros codecs: veja `crfFor`. */
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

/** VP9 usa outra escala de CRF (0–63); valores equivalentes "a olho" aos do H.264. */
const VP9_CRF: Record<ExportQuality, number> = { draft: 40, good: 34, high: 28, max: 22 };

export const exportFormatInfo = (format: ExportFormat): ExportFormatInfo => EXPORT_FORMATS.find((f) => f.id === format)!;

/**
 * CRF por codec para a qualidade pedida. H.265 tem o mesmo visual com CRF ~5 maior que o H.264
 * (o padrão do x265 é 28 contra 23 do x264). ProRes/GIF/PNG não usam CRF (null).
 */
export function crfFor(format: ExportFormat, quality: ExportQuality): number | null {
  const base = EXPORT_QUALITIES.find((q) => q.id === quality)!.crf;
  switch (format) {
    case 'mp4-h264':
      return base;
    case 'mp4-h265':
      return base + 5;
    case 'webm-vp9':
      return VP9_CRF[quality];
    default:
      return null;
  }
}

/** Há áudio no arquivo final? (formato aceita E o usuário pediu) */
export const exportHasAudio = (s: Pick<ExportSettings, 'format' | 'audio'>): boolean => s.audio && exportFormatInfo(s.format).audio;

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

/**
 * Valida/normaliza configurações vindas de fora (corpo HTTP, flags da CLI).
 * Campos ausentes usam o padrão do projeto; valores inválidos lançam erro com mensagem legível.
 */
export function parseExportSettings(
  input: unknown,
  project: { width: number; height: number; fps: number },
): ExportSettings {
  const base = defaultExportSettings(project);
  if (input === undefined || input === null) return base;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('configuração de exportação deve ser um objeto');
  const o = input as Record<string, unknown>;
  const out = { ...base };

  if (o.format !== undefined) {
    if (!(EXPORT_FORMAT_IDS as readonly unknown[]).includes(o.format)) {
      throw new Error(`formato inválido: "${String(o.format)}" (use ${EXPORT_FORMAT_IDS.join(', ')})`);
    }
    out.format = o.format as ExportFormat;
  }
  if (o.resolution !== undefined) {
    const r = Number(o.resolution);
    if (!EXPORT_RESOLUTIONS.some((x) => x.id === r)) {
      throw new Error(`resolução inválida: "${String(o.resolution)}" (use ${EXPORT_RESOLUTIONS.map((x) => x.id).join(', ')})`);
    }
    out.resolution = r as ExportResolution;
  }
  if (o.fps !== undefined) {
    const f = Number(o.fps);
    if (!Number.isInteger(f) || f < 1 || f > 120) throw new Error(`fps inválido: "${String(o.fps)}" (inteiro entre 1 e 120)`);
    out.fps = f;
  }
  if (o.quality !== undefined) {
    if (!EXPORT_QUALITIES.some((q) => q.id === o.quality)) {
      throw new Error(`qualidade inválida: "${String(o.quality)}" (use ${EXPORT_QUALITIES.map((q) => q.id).join(', ')})`);
    }
    out.quality = o.quality as ExportQuality;
  }
  if (o.audio !== undefined) {
    if (typeof o.audio !== 'boolean') throw new Error('"audio" deve ser true ou false');
    out.audio = o.audio;
  }
  return out;
}

/** Estimativa grosseira do tamanho do arquivo, em bytes. */
export function estimateBytes(s: ExportSettings, project: { width: number; height: number }, seconds: number): number {
  const { width, height } = outputSize(project, s.resolution);
  const bpp = EXPORT_QUALITIES.find((q) => q.id === s.quality)!.bpp;
  const videoBits = width * height * s.fps * bpp * CODEC_FACTOR[s.format] * seconds;
  const audioBits = exportHasAudio(s) ? 192_000 * seconds : 0;
  return (videoBits + audioBits) / 8;
}

export function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}
