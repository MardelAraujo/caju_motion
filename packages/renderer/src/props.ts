import { evaluateKeyframes } from '@caju-motion/core';
import type { Asset, Clip } from '@caju-motion/schema';

/**
 * Props tipadas (com defaults) de cada tipo de elemento.
 * O documento guarda `clip.props` como registro livre; aqui é onde ele ganha forma.
 */

export type TextAlign = 'left' | 'center' | 'right';

export type TextProps = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  /** Cor de fundo da caixa de texto ('' = sem fundo). */
  background: string;
};

export const TEXT_DEFAULTS: TextProps = {
  text: 'Texto',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 96,
  fontWeight: 800,
  color: '#FFFFFF',
  align: 'center',
  lineHeight: 1.1,
  letterSpacing: 0,
  background: '',
};

export type ShapeKind = 'rect' | 'ellipse';

export type ShapeProps = {
  shape: ShapeKind;
  width: number;
  height: number;
  /** Preenchimento ('' = transparente, útil para só contorno). */
  fill: string;
  /** Contorno ('' = sem contorno). */
  stroke: string;
  strokeWidth: number;
};

export const SHAPE_DEFAULTS: ShapeProps = {
  shape: 'rect',
  width: 400,
  height: 400,
  fill: '#F6B73C',
  stroke: '',
  strokeWidth: 0,
};

/**
 * Props com keyframes aplicados (`props.text`, `props.width`, `props.color`…),
 * avaliados no frame do projeto. Chaves sem keyframe ficam com o valor estático.
 */
export function resolvedProps(clip: Pick<Clip, 'props' | 'keyframes' | 'start'>, projectFrame: number): Record<string, unknown> {
  let out: Record<string, unknown> | null = null;
  for (const [path, kfs] of Object.entries(clip.keyframes)) {
    if (!path.startsWith('props.') || kfs.length === 0) continue;
    const v = evaluateKeyframes(kfs, projectFrame - clip.start);
    if (v === undefined) continue;
    out ??= { ...clip.props };
    out[path.slice('props.'.length)] = v;
  }
  return out ?? clip.props;
}

function pick<T extends Record<string, unknown>>(defaults: T, props: Record<string, unknown>): T {
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const v = props[key as string];
    if (typeof v === typeof defaults[key]) out[key] = v as T[keyof T];
  }
  return out;
}

export const textProps = (clip: Pick<Clip, 'props'>): TextProps => pick(TEXT_DEFAULTS, clip.props);
export const shapeProps = (clip: Pick<Clip, 'props'>): ShapeProps => pick(SHAPE_DEFAULTS, clip.props);

/** Tamanho intrínseco (px do projeto) de imagem/vídeo/forma. Texto é medido pelo DOM. */
export function intrinsicSize(clip: Clip, asset: Asset | undefined): { width: number; height: number } | null {
  if (clip.type === 'shape') {
    const p = shapeProps(clip);
    return { width: p.width, height: p.height };
  }
  if (clip.type === 'image' || clip.type === 'video') {
    const w = typeof clip.props.width === 'number' ? clip.props.width : asset?.meta.width;
    const h = typeof clip.props.height === 'number' ? clip.props.height : asset?.meta.height;
    return { width: w ?? 1920, height: h ?? 1080 };
  }
  return null;
}

/** Tempo (s) da mídia de origem para um frame do projeto. */
export function sourceTimeAt(clip: Pick<Clip, 'start' | 'trimIn' | 'speed'>, projectFrame: number, fps: number): number {
  return (clip.trimIn + (projectFrame - clip.start) * clip.speed) / fps;
}

/** Volume efetivo (0..1+) com fade in/out aplicados. */
export function clipVolumeAt(clip: Pick<Clip, 'start' | 'duration' | 'audio'>, projectFrame: number): number {
  const audio = clip.audio ?? { volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 };
  const local = projectFrame - clip.start;
  let gain = audio.volume;
  if (audio.fadeIn > 0 && local < audio.fadeIn) gain *= Math.max(0, local / audio.fadeIn);
  const remaining = clip.duration - local;
  if (audio.fadeOut > 0 && remaining < audio.fadeOut) gain *= Math.max(0, remaining / audio.fadeOut);
  return gain;
}
