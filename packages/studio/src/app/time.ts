/** `mm:ss:ff` — formato do contador do CapCut. */
export function formatClock(frames: number, fps: number): string {
  const f = Math.max(0, Math.floor(frames));
  const ff = f % fps;
  const s = Math.floor(f / fps);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
}

/** `mm:ss` — rótulos da régua e badges de duração. */
export function formatShort(frames: number, fps: number): string {
  const s = Math.floor(Math.max(0, frames) / fps);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
