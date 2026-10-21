import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { ClipSchema, type Clip } from '@caju-motion/schema';
import { bezierOf, keyframeFrames, moveKeyframesAt, setAnimatable, setEasingAt, toggleKeyframe, valueAt } from './keyframes';

const clip = (): Clip => ClipSchema.parse({ id: 'c', type: 'shape', start: 100, duration: 60, transform: { x: 10, y: 20, scale: 1 } });

describe('keyframes no editor', () => {
  it('◆ cria com o valor atual e remove no mesmo quadro; posição liga X e Y', () => {
    const a = produce(clip(), (c) => toggleKeyframe(c, ['transform.x', 'transform.y'], 110));
    expect(a.keyframes['transform.x']).toEqual([{ frame: 10, value: 10, easing: 'easeInOut' }]);
    expect(a.keyframes['transform.y']).toEqual([{ frame: 10, value: 20, easing: 'easeInOut' }]);
    const b = produce(a, (c) => toggleKeyframe(c, ['transform.x', 'transform.y'], 110));
    expect(b.keyframes).toEqual({});
  });

  it('com keyframes, mudar o valor grava no playhead; sem, muda a base', () => {
    let c = produce(clip(), (d) => toggleKeyframe(d, ['transform.scale'], 100));
    c = produce(c, (d) => setAnimatable(d, 'transform.scale', 130, 2));
    expect(c.keyframes['transform.scale']!.map((k) => [k.frame, k.value])).toEqual([[0, 1], [30, 2]]);
    expect(valueAt(c, 'transform.scale', 115)).toBeGreaterThan(1);
    expect(c.transform.scale).toBe(1);
    const base = produce(clip(), (d) => setAnimatable(d, 'opacity', 120, 0.5));
    expect(base.opacity).toBe(0.5);
    expect(base.keyframes).toEqual({});
  });

  it('lista por quadro, troca o easing e move os keyframes de um quadro', () => {
    let c = produce(clip(), (d) => {
      toggleKeyframe(d, ['transform.x'], 100);
      toggleKeyframe(d, ['opacity', 'transform.x'], 130);
    });
    expect(keyframeFrames(c).map((f) => [f.frame, f.paths.sort()])).toEqual([[0, ['transform.x']], [30, ['opacity', 'transform.x']]]);
    c = produce(c, (d) => setEasingAt(d, 0, { bezier: [0.2, 0, 0.2, 1] }));
    expect(c.keyframes['transform.x']![0]!.easing).toEqual({ bezier: [0.2, 0, 0.2, 1] });
    c = produce(c, (d) => moveKeyframesAt(d, 30, 45));
    expect(keyframeFrames(c).map((f) => f.frame)).toEqual([0, 45]);
    expect(bezierOf('easeOut')).toEqual([0, 0, 0.58, 1]);
    expect(bezierOf('hold')).toBeNull();
  });
});
