import type { Clip, Keyframe } from '@caju-motion/schema';
import { isHexColor, mixColors } from './color';
import { resolveEasing } from './easing';

export type KeyframeValue = number | string;

/**
 * Valor de uma trilha de keyframes no frame LOCAL (relativo ao clipe).
 * - antes do 1º keyframe → valor do 1º; depois do último → valor do último;
 * - o easing do keyframe A governa o segmento A→B;
 * - números interpolam; cores hex misturam; outras strings seguram (degrau).
 */
export function evaluateKeyframes(keyframes: readonly Keyframe[], localFrame: number): KeyframeValue | undefined {
  if (keyframes.length === 0) return undefined;
  const kfs = [...keyframes].sort((a, b) => a.frame - b.frame);
  const first = kfs[0]!;
  const last = kfs[kfs.length - 1]!;
  if (localFrame <= first.frame) return first.value;
  if (localFrame >= last.frame) return last.value;

  let i = 0;
  while (localFrame >= kfs[i + 1]!.frame) i++;
  const a = kfs[i]!;
  const b = kfs[i + 1]!;

  const t = resolveEasing(a.easing)((localFrame - a.frame) / (b.frame - a.frame));

  if (typeof a.value === 'number' && typeof b.value === 'number') return a.value + (b.value - a.value) * t;
  if (typeof a.value === 'string' && typeof b.value === 'string' && isHexColor(a.value) && isHexColor(b.value)) {
    return mixColors(a.value, b.value, t);
  }
  return t >= 1 ? b.value : a.value;
}

export function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Valor de uma propriedade do clipe no frame do PROJETO, considerando keyframes.
 * `path` é o caminho no clipe: `opacity`, `transform.x`, `props.fontSize`, `audio.volume`…
 */
export function clipValue<T extends KeyframeValue>(clip: Clip, path: string, projectFrame: number, fallback: T): T {
  const kfs = clip.keyframes[path];
  if (kfs && kfs.length > 0) {
    const v = evaluateKeyframes(kfs, projectFrame - clip.start);
    if (typeof v === typeof fallback) return v as T;
  }
  const stat = getByPath(clip, path);
  return typeof stat === typeof fallback ? (stat as T) : fallback;
}

/** O clipe está visível/ativo neste frame do projeto? (intervalo meio-aberto [start, end)) */
export function isClipActive(clip: Pick<Clip, 'start' | 'duration'>, projectFrame: number): boolean {
  return projectFrame >= clip.start && projectFrame < clip.start + clip.duration;
}
