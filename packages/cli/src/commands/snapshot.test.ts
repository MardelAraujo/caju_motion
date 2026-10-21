import { describe, expect, it } from 'vitest';
import { createEmptyProject, ProjectSchema } from '@caju-motion/schema';
import { snapshotFrames } from './snapshot';

const project = ProjectSchema.parse({
  ...createEmptyProject({ id: 'p', format: 'reel-9x16' }),
  tracks: [
    {
      id: 'main',
      kind: 'main',
      clips: [
        { id: 'a', type: 'shape', start: 0, duration: 60 },
        { id: 'b', type: 'shape', start: 60, duration: 60 },
      ],
    },
    { id: 'txt', kind: 'text', clips: [{ id: 't', type: 'text', start: 30, duration: 60 }] },
  ],
  markers: [{ id: 'm', frame: 45, label: 'gancho' }],
});

describe('snapshotFrames', () => {
  it('início, fim, meio das cenas marcadas e dos clipes principais, sem repetir', () => {
    const f = snapshotFrames(project, { max: 6 });
    expect(f.map((x) => x.frame)).toEqual([0, 30, 60, 83, 90, 119]); // 83 = meio da cena do marcador; 60 = amostra
    expect(f[0]).toEqual({ frame: 0, reason: 'início' });
    expect(f.at(-1)).toEqual({ frame: 119, reason: 'fim' });
    expect(f.find((x) => x.frame === 83)?.reason).toBe('meio de gancho');
    expect(f.length).toBeLessThanOrEqual(6);
  });

  it('--at-cuts: 0,1 s antes e 0,2 s depois dos cortes mais fortes', () => {
    const f = snapshotFrames(project, { atCuts: true, max: 12 });
    const reasons = f.filter((x) => x.reason.startsWith('corte')).map((x) => x.frame);
    expect(reasons).toEqual(expect.arrayContaining([57, 66]));
  });

  it('quadros pedidos vencem e são limitados ao projeto', () => {
    expect(snapshotFrames(project, { frames: [5, 500] }).map((x) => x.frame)).toEqual([5, 119]);
  });
});
