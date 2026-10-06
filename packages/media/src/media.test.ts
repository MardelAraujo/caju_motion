import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmptyProject, ProjectSchema, type Project } from '@caju-motion/schema';
import {
  analyzeProject,
  createProxy,
  findDerived,
  hashFile,
  needsProxy,
  parseFfmpegHeader,
  peaksOf,
  probeMedia,
  runFfmpegOk,
  svgSize,
  thumbnail,
  waveform,
} from './index';

let dir: string;
const f = (name: string) => path.join(dir, name);

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'caju-media-'));
  // 2 s de vídeo 640×360 a 30 fps com tom de 440 Hz; 1 s de áudio puro; uma imagem e um SVG
  await runFfmpegOk([
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', f('clip.mp4'),
  ]);
  await runFfmpegOk(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', '-y', f('tone.wav')]);
  await runFfmpegOk(['-f', 'lavfi', '-i', 'color=c=red:size=320x200', '-frames:v', '1', '-y', f('red.png')]);
  writeFileSync(f('logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40"/></svg>');
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('probeMedia', () => {
  it('vídeo com áudio', async () => {
    const info = await probeMedia(f('clip.mp4'));
    expect(info).toMatchObject({ kind: 'video', width: 640, height: 360, fps: 30, hasAudio: true, hasVideo: true, videoCodec: 'h264', audioCodec: 'aac' });
    expect(info.durationSec).toBeCloseTo(2, 1);
  });

  it('áudio, imagem e SVG', async () => {
    expect(await probeMedia(f('tone.wav'))).toMatchObject({ kind: 'audio', hasAudio: true, hasVideo: false, sampleRate: 44100 });
    expect((await probeMedia(f('tone.wav'))).durationSec).toBeCloseTo(1, 2);
    expect(await probeMedia(f('red.png'))).toEqual({ kind: 'image', hasAudio: false, hasVideo: false, width: 320, height: 200 });
    expect(await probeMedia(f('logo.svg'))).toMatchObject({ kind: 'image', width: 120, height: 40 });
  });

  it('erros legíveis', async () => {
    await expect(probeMedia(f('nada.mp4'))).rejects.toThrow(/não encontrado/);
    writeFileSync(f('lixo.mp4'), 'isto não é vídeo');
    await expect(probeMedia(f('lixo.mp4'))).rejects.toThrow(/não foi possível ler/);
  });

  it('parseFfmpegHeader: rotação de celular troca largura e altura; capa de mp3 não é vídeo', () => {
    const phone = [
      "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'a.mov':",
      '  Duration: 00:00:10.50, start: 0.000000, bitrate: 9000 kb/s',
      '  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p(tv), 1920x1080, 8000 kb/s, 29.97 fps, 29.97 tbr, 600 tbn (default)',
      '      Side data:',
      '        displaymatrix: rotation of -90.00 degrees',
      '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 192 kb/s (default)',
    ].join('\n');
    expect(parseFfmpegHeader(phone)).toMatchObject({ width: 1080, height: 1920, rotation: 270, fps: 29.97, videoCodec: 'hevc', durationSec: 10.5 });
    const mp3 = [
      "Input #0, mp3, from 'a.mp3':",
      '  Duration: 00:03:00.00, start: 0.025057, bitrate: 320 kb/s',
      '  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 320 kb/s',
      '  Stream #0:1: Video: mjpeg (Baseline), yuvj420p(pc), 500x500, 90k tbr, 90k tbn (attached pic)',
    ].join('\n');
    expect(parseFfmpegHeader(mp3)).toMatchObject({ kind: 'audio', hasVideo: false, durationSec: 180 });
    expect(parseFfmpegHeader('lixo')).toBeNull();
    expect(svgSize('<svg width="300px" height="150" viewBox="0 0 10 10">')).toEqual({ width: 300, height: 150 });
  });
});

describe('derivados', () => {
  it('hash, miniatura e forma de onda', async () => {
    expect(await hashFile(f('logo.svg'))).toMatch(/^[0-9a-f]{64}$/);
    const thumb = await thumbnail(f('clip.mp4'), { out: f('out/thumb.jpg'), width: 160 });
    expect((await probeMedia(thumb)).width).toBe(160);
    expect((await probeMedia(thumb)).height).toBe(90);

    const w = await waveform(f('tone.wav'));
    expect(w.perSecond).toBe(100);
    expect(w.peaks.length).toBe(100);
    expect(Math.min(...w.peaks.slice(5, 95))).toBeCloseTo(0.125, 2); // tom constante (amplitude padrão do sine: 1/8)
    expect(peaksOf(new Float32Array([0, -0.5, 0.25, 0, 1, 0]), 2, 1)).toEqual({ perSecond: 1, durationSec: 3, peaks: [0.5, 0.25, 1] });
  }, 60_000);

  it('proxy: menor, mesmo tempo, quadros-chave frequentes', async () => {
    const out = await createProxy(f('clip.mp4'), { out: f('out/proxy.mp4'), height: 180, keyint: 10 });
    const info = await probeMedia(out);
    expect(info).toMatchObject({ width: 320, height: 180, videoCodec: 'h264', hasAudio: true });
    expect(info.durationSec).toBeCloseTo(2, 1);
    // nenhum arquivo temporário sobrando
    expect(existsSync(f('out/proxy.tmp-' + process.pid + '.mp4'))).toBe(false);
    await expect(createProxy(f('tone.wav'), { out: f('out/x.mp4') })).rejects.toThrow(/não tem vídeo/);
  }, 60_000);

  it('needsProxy', () => {
    const base = { kind: 'video' as const, hasAudio: false, hasVideo: true };
    expect(needsProxy({ ...base, height: 2160, videoCodec: 'h264' }, 'auto')).toBe(true);
    expect(needsProxy({ ...base, height: 720, videoCodec: 'h264' }, 'auto')).toBe(false);
    expect(needsProxy({ ...base, height: 720, videoCodec: 'hevc' }, 'auto')).toBe(true);
    expect(needsProxy({ ...base, height: 360, videoCodec: 'h264' }, 'all')).toBe(true);
    expect(needsProxy({ ...base, height: 2160 }, false)).toBe(false);
  });
});

describe('analyzeProject', () => {
  function project(): Project {
    const p = createEmptyProject({ id: 'p', format: 'reel-9x16' });
    return ProjectSchema.parse({
      ...p,
      assets: [
        { id: 'v', kind: 'video', src: 'assets/clip.mp4' },
        { id: 'a', kind: 'audio', src: 'assets/tone.wav', meta: { durationSec: 9 } },
        { id: 'i', kind: 'image', src: 'assets/red.png' },
        { id: 's', kind: 'image', src: 'assets/logo.svg' },
        { id: 'x', kind: 'image', src: 'assets/sumiu.png' },
        { id: 'r', kind: 'image', src: 'https://cdn.example/a.png' },
      ],
    });
  }

  it('preenche meta/hash, gera derivados e reaproveita o cache', async () => {
    const root = f('proj');
    mkdirSync(path.join(root, 'assets'), { recursive: true });
    for (const n of ['clip.mp4', 'tone.wav', 'red.png', 'logo.svg']) copyFileSync(f(n), path.join(root, 'assets', n));
    const { project: out, reports } = await analyzeProject(root, project(), { proxies: 'all', proxyHeight: 180 });
    const byId = Object.fromEntries(reports.map((r) => [r.id, r]));
    expect(byId.x!.status).toBe('missing');
    expect(byId.r!.status).toBe('skipped');
    for (const id of ['v', 'a', 'i', 's']) expect(byId[id]!.status, byId[id]!.error).toBe('ok');

    const v = out.assets.find((a) => a.id === 'v')!;
    expect(v.meta).toMatchObject({ width: 640, height: 360, fps: 30, hasAudio: true });
    expect(v.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(out.assets.find((a) => a.id === 'a')!.meta.durationSec).toBeCloseTo(1, 2); // corrige o 9 errado
    expect(out.assets.find((a) => a.id === 's')!.meta).toMatchObject({ width: 120, height: 40 });
    expect(ProjectSchema.safeParse(out).success).toBe(true);

    expect(Object.keys(byId.v!.derived).sort()).toEqual(['peaks', 'proxy', 'thumb']);
    expect(Object.keys(byId.a!.derived)).toEqual(['peaks']);
    expect(await findDerived(root, 'assets/clip.mp4', 'proxy')).toBe(byId.v!.derived.proxy);
    expect(await findDerived(root, 'assets/clip.mp4', 'thumb')).toBeTruthy();
    expect(await findDerived(root, 'assets/tone.wav', 'proxy')).toBeNull();

    // segunda vez: nada muda e nada é refeito
    const mtime = statSync(byId.v!.derived.proxy!).mtimeMs;
    const again = await analyzeProject(root, out, { proxies: 'all', proxyHeight: 180 });
    expect(again.reports.flatMap((r) => r.changed)).toEqual([]);
    expect(statSync(byId.v!.derived.proxy!).mtimeMs).toBe(mtime);

    // arquivo alterado: o derivado antigo deixa de valer
    const clip = path.join(root, 'assets', 'clip.mp4');
    utimesSync(clip, new Date(), new Date(Date.now() + 5000));
    expect(await findDerived(root, 'assets/clip.mp4', 'proxy')).toBeNull();
  }, 120_000);
});
