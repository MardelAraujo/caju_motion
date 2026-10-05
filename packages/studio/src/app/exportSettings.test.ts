import { describe, expect, it } from 'vitest';
import { defaultExportSettings, estimateBytes, outputSize } from './exportSettings';

describe('exportSettings', () => {
  it('escala pelo lado menor e mantém dimensões pares', () => {
    expect(outputSize({ width: 1920, height: 1080 }, 720)).toEqual({ width: 1280, height: 720 });
    expect(outputSize({ width: 1080, height: 1920 }, 2160)).toEqual({ width: 2160, height: 3840 });
    expect(outputSize({ width: 1080, height: 1350 }, 720).height % 2).toBe(0);
  });

  it('padrão usa a resolução nativa do projeto', () => {
    expect(defaultExportSettings({ width: 1920, height: 1080, fps: 30 })).toMatchObject({ resolution: 1080, fps: 30 });
    expect(defaultExportSettings({ width: 600, height: 600, fps: 24 }).resolution).toBe(720);
  });

  it('HEVC estima arquivo menor que H.264', () => {
    const p = { width: 1920, height: 1080 };
    const base = defaultExportSettings({ ...p, fps: 30 });
    expect(estimateBytes({ ...base, format: 'mp4-h265' }, p, 10)).toBeLessThan(estimateBytes(base, p, 10));
  });
});
