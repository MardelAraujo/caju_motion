/** Cores hex (#rgb, #rrggbb, #rrggbbaa) → RGBA e mistura linear entre elas. */

export type Rgba = { r: number; g: number; b: number; a: number };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

export function parseHex(value: string): Rgba {
  const m = HEX.exec(value);
  if (!m) throw new Error(`cor inválida: "${value}" (use #rgb, #rrggbb ou #rrggbbaa)`);
  let hex = m[1]!;
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
}

export function toHex({ r, g, b, a }: Rgba): string {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a >= 1 ? base : base + h(a * 255);
}

export function mixColors(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  });
}
