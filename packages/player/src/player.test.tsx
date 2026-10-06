import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useFrame } from '@caju-motion/core';
import { createEmptyProject } from '@caju-motion/schema';
import { advance, fitScale, formatTime, resolveRange } from './clock';
import { defineComponent, Player } from './index';

/** Reel 9:16 a 30 fps, 90 frames: um texto, um componente e uma trilha de áudio. */
function rawProject() {
  const p = createEmptyProject({ id: 'p', name: 'p', format: 'reel-9x16', now: '2030-01-01T00:00:00.000Z' });
  return {
    ...p,
    assets: [{ id: 'a1', kind: 'audio', src: 'audio/vo/locução 1.mp3', name: 'vo' }],
    tracks: [
      {
        id: 't1',
        kind: 'text',
        clips: [{ id: 'c1', type: 'text', start: 0, duration: 90, props: { text: 'Olá player' } }],
      },
      {
        id: 't2',
        kind: 'overlay',
        clips: [{ id: 'c2', type: 'component', start: 30, duration: 60, props: { component: 'FrameNumber' } }],
      },
      { id: 't3', kind: 'audio', clips: [{ id: 'c3', type: 'audio', assetId: 'a1', start: 0, duration: 90 }] },
    ],
  };
}

const FrameNumber = defineComponent({
  name: 'FrameNumber',
  component: () => <span>{`frame-${useFrame()}`}</span>,
});

describe('clock', () => {
  it('resolveRange limita a faixa ao vídeo', () => {
    expect(resolveRange(90)).toEqual({ inFrame: 0, outFrame: 89 });
    expect(resolveRange(90, 10, 40)).toEqual({ inFrame: 10, outFrame: 40 });
    expect(resolveRange(90, -5, 500)).toEqual({ inFrame: 0, outFrame: 89 });
    expect(resolveRange(90, 50, 20)).toEqual({ inFrame: 50, outFrame: 50 });
    expect(resolveRange(0)).toEqual({ inFrame: 0, outFrame: 0 });
  });

  it('advance converte tempo real em frames inteiros', () => {
    const base = { inFrame: 0, outFrame: 89, fps: 30, rate: 1, loop: false };
    expect(advance({ ...base, startFrame: 0, elapsedMs: 0 })).toEqual({ frame: 0, ended: false });
    expect(advance({ ...base, startFrame: 0, elapsedMs: 1000 })).toEqual({ frame: 30, ended: false });
    expect(advance({ ...base, startFrame: 10, elapsedMs: 999 })).toEqual({ frame: 39, ended: false });
    expect(advance({ ...base, startFrame: 0, elapsedMs: 500, rate: 2 })).toEqual({ frame: 30, ended: false });
  });

  it('advance para no fim sem loop e dá a volta com loop', () => {
    const base = { inFrame: 10, outFrame: 19, fps: 10, rate: 1, startFrame: 10 };
    expect(advance({ ...base, loop: false, elapsedMs: 5000 })).toEqual({ frame: 19, ended: true });
    expect(advance({ ...base, loop: true, elapsedMs: 1000 })).toEqual({ frame: 10, ended: false });
    expect(advance({ ...base, loop: true, elapsedMs: 1500 })).toEqual({ frame: 15, ended: false });
  });

  it('fitScale encaixa (contain) e centraliza', () => {
    expect(fitScale({ width: 540, height: 960 }, { width: 1080, height: 1920 })).toEqual({ scale: 0.5, left: 0, top: 0 });
    expect(fitScale({ width: 1000, height: 960 }, { width: 1080, height: 1920 })).toEqual({ scale: 0.5, left: 230, top: 0 });
    expect(fitScale({ width: 0, height: 0 }, { width: 1080, height: 1920 }).scale).toBe(0);
  });

  it('formatTime', () => {
    expect(formatTime(0, 30)).toBe('0:00');
    expect(formatTime(95, 30)).toBe('0:03');
    expect(formatTime(30 * 3725, 30)).toBe('1:02:05');
  });
});

describe('<Player>', () => {
  it('desenha o quadro inicial com componentes, áudio e controles', () => {
    const html = renderToStaticMarkup(
      <Player project={rawProject()} components={[FrameNumber]} initialFrame={45} controls assetBase="/media/p/" />,
    );
    expect(html).toContain('Olá player');
    expect(html).toContain('frame-15'); // componente começa no frame 30
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain('0:01 / 0:03');
    expect(html).toContain('src="/media/p/audio/vo/locu%C3%A7%C3%A3o%201.mp3"');
    expect(html).toContain('aspect-ratio:0.5625');
  });

  it('respeita a faixa inFrame/outFrame e resolveAsset', () => {
    const html = renderToStaticMarkup(
      <Player
        project={rawProject()}
        components={[FrameNumber]}
        inFrame={60}
        outFrame={89}
        initialFrame={5}
        controls
        resolveAsset={(a) => `https://cdn.example/${a.id}`}
      />,
    );
    expect(html).toContain('frame-30'); // initialFrame fora da faixa → início da faixa (60)
    expect(html).toContain('min="60"');
    expect(html).toContain('max="89"');
    expect(html).toContain('0:00 / 0:01');
    expect(html).toContain('src="https://cdn.example/a1"');
  });

  it('URLs absolutas não recebem o assetBase; trilha de áudio oculta não toca (como no export)', () => {
    const raw = rawProject() as ReturnType<typeof rawProject> & { tracks: unknown[]; assets: unknown[] };
    raw.assets.push({ id: 'a2', kind: 'audio', src: 'https://cdn.example/musica.mp3', name: 'm' });
    raw.tracks.push({ id: 't4', kind: 'audio', clips: [{ id: 'c4', type: 'audio', assetId: 'a2', start: 0, duration: 90 }] });
    raw.tracks.push({ id: 't5', kind: 'audio', hidden: true, clips: [{ id: 'c5', type: 'audio', assetId: 'a1', start: 0, duration: 90 }] });
    const html = renderToStaticMarkup(<Player project={raw} assetBase="/media/p/" />);
    expect(html).toContain('src="https://cdn.example/musica.mp3"');
    expect(html.match(/<audio /g)).toHaveLength(2); // t3 e t4; a t5 está oculta
  });

  it('sem controles por padrão', () => {
    const html = renderToStaticMarkup(<Player project={rawProject()} components={[FrameNumber]} />);
    expect(html).not.toContain('aria-label="Play"');
    expect(html).toContain('tabindex="0"');
  });

  it('projeto inválido mostra o erro do schema em vez de quebrar', () => {
    const html = renderToStaticMarkup(<Player project={{ schemaVersion: 1, settings: 'x' }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('invalid project');
    const newer = renderToStaticMarkup(<Player project={{ ...rawProject(), schemaVersion: 99 }} />);
    expect(newer).toContain('versão mais nova');
  });
});
