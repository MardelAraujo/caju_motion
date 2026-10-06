import { describe, expect, it } from 'vitest';
import {
  crfFor,
  defaultExportSettings,
  estimateBytes,
  exportHasAudio,
  outputSize,
  parseExportSettings,
} from './index';

describe('export-settings', () => {
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

  it('CRF por codec', () => {
    expect(crfFor('mp4-h264', 'high')).toBe(18);
    expect(crfFor('mp4-h265', 'high')).toBe(23);
    expect(crfFor('webm-vp9', 'draft')).toBeGreaterThan(crfFor('webm-vp9', 'max')!);
    expect(crfFor('mov-prores', 'high')).toBeNull();
    expect(crfFor('gif', 'high')).toBeNull();
  });

  it('áudio só em formatos que aceitam', () => {
    expect(exportHasAudio({ format: 'mp4-h264', audio: true })).toBe(true);
    expect(exportHasAudio({ format: 'mp4-h264', audio: false })).toBe(false);
    expect(exportHasAudio({ format: 'gif', audio: true })).toBe(false);
  });

  it('valida configurações vindas de fora', () => {
    const p = { width: 1080, height: 1920, fps: 30 };
    expect(parseExportSettings(undefined, p)).toEqual(defaultExportSettings(p));
    expect(parseExportSettings({ format: 'webm-vp9', resolution: '720', fps: 24, audio: false }, p)).toMatchObject({
      format: 'webm-vp9',
      resolution: 720,
      fps: 24,
      quality: 'high',
      audio: false,
    });
    expect(() => parseExportSettings({ format: 'avi' }, p)).toThrow(/formato inválido/);
    expect(() => parseExportSettings({ resolution: 999 }, p)).toThrow(/resolução inválida/);
    expect(() => parseExportSettings({ fps: 0 }, p)).toThrow(/fps inválido/);
    expect(() => parseExportSettings({ quality: 'ultra' }, p)).toThrow(/qualidade inválida/);
    expect(() => parseExportSettings('x', p)).toThrow();
  });
});
