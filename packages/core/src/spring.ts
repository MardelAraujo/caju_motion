/**
 * Mola amortecida — solução ANALÍTICA do oscilador harmônico (sem simulação passo a passo),
 * então o valor no frame N é função pura de N: determinístico e seekável.
 */

export type SpringConfig = {
  mass: number;
  stiffness: number;
  damping: number;
  /** Corta o overshoot: nunca passa do alvo. */
  overshootClamping: boolean;
};

export const springPresets = {
  /** Resposta de UI: rápida, quase sem overshoot. */
  ui: { mass: 1, stiffness: 170, damping: 26, overshootClamping: false },
  /** Assentamento suave, sem pulo. */
  settle: { mass: 1, stiffness: 100, damping: 20, overshootClamping: false },
  /** Com pulinho visível. */
  bouncy: { mass: 1, stiffness: 180, damping: 12, overshootClamping: false },
  /** Pesado e lento. */
  heavy: { mass: 3, stiffness: 120, damping: 30, overshootClamping: false },
} satisfies Record<string, SpringConfig>;

const DEFAULT_CONFIG: SpringConfig = springPresets.ui;

/** Deslocamento normalizado (1 → 0) no tempo t (s), partindo do repouso. */
function displacement(t: number, { mass, stiffness, damping }: SpringConfig): number {
  if (t <= 0) return 1;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = 1;
  const v0 = 0;

  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return Math.exp(-zeta * w0 * t) * (x0 * Math.cos(wd * t) + ((v0 + zeta * w0 * x0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
  }
  const root = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + root;
  const r2 = -zeta * w0 - root;
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  return c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

export type SpringOptions = {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
  /** Atraso em frames antes da mola começar. */
  delay?: number;
};

export function spring({ frame, fps, config, from = 0, to = 1, delay = 0 }: SpringOptions): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const t = (frame - delay) / fps;
  let p = 1 - displacement(t, cfg);
  if (cfg.overshootClamping) p = Math.min(p, 1);
  return from + (to - from) * p;
}

/** Quantos frames até a mola ficar parada (|deslocamento| < threshold daí em diante). */
export function springDuration({
  fps,
  config,
  threshold = 0.005,
  maxFrames = 600,
}: {
  fps: number;
  config?: Partial<SpringConfig>;
  threshold?: number;
  maxFrames?: number;
}): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastOutside = 0;
  for (let f = 0; f <= maxFrames; f++) {
    if (Math.abs(displacement(f / fps, cfg)) >= threshold) lastOutside = f;
  }
  return lastOutside + 1;
}
