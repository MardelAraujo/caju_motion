import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIONS, actionFor, bindings, comboOf, formatCombo, resetBindings, setBinding } from './actions';

const key = (k: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) =>
  comboOf({ key: k, ctrlKey: !!mods.ctrl, metaKey: false, shiftKey: !!mods.shift, altKey: !!mods.alt });

describe('registro de ações e atalhos', () => {
  beforeEach(() => resetBindings());

  it('normaliza eventos de teclado', () => {
    expect(key('Z', { ctrl: true, shift: true })).toBe('mod+shift+z');
    expect(key(' ')).toBe('space');
    expect(key('ArrowLeft', { alt: true })).toBe('alt+left');
    expect(key('+', { shift: true })).toBe('plus'); // Shift do layout não conta em símbolos
    expect(key('Shift', { shift: true })).toBeNull();
    expect(formatCombo('mod+shift+z')).toBe('Ctrl+Shift+Z');
    expect(formatCombo('plus')).toBe('+');
  });

  it('cada atalho padrão aponta para uma ação só', () => {
    const seen = new Map<string, string>();
    for (const a of ACTIONS) for (const k of a.keys) {
      expect(seen.get(k), `${k} em ${a.id} e ${seen.get(k)}`).toBeUndefined();
      seen.set(k, a.id);
    }
    expect(actionFor('q')?.id).toBe('trim-left');
    expect(actionFor('shift+delete')?.id).toBe('ripple-delete');
  });

  it('remapear tira o atalho de quem o usava; restaurar volta ao padrão', () => {
    const taken = setBinding('split', 'q');
    expect(taken).toBe('Apagar à esquerda do playhead');
    expect(actionFor('q')?.id).toBe('split');
    expect(bindings()['trim-left']).toEqual([]);
    expect(actionFor('s')).toBeUndefined();
    resetBindings();
    expect(actionFor('s')?.id).toBe('split');
  });
});
