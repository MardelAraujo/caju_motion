import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Clip } from '@caju-motion/schema';
import {
  clipValue,
  createRenderGate,
  cubicBezier,
  Easing,
  evaluateKeyframes,
  FrameProvider,
  interpolate,
  mixColors,
  random,
  Sequence,
  spring,
  springDuration,
  useAbsoluteFrame,
  useFrame,
  useVideoConfig,
} from './index';

describe('interpolate', () => {
  it('interpola com clamp por padrão', () => {
    expect(interpolate(5, [0, 10], [0, 100])).toBe(50);
    expect(interpolate(-5, [0, 10], [0, 100])).toBe(0);
    expect(interpolate(15, [0, 10], [0, 100])).toBe(100);
  });

  it('suporta múltiplos segmentos', () => {
    expect(interpolate(15, [0, 10, 20], [0, 100, 0])).toBe(50);
  });

  it('extend continua linear', () => {
    expect(interpolate(20, [0, 10], [0, 100], { extrapolateRight: 'extend' })).toBe(200);
    expect(interpolate(-10, [0, 10], [0, 100], { extrapolateLeft: 'extend' })).toBe(-100);
  });

  it('aplica easing dentro do intervalo', () => {
    const v = interpolate(5, [0, 10], [0, 1], { easing: Easing.easeIn });
    expect(v).toBeLessThan(0.5);
  });

  it('valida ranges', () => {
    expect(() => interpolate(0, [0], [0])).toThrow();
    expect(() => interpolate(0, [0, 0], [0, 1])).toThrow(/crescente/);
    expect(() => interpolate(0, [0, 1], [0])).toThrow(/mesmo tamanho/);
  });
});

describe('easing', () => {
  it('bezier bate nas pontas e é monotônica para curvas comuns', () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 5);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = ease(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('backOut passa de 1 (overshoot)', () => {
    const max = Math.max(...Array.from({ length: 101 }, (_, i) => Easing.backOut(i / 100)));
    expect(max).toBeGreaterThan(1);
  });

  it('rejeita x fora de [0,1]', () => {
    expect(() => cubicBezier(1.2, 0, 0.5, 1)).toThrow();
  });
});

describe('spring', () => {
  it('começa em from, termina em to', () => {
    expect(spring({ frame: 0, fps: 30 })).toBe(0);
    expect(spring({ frame: 120, fps: 30 })).toBeCloseTo(1, 3);
    expect(spring({ frame: 120, fps: 30, from: 10, to: 20 })).toBeCloseTo(20, 2);
  });

  it('bouncy passa do alvo; overshootClamping impede', () => {
    const vals = Array.from({ length: 60 }, (_, f) => spring({ frame: f, fps: 30, config: { damping: 8 } }));
    expect(Math.max(...vals)).toBeGreaterThan(1);
    const clamped = Array.from({ length: 60 }, (_, f) =>
      spring({ frame: f, fps: 30, config: { damping: 8, overshootClamping: true } }),
    );
    expect(Math.max(...clamped)).toBeLessThanOrEqual(1);
  });

  it('funciona em regime superamortecido e crítico', () => {
    const over = spring({ frame: 200, fps: 30, config: { damping: 80 } });
    const crit = spring({ frame: 60, fps: 30, config: { mass: 1, stiffness: 100, damping: 20 } });
    expect(over).toBeGreaterThan(0.9);
    expect(crit).toBeCloseTo(1, 2);
  });

  it('respeita delay e é função pura do frame', () => {
    expect(spring({ frame: 5, fps: 30, delay: 10 })).toBe(0);
    expect(spring({ frame: 17, fps: 30 })).toBe(spring({ frame: 17, fps: 30 }));
  });

  it('springDuration é finita e razoável', () => {
    const d = springDuration({ fps: 30 });
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(60);
  });
});

describe('keyframes', () => {
  const kfs = [
    { frame: 0, value: 0, easing: 'linear' as const },
    { frame: 10, value: 100, easing: 'hold' as const },
    { frame: 20, value: 50, easing: 'linear' as const },
  ];

  it('interpola, segura (hold) e trava nas pontas', () => {
    expect(evaluateKeyframes(kfs, -5)).toBe(0);
    expect(evaluateKeyframes(kfs, 5)).toBe(50);
    expect(evaluateKeyframes(kfs, 15)).toBe(100);
    expect(evaluateKeyframes(kfs, 20)).toBe(50);
    expect(evaluateKeyframes(kfs, 99)).toBe(50);
    expect(evaluateKeyframes([], 3)).toBeUndefined();
  });

  it('mistura cores hex', () => {
    const v = evaluateKeyframes(
      [
        { frame: 0, value: '#000000', easing: 'linear' },
        { frame: 10, value: '#ffffff', easing: 'linear' },
      ],
      5,
    );
    expect(v).toBe('#808080');
    expect(mixColors('#ff000000', '#ff0000', 1)).toBe('#ff0000');
  });

  it('clipValue usa keyframes relativos ao início do clipe, senão o valor estático', () => {
    const clip = {
      id: 'c',
      type: 'text',
      start: 100,
      duration: 30,
      opacity: 0.3,
      transform: { x: 10, y: 0, scale: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 },
      keyframes: { opacity: [{ frame: 0, value: 0, easing: 'linear' }, { frame: 10, value: 1, easing: 'linear' }] },
      props: { fontSize: 64 },
    } as unknown as Clip;
    expect(clipValue(clip, 'opacity', 105, 1)).toBeCloseTo(0.5);
    expect(clipValue(clip, 'transform.x', 105, 0)).toBe(10);
    expect(clipValue(clip, 'props.fontSize', 105, 0)).toBe(64);
    expect(clipValue(clip, 'props.naoExiste', 105, 7)).toBe(7);
  });
});

describe('random', () => {
  it('é determinístico e varia com a semente', () => {
    expect(random('a')).toBe(random('a'));
    expect(random('a')).not.toBe(random('b'));
    for (let i = 0; i < 100; i++) {
      const v = random(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('render gate', () => {
  it('resolve só quando todos os handles fecham', async () => {
    const gate = createRenderGate();
    const a = gate.delayRender('fonte');
    const b = gate.delayRender('imagem');
    let done = false;
    const p = gate.ready().then(() => (done = true));
    gate.continueRender(a);
    await Promise.resolve();
    expect(done).toBe(false);
    expect(gate.pending()).toEqual(['imagem']);
    gate.continueRender(b);
    await p;
    expect(done).toBe(true);
  });
});

describe('FrameProvider / Sequence', () => {
  function Probe() {
    const f = useFrame();
    const abs = useAbsoluteFrame();
    const { durationInFrames } = useVideoConfig();
    return <i>{`${f}/${abs}/${durationInFrames}`}</i>;
  }
  const config = { width: 100, height: 100, fps: 30, durationInFrames: 300 };
  const html = (frame: number) =>
    renderToStaticMarkup(
      <FrameProvider frame={frame} config={config}>
        <Sequence from={10} duration={20}>
          <Sequence from={5}>
            <Probe />
          </Sequence>
        </Sequence>
      </FrameProvider>,
    );

  it('desloca o frame e desmonta fora do intervalo', () => {
    expect(html(9)).toBe('');
    expect(html(12)).toBe('');
    expect(html(15)).toBe('<i>0/15/20</i>');
    expect(html(29)).toBe('<i>14/29/20</i>');
    expect(html(30)).toBe('');
  });

  it('useFrame fora do provider dá erro claro', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/FrameProvider/);
  });
});
