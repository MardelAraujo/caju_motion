/**
 * Aleatório DETERMINÍSTICO: mesma semente → mesmo número, em qualquer máquina.
 * Use no lugar de Math.random (proibido pela lint em core/renderer).
 */

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Número em [0, 1) derivado da semente. */
export function random(seed: string | number): number {
  return mulberry32(typeof seed === 'number' ? seed >>> 0 : fnv1a(seed));
}

/** Número em [min, max) derivado da semente. */
export function randomRange(seed: string | number, min: number, max: number): number {
  return min + random(seed) * (max - min);
}
