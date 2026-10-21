import { clipValue, Easing, resolveEasing, type EasingFn } from '@caju-motion/core';
import type { Clip, Easing as EasingSpec } from '@caju-motion/schema';

/**
 * Movimento de clipe: transições (`transitionIn/Out`), animações de entrada/saída/loop
 * (`animationIn/Out/Loop`) e efeitos (`effects[]`, filtros CSS). Funções puras do frame:
 * o mesmo frame dá sempre o mesmo resultado (preview = export).
 *
 * Entradas e saídas usam a mesma biblioteca de "poses". Uma pose recebe `p` (0 = fora de cena,
 * 1 = em repouso) e diz como o elemento está. A saída é a entrada espelhada no tempo, com o easing
 * espelhado: quem entra desacelerando sai acelerando, pelo mesmo lado (`direction`).
 */

export type MotionState = {
  opacity: number;
  /** Deslocamento na tela (px do quadro). */
  x: number;
  y: number;
  scale: number;
  rotate: number;
  blur: number;
  /** `clip-path` (relativo à caixa do elemento). */
  clipPath?: string;
};

export const REST: MotionState = Object.freeze({ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, blur: 0 }) as MotionState;

export type Direction = 'left' | 'right' | 'up' | 'down';
type Params = Record<string, unknown>;
export type FrameSize = { width: number; height: number };

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const dir = (v: unknown, fallback: Direction): Direction => (v === 'left' || v === 'right' || v === 'up' || v === 'down' ? v : fallback);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Vetor unitário do lado de onde o elemento vem (e para onde vai, na saída). */
function offset(d: Direction): [number, number] {
  return d === 'left' ? [-1, 0] : d === 'right' ? [1, 0] : d === 'up' ? [0, -1] : [0, 1];
}

export type PoseDef = {
  label: string;
  /** Parâmetros aceitos (documentação e painéis do Studio). */
  params?: Record<string, { label: string; default: number | string; options?: readonly string[] }>;
  /** Easing padrão da entrada. */
  easing: EasingSpec;
  pose(p: number, params: Params, frame: FrameSize): Partial<MotionState>;
};

const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;

/** Poses de entrada/saída, compartilhadas por transições e animações. */
export const POSES = {
  fade: { label: 'Esmaecer', easing: 'easeInOut', pose: (p) => ({ opacity: p }) },
  slide: {
    label: 'Deslizar',
    easing: 'expoOut',
    params: { direction: { label: 'Direção', default: 'left', options: DIRECTIONS }, distance: { label: 'Distância (px; 0 = quadro inteiro)', default: 0 } },
    pose: (p, prm, f) => {
      const [dx, dy] = offset(dir(prm.direction, 'left'));
      const d = num(prm.distance, 0) || (dx ? f.width : f.height);
      return { x: dx * d * (1 - p), y: dy * d * (1 - p) };
    },
  },
  rise: {
    label: 'Subir',
    easing: 'expoOut',
    params: { distance: { label: 'Distância (px)', default: 80 } },
    pose: (p, prm) => ({ y: num(prm.distance, 80) * (1 - p), opacity: p }),
  },
  drop: {
    label: 'Descer',
    easing: 'expoOut',
    params: { distance: { label: 'Distância (px)', default: 80 } },
    pose: (p, prm) => ({ y: -num(prm.distance, 80) * (1 - p), opacity: p }),
  },
  zoom: {
    label: 'Zoom',
    easing: 'expoOut',
    params: { from: { label: 'Escala inicial', default: 0.6 } },
    pose: (p, prm) => {
      const from = num(prm.from, 0.6);
      return { scale: from + (1 - from) * p, opacity: p };
    },
  },
  pop: {
    label: 'Pop',
    easing: 'backOut',
    pose: (p) => ({ scale: 0.4 + 0.6 * p, opacity: clamp01(p * 2) }),
  },
  blur: {
    label: 'Desfoque',
    easing: 'easeOut',
    params: { amount: { label: 'Desfoque (px)', default: 24 } },
    pose: (p, prm) => ({ blur: num(prm.amount, 24) * (1 - p), opacity: p }),
  },
  spin: {
    label: 'Girar',
    easing: 'expoOut',
    params: { degrees: { label: 'Graus', default: -90 } },
    pose: (p, prm) => ({ rotate: num(prm.degrees, -90) * (1 - p), scale: 0.6 + 0.4 * p, opacity: p }),
  },
  wipe: {
    label: 'Cortina',
    easing: 'easeInOut',
    params: { direction: { label: 'Revela a partir de', default: 'left', options: DIRECTIONS } },
    pose: (p, prm) => {
      const hidden = `${((1 - p) * 100).toFixed(3)}%`;
      const d = dir(prm.direction, 'left');
      // revela a partir do lado `d`: esconde a parte oposta
      const inset = d === 'left' ? `0 ${hidden} 0 0` : d === 'right' ? `0 0 0 ${hidden}` : d === 'up' ? `0 0 ${hidden} 0` : `${hidden} 0 0 0`;
      return { clipPath: `inset(${inset})` };
    },
  },
  iris: {
    label: 'Íris',
    easing: 'easeInOut',
    pose: (p) => ({ clipPath: `circle(${(p * 75).toFixed(3)}% at 50% 50%)` }),
  },
} satisfies Record<string, PoseDef>;

export type PoseName = keyof typeof POSES;
/** Sinônimos (nomes comuns em outros editores). */
const POSE_ALIASES: Record<string, PoseName> = { push: 'slide', dissolve: 'fade', crossfade: 'fade', scale: 'zoom', reveal: 'wipe' };

export function poseByName(name: string): PoseDef | undefined {
  return (POSES as Record<string, PoseDef>)[name] ?? (POSE_ALIASES[name] ? POSES[POSE_ALIASES[name]] : undefined);
}

/** Animações em loop: função do tempo, sem começo nem fim. */
export const LOOPS = {
  pulse: { label: 'Pulsar', state: (t: number, a: number) => ({ scale: 1 + a * 0.06 * Math.sin(t * 2 * Math.PI) }) },
  float: { label: 'Flutuar', state: (t: number, a: number) => ({ y: a * 12 * Math.sin(t * 2 * Math.PI) }) },
  wiggle: { label: 'Balançar', state: (t: number, a: number) => ({ rotate: a * 4 * Math.sin(t * 2 * Math.PI) }) },
  breathe: { label: 'Respirar', state: (t: number, a: number) => ({ opacity: 1 - a * 0.25 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI)) }) },
  spin: { label: 'Rodar', state: (t: number, a: number) => ({ rotate: 360 * a * t }) },
} satisfies Record<string, { label: string; state: (t: number, amplitude: number) => Partial<MotionState> }>;

export type LoopName = keyof typeof LOOPS;

function combine(a: MotionState, b: Partial<MotionState>): MotionState {
  return {
    opacity: a.opacity * (b.opacity ?? 1),
    x: a.x + (b.x ?? 0),
    y: a.y + (b.y ?? 0),
    scale: a.scale * (b.scale ?? 1),
    rotate: a.rotate + (b.rotate ?? 0),
    blur: a.blur + (b.blur ?? 0),
    // o recorte mais recente vence (dois recortes ao mesmo tempo são raros e não se compõem em CSS)
    clipPath: b.clipPath ?? a.clipPath,
  };
}

type Phase = { type: string; duration: number; params: Params; easing?: EasingSpec };

/**
 * Pose de uma fase de entrada (`t` = 0→1 dentro da janela) ou de saída (`t` = 0→1 até o fim do
 * clipe). Fora da janela devolve `null` (repouso).
 */
function phaseState(phase: Phase | undefined, kind: 'in' | 'out', local: number, clipDuration: number, frame: FrameSize): Partial<MotionState> | null {
  if (!phase) return null;
  const def = poseByName(phase.type);
  if (!def) return null;
  // entrada e saída juntas não podem passar do clipe: cada uma no máximo o clipe inteiro
  const dur = Math.max(1, Math.min(phase.duration, clipDuration));
  const ease: EasingFn = resolveEasing(phase.easing ?? def.easing);
  if (kind === 'in') {
    if (local >= dur) return null;
    return def.pose(ease(clamp01(local / dur)), phase.params, frame);
  }
  const startOut = clipDuration - dur;
  if (local < startOut) return null;
  // saída = entrada espelhada: pelo mesmo lado e com o easing espelhado no tempo
  const t = clamp01((local - startOut + 1) / dur);
  return def.pose(ease(1 - t), phase.params, frame);
}

/** Movimento do clipe no frame do projeto (transições + animações). */
export function clipMotion(clip: Clip, projectFrame: number, frame: FrameSize, fps = 30): MotionState {
  const local = projectFrame - clip.start;
  let state = REST;
  const phases: [Phase | undefined, 'in' | 'out'][] = [
    [clip.transitionIn, 'in'],
    [clip.animationIn && { type: clip.animationIn.preset, duration: clip.animationIn.duration, params: clip.animationIn.params, easing: easingParam(clip.animationIn.params) }, 'in'],
    [clip.animationOut && { type: clip.animationOut.preset, duration: clip.animationOut.duration, params: clip.animationOut.params, easing: easingParam(clip.animationOut.params) }, 'out'],
    [clip.transitionOut, 'out'],
  ];
  for (const [phase, kind] of phases) {
    const s = phaseState(phase, kind, local, clip.duration, frame);
    if (s) state = combine(state, s);
  }
  const loop = clip.animationLoop;
  const loopDef = loop ? (LOOPS as Record<string, (typeof LOOPS)[LoopName]>)[loop.preset] : undefined;
  if (loop && loopDef) {
    // `duration` = período em frames; `amplitude` multiplica a intensidade
    const period = Math.max(1, loop.duration || fps * 2);
    state = combine(state, loopDef.state(local / period, num(loop.params.amplitude, 1)));
  }
  return state;
}

function easingParam(params: Params): EasingSpec | undefined {
  const e = params.easing;
  return typeof e === 'string' && e in Easing ? (e as EasingSpec) : undefined;
}

/** CSS do movimento para o invólucro do clipe: deslocamento na tela + giro/escala em torno da âncora. */
export function motionCss(m: MotionState): { prefix: string; suffix: string; opacity: number; filter?: string; clipPath?: string } {
  return {
    prefix: m.x || m.y ? `translate(${round(m.x)}px, ${round(m.y)}px) ` : '',
    suffix: (m.rotate ? ` rotate(${round(m.rotate)}deg)` : '') + (m.scale !== 1 ? ` scale(${round(m.scale, 5)})` : ''),
    opacity: m.opacity,
    filter: m.blur > 0.01 ? `blur(${round(m.blur)}px)` : undefined,
    clipPath: m.clipPath,
  };
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- efeitos (filtros CSS)

export type EffectDef = {
  label: string;
  params: Record<string, { label: string; default: number | string }>;
  css(p: Record<string, number | string>): string;
};

/** Efeitos de `clip.effects[]` (e dos clipes de ajuste). Parâmetros animáveis por keyframe em `effects.<id>.<param>`. */
export const EFFECTS = {
  blur: { label: 'Desfoque', params: { radius: { label: 'Raio (px)', default: 8 } }, css: (p) => `blur(${p.radius}px)` },
  brightness: { label: 'Brilho', params: { amount: { label: 'Quantidade', default: 1.2 } }, css: (p) => `brightness(${p.amount})` },
  contrast: { label: 'Contraste', params: { amount: { label: 'Quantidade', default: 1.2 } }, css: (p) => `contrast(${p.amount})` },
  saturate: { label: 'Saturação', params: { amount: { label: 'Quantidade', default: 1.4 } }, css: (p) => `saturate(${p.amount})` },
  grayscale: { label: 'Preto e branco', params: { amount: { label: 'Quantidade', default: 1 } }, css: (p) => `grayscale(${p.amount})` },
  sepia: { label: 'Sépia', params: { amount: { label: 'Quantidade', default: 0.8 } }, css: (p) => `sepia(${p.amount})` },
  hueRotate: { label: 'Matiz', params: { degrees: { label: 'Graus', default: 90 } }, css: (p) => `hue-rotate(${p.degrees}deg)` },
  invert: { label: 'Inverter', params: { amount: { label: 'Quantidade', default: 1 } }, css: (p) => `invert(${p.amount})` },
  dropShadow: {
    label: 'Sombra',
    params: {
      x: { label: 'X', default: 0 },
      y: { label: 'Y', default: 12 },
      blur: { label: 'Desfoque', default: 24 },
      color: { label: 'Cor', default: '#00000080' },
    },
    css: (p) => `drop-shadow(${p.x}px ${p.y}px ${p.blur}px ${p.color})`,
  },
} satisfies Record<string, EffectDef>;

export type EffectName = keyof typeof EFFECTS;

/** `filter` CSS dos efeitos ativos do clipe no frame (keyframes de parâmetros inclusos). */
export function effectsFilter(clip: Pick<Clip, 'effects' | 'keyframes' | 'start'> & Partial<Clip>, projectFrame: number): string | undefined {
  const parts: string[] = [];
  for (const e of clip.effects) {
    const def = (EFFECTS as Record<string, EffectDef>)[e.type];
    if (!e.enabled || !def) continue;
    const values: Record<string, number | string> = {};
    for (const [key, spec] of Object.entries(def.params)) {
      const raw = e.params[key];
      const base = typeof raw === 'number' || typeof raw === 'string' ? raw : spec.default;
      values[key] = clipValue(clip as Clip, `effects.${e.id}.${key}`, projectFrame, base);
    }
    parts.push(def.css(values));
  }
  return parts.length ? parts.join(' ') : undefined;
}

// ---------------------------------------------------------------- clipes de efeito (sobreposições)

export const OVERLAYS = {
  vignette: { label: 'Vinheta', params: { amount: { label: 'Intensidade', default: 0.6 }, color: { label: 'Cor', default: '#000000' } } },
  letterbox: { label: 'Faixas de cinema', params: { ratio: { label: 'Proporção', default: 2.39 }, color: { label: 'Cor', default: '#000000' } } },
  colorOverlay: { label: 'Cor por cima', params: { color: { label: 'Cor', default: '#F47B35' }, opacity: { label: 'Opacidade', default: 0.25 } } },
  flash: { label: 'Flash', params: { color: { label: 'Cor', default: '#FFFFFF' } } },
  grain: { label: 'Granulado', params: { amount: { label: 'Intensidade', default: 0.12 } } },
} satisfies Record<string, { label: string; params: EffectDef['params'] }>;

export type OverlayName = keyof typeof OVERLAYS;
