import { describe, expect, it } from 'vitest';
import { createRenderGate } from './delay-render';

describe('render gate', () => {
  it('resolve na hora sem pendências', async () => {
    const gate = createRenderGate();
    await expect(gate.ready()).resolves.toBeUndefined();
  });

  it('espera todos os handles fecharem', async () => {
    const gate = createRenderGate();
    const a = gate.delayRender('imagem');
    const b = gate.delayRender('vídeo');
    let done = false;
    const p = gate.ready().then(() => {
      done = true;
    });
    expect(gate.pending()).toEqual(['imagem', 'vídeo']);
    gate.continueRender(a);
    await Promise.resolve();
    expect(done).toBe(false);
    gate.continueRender(b);
    await p;
    expect(done).toBe(true);
    expect(gate.pending()).toEqual([]);
  });

  it('continueRender repetido ou desconhecido é inofensivo', async () => {
    const gate = createRenderGate();
    const a = gate.delayRender();
    gate.continueRender(a);
    gate.continueRender(a);
    gate.continueRender(999);
    expect(gate.pending()).toEqual([]);
    const b = gate.delayRender('outro');
    gate.continueRender(a);
    expect(gate.pending()).toEqual(['outro']);
    gate.continueRender(b);
    await gate.ready();
  });
});
