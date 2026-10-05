import { describe, expect, it } from 'vitest';
import { hsvToRgb, parseHex, rgbToHsv, toHex } from './color';

describe('color', () => {
  it('lê hex curto, longo e com alfa', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseHex('F6B73C')).toEqual({ r: 246, g: 183, b: 60, a: 1 });
    expect(parseHex('#00000080')?.a).toBeCloseTo(128 / 255);
    expect(parseHex('red')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
  });

  it('só escreve alfa quando há transparência', () => {
    expect(toHex({ r: 246, g: 183, b: 60, a: 1 })).toBe('#F6B73C');
    expect(toHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
  });

  it('ida e volta RGB ⇄ HSV', () => {
    for (const hex of ['#F6B73C', '#E94B35', '#FFFFFF', '#000000', '#3A7BD5']) {
      const rgb = parseHex(hex)!;
      expect(toHex(hsvToRgb(rgbToHsv(rgb)))).toBe(hex);
    }
  });
});
