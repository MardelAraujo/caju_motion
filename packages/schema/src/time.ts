/**
 * Tempo no frame é sempre medido em FRAMES INTEIROS do projeto.
 * Segundos só aparecem na borda (mídia de origem, UI) e são convertidos aqui.
 */

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

/** `HH:MM:SS:FF` (timecode estilo editor). */
export function formatTimecode(frames: number, fps: number): string {
  const safe = Math.max(0, Math.floor(frames));
  const fpsInt = Math.round(fps);
  const ff = safe % fpsInt;
  const totalSeconds = Math.floor(safe / fpsInt);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return [hh, mm, ss, ff].map((n) => String(n).padStart(2, '0')).join(':');
}
