import type { Easing as EasingSpec, EasingPreset } from '@caju-motion/schema';

export type EasingFn = (t: number) => number;

/**
 * cubic-bezier(x1, y1, x2, y2) igual ao CSS. x1/x2 em [0,1]; y pode sair de [0,1] (overshoot).
 * Resolve x→t por Newton-Raphson com fallback em bisseção.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) throw new RangeError('cubicBezier: x1 e x2 precisam estar em [0, 1]');
  if (x1 === y1 && x2 === y2) return (t) => t;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 60; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveT(x));
  };
}

/** Curvas nomeadas — as mesmas que o editor oferece no seletor de easing. */
export const Easing = {
  linear: ((t) => t) as EasingFn,
  /** Segura o valor até o próximo keyframe (degrau). */
  hold: ((t) => (t >= 1 ? 1 : 0)) as EasingFn,
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
  expoOut: cubicBezier(0.16, 1, 0.3, 1),
  expoInOut: cubicBezier(0.87, 0, 0.13, 1),
  softOut: cubicBezier(0.25, 0.1, 0.25, 1),
  backOut: cubicBezier(0.34, 1.56, 0.64, 1),
} satisfies Record<EasingPreset, EasingFn>;

/** Converte a especificação do documento (`'expoOut'` ou `{ bezier: [...] }`) em função. */
export function resolveEasing(spec: EasingSpec | undefined): EasingFn {
  if (spec === undefined) return Easing.linear;
  if (typeof spec === 'string') return Easing[spec];
  return cubicBezier(...spec.bezier);
}
