import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClipSchema, createEmptyProject, ProjectSchema, type Clip } from '@caju-motion/schema';
import { clipMotion, effectsFilter, motionCss, poseByName } from './motion';
import { ProjectRenderer } from './ProjectRenderer';

const F = { width: 1080, height: 1920 };
const clip = (over: Record<string, unknown>): Clip =>
  ClipSchema.parse({ id: 'c', type: 'text', start: 10, duration: 40, props: { text: 'Oi' }, ...over });

describe('movimento de clipe', () => {
  it('entrada: começa fora de cena e termina em repouso; fora da janela não mexe', () => {
    const c = clip({ transitionIn: { type: 'fade', duration: 10, easing: 'linear' } });
    expect(clipMotion(c, 10, F).opacity).toBe(0);
    expect(clipMotion(c, 15, F).opacity).toBeCloseTo(0.5);
    expect(clipMotion(c, 20, F)).toMatchObject({ opacity: 1, x: 0, y: 0, scale: 1 });
  });

  it('saída espelha a entrada: mesmo lado, chega a zero no último frame', () => {
    const c = clip({ transitionOut: { type: 'slide', duration: 10, easing: 'linear', params: { direction: 'right' } } });
    expect(clipMotion(c, 39, F).x).toBe(0);
    const mid = clipMotion(c, 44, F).x;
    expect(mid).toBeGreaterThan(0); // sai pela direita
    expect(clipMotion(c, 49, F).x).toBe(F.width); // último frame: fora do quadro
  });

  it('slide sem distância usa o quadro inteiro na direção; rise/zoom/pop compõem com fade', () => {
    const up = clipMotion(clip({ animationIn: { preset: 'slide', duration: 10, params: { direction: 'up', easing: 'linear' } } }), 10, F);
    expect(up.y).toBe(-F.height);
    const rise = clipMotion(clip({ animationIn: { preset: 'rise', duration: 10, params: { easing: 'linear' } } }), 15, F);
    expect(rise.y).toBeCloseTo(40);
    expect(rise.opacity).toBeCloseTo(0.5);
    const both = clipMotion(clip({ transitionIn: { type: 'zoom', duration: 10 }, animationIn: { preset: 'blur', duration: 10 } }), 10, F);
    expect(both.opacity).toBe(0);
    expect(both.blur).toBe(24);
    expect(poseByName('push')).toBe(poseByName('slide'));
  });

  it('wipe e íris recortam; loop é função do tempo', () => {
    expect(clipMotion(clip({ transitionIn: { type: 'wipe', duration: 10, easing: 'linear' } }), 15, F).clipPath).toBe('inset(0 50.000% 0 0)');
    expect(clipMotion(clip({ transitionIn: { type: 'iris', duration: 10, easing: 'linear' } }), 20, F).clipPath).toBeUndefined();
    const float = clip({ animationLoop: { preset: 'float', duration: 40, params: { amplitude: 2 } } });
    expect(clipMotion(float, 10, F).y).toBeCloseTo(0);
    expect(clipMotion(float, 20, F).y).toBeCloseTo(24); // 1/4 do período: pico
  });

  it('tipo desconhecido não quebra (repouso)', () => {
    expect(clipMotion(clip({ transitionIn: { type: 'nao-existe', duration: 5 } }), 10, F)).toMatchObject({ opacity: 1, x: 0 });
  });

  it('motionCss: só o que mudou', () => {
    expect(motionCss(clipMotion(clip({}), 20, F))).toEqual({ prefix: '', suffix: '', opacity: 1, filter: undefined, clipPath: undefined });
  });
});

describe('efeitos', () => {
  it('filtros CSS em ordem, padrões do catálogo, keyframes por parâmetro e desligados ignorados', () => {
    const c = clip({
      effects: [
        { id: 'e1', type: 'grayscale', params: {} },
        { id: 'e2', type: 'blur', params: { radius: 4 } },
        { id: 'e3', type: 'sepia', enabled: false },
        { id: 'e4', type: 'desconhecido' },
      ],
      keyframes: { 'effects.e2.radius': [{ frame: 0, value: 0 }, { frame: 10, value: 10 }] },
    });
    expect(effectsFilter(c, 15)).toBe('grayscale(1) blur(5px)');
    expect(effectsFilter(clip({}), 15)).toBeUndefined();
  });
});

describe('no ProjectRenderer', () => {
  const project = (tracks: unknown[]) => ProjectSchema.parse({ ...createEmptyProject({ id: 'p', format: 'reel-9x16' }), tracks });
  const html = (p: ReturnType<typeof project>, frame: number) =>
    renderToStaticMarkup(<ProjectRenderer project={p} frame={frame} resolveAsset={() => ''} />);

  it('transição e efeito entram no estilo do clipe', () => {
    const p = project([
      {
        id: 't',
        kind: 'text',
        clips: [
          { id: 'a', type: 'text', start: 0, duration: 30, props: { text: 'A' }, transitionIn: { type: 'fade', duration: 10, easing: 'linear' }, effects: [{ id: 'g', type: 'grayscale' }] },
        ],
      },
    ]);
    const out = html(p, 5);
    expect(out).toContain('opacity:0.5');
    expect(out).toContain('filter:grayscale(1)');
  });

  it('clipe de ajuste filtra só as trilhas de baixo, e o invólucro existe mesmo fora do clipe', () => {
    const p = project([
      { id: 'base', kind: 'text', clips: [{ id: 'a', type: 'text', start: 0, duration: 60, props: { text: 'embaixo' } }] },
      { id: 'fx', kind: 'effect', clips: [{ id: 'adj', type: 'adjustment', start: 10, duration: 20, effects: [{ id: 'g', type: 'grayscale' }] }] },
      { id: 'top', kind: 'text', clips: [{ id: 'b', type: 'text', start: 0, duration: 60, props: { text: 'em cima' } }] },
    ]);
    const on = html(p, 15);
    const wrapper = on.indexOf('data-adjustment-track="fx"');
    expect(on.slice(wrapper, wrapper + 120)).toContain('filter:grayscale(1)');
    expect(on.indexOf('embaixo')).toBeGreaterThan(wrapper);
    expect(on.indexOf('em cima')).toBeGreaterThan(on.indexOf('embaixo'));
    // 'em cima' fica fora do invólucro: o invólucro fecha antes dele
    const off = html(p, 40);
    expect(off).toContain('data-adjustment-track="fx"');
    expect(off).not.toContain('grayscale');
  });

  it('clipe de efeito desenha a sobreposição no quadro inteiro', () => {
    const p = project([
      { id: 'fx', kind: 'effect', clips: [{ id: 'v', type: 'effect', start: 0, duration: 30, props: { effect: 'vignette', amount: 0.5 } }] },
      { id: 'fx2', kind: 'effect', clips: [{ id: 'gr', type: 'effect', start: 0, duration: 30, props: { effect: 'grain' } }] },
    ]);
    const out = html(p, 3);
    expect(out).toContain('radial-gradient');
    expect(out).toContain('feTurbulence');
    expect(out).toContain('seed="3"');
  });
});

describe('lint de movimento', () => {
  it('avisa nomes desconhecidos e entrada+saída longas; clipe de efeito inválido é erro', async () => {
    const { lintProject } = await import('./lint');
    const p = ProjectSchema.parse({
      ...createEmptyProject({ id: 'p', format: 'reel-9x16' }),
      tracks: [
        {
          id: 't',
          kind: 'text',
          clips: [
            { id: 'a', type: 'text', start: 0, duration: 20, transitionIn: { type: 'dissolve', duration: 15 }, transitionOut: { type: 'morph', duration: 10 } },
          ],
        },
        { id: 'fx', kind: 'effect', clips: [{ id: 'e', type: 'effect', start: 0, duration: 10, props: { effect: 'lensflare' } }, { id: 'adj', type: 'adjustment', start: 10, duration: 10 }] },
      ],
    });
    const codes = lintProject(p).map((i) => `${i.clipId}:${i.code}:${i.severity}`);
    expect(codes).toEqual([
      'a:CAJU_UNKNOWN_TRANSITION:warn',
      'a:CAJU_MOTION_OVERLAP:warn',
      'e:CAJU_UNKNOWN_OVERLAY:error',
      'adj:CAJU_ADJUSTMENT_EMPTY:warn',
    ]);
  });
});
