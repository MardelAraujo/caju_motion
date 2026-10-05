/** Conversões de cor usadas pelo seletor (hex ⇄ RGBA ⇄ HSV). */

export type RGBA = { r: number; g: number; b: number; a: number };
export type HSV = { h: number; s: number; v: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

/** Aceita #rgb, #rgba, #rrggbb e #rrggbbaa. Retorna null se não for hex. */
export function parseHex(input: string): RGBA | null {
  let h = input.trim().replace(/^#/, '');
  if (!/^[0-9a-f]+$/i.test(h) || ![3, 4, 6, 8].includes(h.length)) return null;
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

/** #RRGGBB quando opaco, #RRGGBBAA quando há transparência. */
export function toHex({ r, g, b, a }: RGBA): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
  return a >= 1 ? base : `${base}${hex2(a * 255)}`.toUpperCase();
}

export function rgbToHsv({ r, g, b }: RGBA): HSV {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const d = max - Math.min(rr, gg, bb);
  let h = 0;
  if (d) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: HSV, a = 1): RGBA {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: Math.round(f(5)), g: Math.round(f(3)), b: Math.round(f(1)), a };
}
