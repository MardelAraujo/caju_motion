import { describe, expect, it } from 'vitest';
import { defaultExportSettings, type ExportSettings } from '@caju-motion/schema';
import { buildEncodeArgs } from './ffmpeg';
import { outputFrameCount, projectFrameFor } from './frames';

const base = (p: Partial<ExportSettings> = {}): ExportSettings => ({
  ...defaultExportSettings({ width: 1920, height: 1080, fps: 30 }),
  ...p,
});
const mix = { inputs: ['/p/a.wav'], filterComplex: '[1:a]anull[a0];[a0]apad[mix]', outputLabel: 'mix', durationSec: 3 };

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('buildEncodeArgs', () => {
  it('H.264: quadros JPEG por stdin, escala exata, CRF, yuv420p, faststart e AAC', () => {
    const a = buildEncodeArgs({ settings: base({ quality: 'high' }), width: 1280, height: 720, lossless: false, audio: mix, output: 'out.mp4' });
    expect(a.slice(a.indexOf('-f'), a.indexOf('-f') + 8)).toEqual(['-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', 'pipe:0']);
    expect(a).toContain('/p/a.wav');
    expect(after(a, '-filter_complex')).toBe('[0:v]scale=1280:720:flags=lanczos,setsar=1[v];[1:a]anull[a0];[a0]apad[mix]');
    expect(a).toEqual(expect.arrayContaining(['-map', '[v]', '-map', '[mix]', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac']));
    expect(a.at(-1)).toBe('out.mp4');
  });

  it('sem áudio (pedido ou mixagem vazia) não mapeia áudio', () => {
    for (const a of [
      buildEncodeArgs({ settings: base({ audio: false }), width: 2, height: 2, lossless: false, audio: mix, output: 'o.mp4' }),
      buildEncodeArgs({ settings: base(), width: 2, height: 2, lossless: false, audio: null, output: 'o.mp4' }),
    ]) {
      expect(a).not.toContain('[mix]');
      expect(a).not.toContain('/p/a.wav');
      expect(a).not.toContain('-c:a');
    }
  });

  it('codecs por formato', () => {
    const args = (format: ExportSettings['format']) =>
      buildEncodeArgs({ settings: base({ format, quality: 'good' }), width: 2, height: 2, lossless: true, audio: mix, output: 'o' });
    expect(args('mp4-h265')).toEqual(expect.arrayContaining(['libx265', '-crf', '28', '-tag:v', 'hvc1']));
    expect(args('webm-vp9')).toEqual(expect.arrayContaining(['libvpx-vp9', '-crf', '34', '-b:v', '0', 'libopus']));
    expect(args('mov-prores')).toEqual(expect.arrayContaining(['prores_ks', 'yuv422p10le', 'pcm_s16le']));
    const gif = args('gif');
    expect(after(gif, '-filter_complex')).toContain('palettegen');
    expect(gif).not.toContain('[mix]'); // GIF não tem áudio
    const png = args('png-seq');
    expect(png.at(-1)).toBe('o/frame-%05d.png');
    expect(png).not.toContain('[mix]');
  });

  it('entrada PNG quando lossless', () => {
    const a = buildEncodeArgs({ settings: base({ format: 'mov-prores' }), width: 2, height: 2, lossless: true, audio: null, output: 'o.mov' });
    expect(a.slice(a.indexOf('image2pipe') - 1, a.indexOf('pipe:0') + 1)).toContain('png');
  });
});

describe('frames', () => {
  it('mesmo fps: um para um', () => {
    expect(outputFrameCount(90, 30, 30)).toBe(90);
    expect([0, 1, 89].map((j) => projectFrameFor(j, 90, 30, 30))).toEqual([0, 1, 89]);
  });
  it('fps maior repete, menor pula; nunca passa do último quadro', () => {
    expect(outputFrameCount(90, 30, 60)).toBe(180);
    expect([0, 1, 2, 179].map((j) => projectFrameFor(j, 90, 30, 60))).toEqual([0, 0, 1, 89]);
    expect(outputFrameCount(90, 30, 24)).toBe(72);
    expect([0, 1, 4, 71].map((j) => projectFrameFor(j, 90, 30, 24))).toEqual([0, 1, 5, 88]);
    expect(outputFrameCount(0, 30, 30)).toBe(0);
  });
});
