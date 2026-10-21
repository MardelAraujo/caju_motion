import { describe, expect, it } from 'vitest';
import { parseProject, type ProjectInput } from '@caju-motion/schema';
import { atempoChain, buildAudioMix, clipFilters, panFilter } from './index';

function project(tracks: ProjectInput['tracks'], assets: ProjectInput['assets'] = [], duration = 90) {
  return parseProject({
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    settings: { width: 1920, height: 1080, fps: 30, duration },
    assets,
    tracks,
  });
}

const assets: ProjectInput['assets'] = [
  { id: 'music', kind: 'audio', src: 'assets/music.mp3' },
  { id: 'vo', kind: 'audio', src: 'assets/vo.wav' },
  { id: 'cam', kind: 'video', src: 'assets/cam.mp4', meta: { hasAudio: true } },
  { id: 'silent', kind: 'video', src: 'assets/silent.mp4', meta: { hasAudio: false } },
];

describe('atempo / pan', () => {
  it('quebra velocidades fora de 0.5–2 em estágios', () => {
    expect(atempoChain(1)).toEqual([]);
    expect(atempoChain(1.5)).toEqual(['atempo=1.5']);
    expect(atempoChain(4)).toEqual(['atempo=2', 'atempo=2']);
    expect(atempoChain(5)).toEqual(['atempo=2', 'atempo=2', 'atempo=1.25']);
    expect(atempoChain(0.25)).toEqual(['atempo=0.5', 'atempo=0.5']);
    expect(atempoChain(0.3)).toEqual(['atempo=0.5', 'atempo=0.6']);
  });

  it('pan é balanço estéreo', () => {
    expect(panFilter(0)).toBeNull();
    expect(panFilter(-1)).toBe('pan=stereo|c0=1*c0|c1=0*c1');
    expect(panFilter(0.25)).toBe('pan=stereo|c0=0.75*c0|c1=1*c1');
  });
});

describe('clipFilters', () => {
  it('corte, velocidade, volume, fades, pan e atraso', () => {
    const f = clipFilters(
      { start: 45, duration: 60, trimIn: 30, speed: 2, audio: { volume: 0.5, fadeIn: 15, fadeOut: 30, pan: -0.5 } },
      30,
    );
    expect(f).toEqual([
      'atrim=start=1:end=5', // 30 frames de corte = 1 s; consome 60 * 2 = 120 frames de origem
      'asetpts=PTS-STARTPTS',
      'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo',
      'atempo=2',
      'volume=0.5',
      'afade=t=in:st=0:d=0.5',
      'afade=t=out:st=1:d=1',
      'pan=stereo|c0=1*c0|c1=0.5*c1',
      'adelay=72000S:all=1', // 45 frames a 30 fps = 1,5 s = 72000 amostras
    ]);
  });

  it('clipe no início, sem ajustes: sem filtros extras', () => {
    expect(clipFilters({ start: 0, duration: 30, trimIn: 0, speed: 1, audio: undefined }, 30)).toEqual([
      'atrim=start=0:end=1',
      'asetpts=PTS-STARTPTS',
      'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo',
    ]);
  });
});

describe('buildAudioMix', () => {
  it('sem áudio → null', () => {
    expect(buildAudioMix(project([]), { projectDir: '/p' })).toBeNull();
    const muted = project(
      [{ id: 'a', kind: 'audio', muted: true, clips: [{ id: 'c', type: 'audio', assetId: 'music', start: 0, duration: 30 }] }],
      assets,
    );
    expect(buildAudioMix(muted, { projectDir: '/p' })).toBeNull();
  });

  it('um clipe: apad + atrim na duração do projeto', () => {
    const p = project(
      [{ id: 'a', kind: 'audio', clips: [{ id: 'c', type: 'audio', assetId: 'vo', start: 30, duration: 30 }] }],
      assets,
      60,
    );
    const mix = buildAudioMix(p, { projectDir: 'C:\\proj\\' })!;
    expect(mix.inputs).toEqual(['C:\\proj/assets/vo.wav']);
    expect(mix.durationSec).toBe(2);
    expect(mix.outputLabel).toBe('mix');
    expect(mix.filterComplex).toBe(
      '[0:a]atrim=start=0:end=1,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=48000S:all=1[a0];' +
        '[a0]apad,atrim=end=2,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[mix]',
    );
  });

  it('vários clipes: amix sem normalizar; respeita mudo/oculto, hasAudio e includeVideoAudio', () => {
    const p = project(
      [
        {
          id: 'v',
          kind: 'main',
          clips: [
            { id: 'c-cam', type: 'video', assetId: 'cam', start: 0, duration: 30 },
            { id: 'c-silent', type: 'video', assetId: 'silent', start: 30, duration: 30 },
          ],
        },
        { id: 'hidden', kind: 'audio', hidden: true, clips: [{ id: 'h', type: 'audio', assetId: 'vo', start: 0, duration: 30 }] },
        {
          id: 'a',
          kind: 'audio',
          clips: [
            { id: 'm', type: 'audio', assetId: 'music', start: 0, duration: 90 },
            { id: 'zero', type: 'audio', assetId: 'vo', start: 100, duration: 30 }, // depois do fim
          ],
        },
      ],
      assets,
    );
    const mix = buildAudioMix(p, { projectDir: '/proj' })!;
    expect(mix.inputs).toEqual(['/proj/assets/cam.mp4', '/proj/assets/music.mp3']);
    expect(mix.filterComplex).toContain('[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,apad,atrim=end=3,');
    expect(mix.filterComplex.endsWith('[mix]')).toBe(true);

    const noVideo = buildAudioMix(p, { projectDir: '/proj', includeVideoAudio: false })!;
    expect(noVideo.inputs).toEqual(['/proj/assets/music.mp3']);
  });

  it('volume zero não entra na mixagem', () => {
    const p = project(
      [{ id: 'a', kind: 'audio', clips: [{ id: 'c', type: 'audio', assetId: 'vo', start: 0, duration: 30, audio: { volume: 0 } }] }],
      assets,
    );
    expect(buildAudioMix(p, { projectDir: '/p' })).toBeNull();
  });

  it('inputOffset desloca os índices das entradas (vídeo é a entrada 0 no export)', () => {
    const p = project(
      [{ id: 't', kind: 'audio', clips: [{ id: 'a', type: 'audio', assetId: 'vo', start: 0, duration: 30 }] }],
      assets,
    );
    const mix = buildAudioMix(p, { projectDir: '/p', inputOffset: 1 })!;
    expect(mix.filterComplex.startsWith('[1:a]')).toBe(true);
    expect(mix.filterComplex).not.toContain('[0:a]');
  });
});

describe('volume por keyframes, ducking e loudness', () => {
  it('volumeExpression: rampa linear, hold e pontas', async () => {
    const { volumeExpression } = await import('./index');
    expect(volumeExpression([], 30)).toBeNull();
    expect(volumeExpression([{ frame: 0, value: 1 }, { frame: 30, value: 0.5 }], 30)).toBe('if(lt(t,0),1,if(lt(t,1),1+-0.5*(t-0)/1,0.5))');
    expect(volumeExpression([{ frame: 30, value: 0.2, easing: 'hold' }, { frame: 60, value: 1 }], 30)).toBe('if(lt(t,1),0.2,if(lt(t,2),0.2,1))');
    const f = clipFilters(
      { start: 0, duration: 60, trimIn: 0, speed: 1, audio: { volume: 0, fadeIn: 0, fadeOut: 0, pan: 0 }, keyframes: { 'audio.volume': [{ frame: 0, value: 0, easing: 'linear' }, { frame: 30, value: 1, easing: 'linear' }] } },
      30,
    );
    expect(f).toContain("volume='if(lt(t,0),0,if(lt(t,1),0+1*(t-0)/1,1))':eval=frame");
  });

  it('ducking: a voz comanda o compressor da música; efeitos e vídeo ficam de fora', () => {
    const p = project(
      [
        { id: 'voz', kind: 'audio', role: 'voice', clips: [{ id: 'v1', type: 'audio', assetId: 'vo', start: 0, duration: 60 }] },
        { id: 'bg', kind: 'audio', clips: [{ id: 'm1', type: 'audio', assetId: 'music', start: 0, duration: 90 }] },
        { id: 'fx', kind: 'audio', role: 'sfx', clips: [{ id: 's1', type: 'audio', assetId: 'music', start: 0, duration: 10 }] },
      ],
      assets,
    );
    p.settings.audio = { ducking: { enabled: true, ratio: 8, threshold: 0.03, attackMs: 20, releaseMs: 400 } };
    const mix = buildAudioMix(p, { projectDir: '/p' })!;
    expect(mix.filterComplex).toContain('[a0]anull,apad,atrim=end=3[voicebus];[voicebus]asplit=2[voice][sidechain]');
    expect(mix.filterComplex).toContain('[a1]anull,apad,atrim=end=3[musicbus]');
    expect(mix.filterComplex).toContain('[musicbus][sidechain]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[ducked]');
    expect(mix.filterComplex).toContain('[voice][ducked][a2]amix=inputs=3');
  });

  it('sem voz (ou sem música), ducking não muda nada; trilha "Locução" sem papel conta como voz', async () => {
    const { trackBus } = await import('./index');
    expect(trackBus({ kind: 'audio', name: 'Locução' }, { type: 'audio' })).toBe('voice');
    expect(trackBus({ kind: 'audio', name: 'Trilha' }, { type: 'audio' })).toBe('music');
    expect(trackBus({ kind: 'main' }, { type: 'video' })).toBe('other');
    const p = project([{ id: 'bg', kind: 'audio', clips: [{ id: 'm1', type: 'audio', assetId: 'music', start: 0, duration: 90 }] }], assets);
    p.settings.audio = { ducking: { enabled: true, ratio: 6, threshold: 0.03, attackMs: 20, releaseMs: 400 } };
    expect(buildAudioMix(p, { projectDir: '/p' })!.filterComplex).not.toContain('sidechaincompress');
  });

  it('loudness: loudnorm + reamostragem no fim', () => {
    const p = project([{ id: 'bg', kind: 'audio', clips: [{ id: 'm1', type: 'audio', assetId: 'music', start: 0, duration: 90 }] }], assets);
    p.settings.audio = { loudness: { enabled: true, targetLufs: -16, truePeakDb: -1.5 } };
    expect(buildAudioMix(p, { projectDir: '/p' })!.filterComplex).toContain('loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=');
  });
});
