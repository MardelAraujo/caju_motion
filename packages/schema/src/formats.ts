/**
 * Presets de formato com safe zones por plataforma.
 * `safe` = margens (px) que a UI da rede social cobre; o editor desenha esse overlay.
 */

export type Insets = { top: number; right: number; bottom: number; left: number };

export type FormatPreset = {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  fps: number;
  safe: Insets;
};

export const FORMAT_IDS = ['reel-9x16', 'feed-4x5', 'square-1x1', 'landscape-16x9'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const FORMATS: Record<FormatId, FormatPreset> = {
  'reel-9x16': {
    id: 'reel-9x16',
    label: 'Reels / Stories / TikTok (9:16)',
    width: 1080,
    height: 1920,
    fps: 30,
    safe: { top: 250, right: 60, bottom: 420, left: 60 },
  },
  'feed-4x5': {
    id: 'feed-4x5',
    label: 'Feed (4:5)',
    width: 1080,
    height: 1350,
    fps: 30,
    safe: { top: 80, right: 80, bottom: 80, left: 80 },
  },
  'square-1x1': {
    id: 'square-1x1',
    label: 'Quadrado (1:1)',
    width: 1080,
    height: 1080,
    fps: 30,
    safe: { top: 72, right: 72, bottom: 72, left: 72 },
  },
  'landscape-16x9': {
    id: 'landscape-16x9',
    label: 'YouTube / Apresentação (16:9)',
    width: 1920,
    height: 1080,
    fps: 30,
    safe: { top: 54, right: 96, bottom: 120, left: 96 },
  },
};
