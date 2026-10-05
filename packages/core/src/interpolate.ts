import type { EasingFn } from './easing';

export type Extrapolate = 'clamp' | 'extend' | 'identity';

export type InterpolateOptions = {
  easing?: EasingFn;
  extrapolateLeft?: Extrapolate;
  extrapolateRight?: Extrapolate;
};

/**
 * Mapeia `input` de `inputRange` para `outputRange` (lineares por partes).
 * Padrão: CLAMP nas duas pontas — o caso comum em motion (evita valores fugindo).
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number {
  if (inputRange.length < 2) throw new RangeError('interpolate: inputRange precisa de pelo menos 2 valores');
  if (inputRange.length !== outputRange.length) {
    throw new RangeError('interpolate: inputRange e outputRange precisam ter o mesmo tamanho');
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (!(inputRange[i]! > inputRange[i - 1]!)) {
      throw new RangeError('interpolate: inputRange precisa ser estritamente crescente');
    }
  }
  if (Number.isNaN(input)) throw new RangeError('interpolate: input é NaN');

  const { easing = (t: number) => t, extrapolateLeft = 'clamp', extrapolateRight = 'clamp' } = options;

  // segmento que contém o input (ou o da ponta)
  let seg = 0;
  while (seg < inputRange.length - 2 && input > inputRange[seg + 1]!) seg++;

  const inMin = inputRange[seg]!;
  const inMax = inputRange[seg + 1]!;
  const outMin = outputRange[seg]!;
  const outMax = outputRange[seg + 1]!;

  if (input < inMin) {
    if (extrapolateLeft === 'clamp') return outMin;
    if (extrapolateLeft === 'identity') return input;
  }
  if (input > inMax) {
    if (extrapolateRight === 'clamp') return outMax;
    if (extrapolateRight === 'identity') return input;
  }

  let t = (input - inMin) / (inMax - inMin);
  // easing só dentro do intervalo; fora dele (extend) seguimos linear
  if (t >= 0 && t <= 1) t = easing(t);
  return outMin + t * (outMax - outMin);
}

/** Atalho: progresso 0→1 entre dois frames, com easing e clamp. */
export function progress(frame: number, from: number, to: number, easing?: EasingFn): number {
  if (to <= from) return frame >= to ? 1 : 0;
  return interpolate(frame, [from, to], [0, 1], easing ? { easing } : {});
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
