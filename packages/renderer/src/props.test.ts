import { describe, expect, it } from 'vitest';
import { resolvedProps, shapeProps, textProps } from './props';

const clip = {
  start: 100,
  props: { text: '0', width: 0, fill: '#F6B73C' },
  keyframes: {
    'props.text': [
      { frame: 0, value: '0', easing: 'hold' as const },
      { frame: 10, value: '72', easing: 'linear' as const },
    ],
    'props.width': [
      { frame: 0, value: 0, easing: 'linear' as const },
      { frame: 20, value: 400, easing: 'linear' as const },
    ],
    opacity: [{ frame: 0, value: 1, easing: 'linear' as const }],
  },
};

describe('resolvedProps', () => {
  it('aplica keyframes de props no frame do projeto (texto em degrau, número interpolado)', () => {
    expect(resolvedProps(clip, 105)).toMatchObject({ text: '0', width: 100, fill: '#F6B73C' });
    expect(resolvedProps(clip, 110)).toMatchObject({ text: '72', width: 200 });
    expect(resolvedProps(clip, 200)).toMatchObject({ text: '72', width: 400 });
  });

  it('sem keyframes de props devolve o mesmo objeto (sem alocar)', () => {
    const plain = { start: 0, props: { text: 'a' }, keyframes: {} };
    expect(resolvedProps(plain, 5)).toBe(plain.props);
  });

  it('shapeProps/textProps preenchem defaults e ignoram tipos errados', () => {
    expect(shapeProps({ props: { stroke: '#fff', strokeWidth: 2, width: 'x' } })).toMatchObject({
      shape: 'rect',
      width: 400,
      stroke: '#fff',
      strokeWidth: 2,
    });
    expect(textProps({ props: { text: 'Olá', fontSize: 32 } })).toMatchObject({ text: 'Olá', fontSize: 32, align: 'center' });
  });
});
