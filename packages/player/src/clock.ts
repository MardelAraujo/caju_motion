/**
 * Lógica pura do player (sem React/DOM): faixa de reprodução, avanço do relógio e encaixe no contêiner.
 * Tempo é sempre em frames inteiros.
 */

export type PlayRange = { inFrame: number; outFrame: number };

/** Faixa válida dentro de [0, duration - 1]; `outFrame` nunca fica antes de `inFrame`. */
export function resolveRange(duration: number, inFrame?: number, outFrame?: number): PlayRange {
  const last = Math.max(0, Math.floor(duration) - 1);
  const a = clamp(Math.floor(inFrame ?? 0), 0, last);
  const b = clamp(Math.floor(outFrame ?? last), a, last);
  return { inFrame: a, outFrame: b };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type AdvanceInput = PlayRange & {
  /** Frame em que a reprodução (re)começou. */
  startFrame: number;
  /** Tempo real desde então, em ms. */
  elapsedMs: number;
  fps: number;
  /** Velocidade (> 0). */
  rate: number;
  loop: boolean;
};

/** Frame atual a partir do tempo real; `ended` quando passou do fim sem loop. */
export function advance({ startFrame, elapsedMs, fps, rate, inFrame, outFrame, loop }: AdvanceInput): { frame: number; ended: boolean } {
  const raw = startFrame + Math.floor((Math.max(0, elapsedMs) / 1000) * fps * Math.max(0, rate));
  if (raw <= outFrame) return { frame: Math.max(inFrame, raw), ended: false };
  if (!loop) return { frame: outFrame, ended: true };
  const span = outFrame - inFrame + 1;
  return { frame: inFrame + ((raw - inFrame) % span), ended: false };
}

/** Escala para caber (contain) o quadro do vídeo no contêiner, e o deslocamento para centralizar. */
export function fitScale(
  box: { width: number; height: number },
  video: { width: number; height: number },
): { scale: number; left: number; top: number } {
  if (box.width <= 0 || box.height <= 0 || video.width <= 0 || video.height <= 0) return { scale: 0, left: 0, top: 0 };
  const scale = Math.min(box.width / video.width, box.height / video.height);
  return { scale, left: (box.width - video.width * scale) / 2, top: (box.height - video.height * scale) / 2 };
}

/** `m:ss` (ou `h:mm:ss`) a partir de frames. */
export function formatTime(frame: number, fps: number): string {
  const total = Math.max(0, Math.floor(frame / fps));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
