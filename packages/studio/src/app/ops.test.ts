import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { ProjectSchema, type Project } from '@caju-motion/schema';
import {
  clipAt,
  copyClips,
  moveClips,
  pasteClips,
  rippleDelete,
  toggleTrack,
  trimToPlayhead,
  deleteClip,
  duplicateClip,
  findClip,
  insertClip,
  makeClip,
  moveClip,
  setSpeed,
  splitClip,
  trimClip,
} from './ops';

function project(): Project {
  return ProjectSchema.parse({
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    settings: { width: 1080, height: 1920, fps: 30 },
    assets: [
      { id: 'v', kind: 'video', src: 'assets/v.mp4', meta: { durationSec: 10, width: 1920, height: 1080 } },
      { id: 'i', kind: 'image', src: 'assets/i.png', meta: { width: 100, height: 100 } },
      { id: 'a', kind: 'audio', src: 'assets/a.wav', meta: { durationSec: 4 } },
    ],
    tracks: [
      {
        id: 'main',
        kind: 'main',
        clips: [
          { id: 'v1', type: 'video', assetId: 'v', start: 0, duration: 90 },
          { id: 'v2', type: 'video', assetId: 'v', start: 90, duration: 60 },
        ],
      },
      { id: 'txt', kind: 'text', clips: [{ id: 't1', type: 'text', start: 10, duration: 30 }] },
    ],
  });
}

const edit = (p: Project, fn: (d: Project) => void) => produce(p, fn);
const starts = (p: Project, trackId: string) =>
  p.tracks.find((t) => t.id === trackId)!.clips.map((c) => [c.id, c.start, c.duration]);
const valid = (p: Project) => {
  const r = ProjectSchema.safeParse(p);
  if (!r.success) throw new Error(r.error.message);
};

describe('ops', () => {
  it('split divide mídia ajustando trimIn', () => {
    let rightId: string | null = null;
    const p = edit(project(), (d) => {
      rightId = splitClip(d, 'v1', 30);
    });
    expect(starts(p, 'main')).toEqual([
      ['v1', 0, 30],
      [rightId, 30, 60],
      ['v2', 90, 60],
    ]);
    expect(findClip(p, rightId!)!.clip.trimIn).toBe(30);
    valid(p);
  });

  it('split fora do clipe não faz nada', () => {
    const p = edit(project(), (d) => {
      expect(splitClip(d, 'v1', 0)).toBeNull();
      expect(splitClip(d, 'v1', 90)).toBeNull();
    });
    expect(starts(p, 'main')).toEqual(starts(project(), 'main'));
  });

  it('excluir na principal fecha o buraco (magnético)', () => {
    const p = edit(project(), (d) => deleteClip(d, 'v1'));
    expect(starts(p, 'main')).toEqual([['v2', 0, 60]]);
  });

  it('trilha vazia não-principal some', () => {
    const p = edit(project(), (d) => deleteClip(d, 't1'));
    expect(p.tracks.map((t) => t.id)).toEqual(['main']);
  });

  it('trim do fim respeita a duração da mídia', () => {
    const p = edit(project(), (d) => trimClip(d, 'v2', 'end', 10_000));
    expect(findClip(p, 'v2')!.clip.duration).toBe(300);
  });

  it('trim do início avança trimIn e não recua antes do arquivo', () => {
    let p = edit(project(), (d) => trimClip(d, 'v1', 'start', 20));
    expect(findClip(p, 'v1')!.clip).toMatchObject({ start: 0, duration: 70, trimIn: 20 });
    p = edit(p, (d) => trimClip(d, 'v1', 'start', -100));
    expect(findClip(p, 'v1')!.clip).toMatchObject({ duration: 90, trimIn: 0 });
    valid(p);
  });

  it('trim em trilha livre não invade o vizinho', () => {
    const p0 = edit(project(), (d) => {
      insertClip(d, makeClip({ id: 't2', type: 'text', start: 50, duration: 20 }), 'txt');
    });
    const p = edit(p0, (d) => trimClip(d, 't1', 'end', 100));
    expect(findClip(p, 't1')!.clip.duration).toBe(40); // 10 → 50
    const p2 = edit(p0, (d) => trimClip(d, 't2', 'start', -100));
    expect(findClip(p2, 't2')!.clip).toMatchObject({ start: 40, duration: 30 });
  });

  it('mover na principal reordena', () => {
    const p = edit(project(), (d) => moveClip(d, 'v2', 0, 'main'));
    expect(starts(p, 'main')).toEqual([
      ['v2', 0, 60],
      ['v1', 60, 90],
    ]);
  });

  it('mover para posição ocupada cria trilha nova acima', () => {
    const p0 = edit(project(), (d) => {
      insertClip(d, makeClip({ id: 't2', type: 'text', start: 100, duration: 20 }), 'txt');
    });
    const p = edit(p0, (d) => moveClip(d, 't2', 20, 'txt'));
    expect(p.tracks).toHaveLength(3);
    expect(findClip(p, 't2')!.track.id).not.toBe('txt');
    valid(p);
  });

  it('texto não entra na principal; áudio só em trilha de áudio', () => {
    const p = edit(project(), (d) => {
      moveClip(d, 't1', 5, 'main');
      insertClip(d, makeClip({ id: 'a1', type: 'audio', assetId: 'a', start: 0, duration: 60 }), 'main');
    });
    expect(findClip(p, 't1')!.track.id).toBe('txt');
    expect(findClip(p, 'a1')!.track.kind).toBe('audio');
    valid(p);
  });

  it('duplicar na principal empurra os seguintes', () => {
    let id: string | null = null;
    const p = edit(project(), (d) => {
      id = duplicateClip(d, 'v1');
    });
    expect(starts(p, 'main')).toEqual([
      ['v1', 0, 90],
      [id, 90, 90],
      ['v2', 180, 60],
    ]);
  });

  it('velocidade muda a duração e respeita limites', () => {
    let p = edit(project(), (d) => setSpeed(d, 'v1', 2));
    expect(findClip(p, 'v1')!.clip).toMatchObject({ speed: 2, duration: 45 });
    expect(starts(p, 'main')[1]).toEqual(['v2', 45, 60]);
    p = edit(p, (d) => setSpeed(d, 'v1', 0.5));
    expect(findClip(p, 'v1')!.clip.duration).toBe(180);
    valid(p);
  });

  it('clipAt prioriza a trilha de cima', () => {
    expect(clipAt(project(), 15)!.id).toBe('t1');
    expect(clipAt(project(), 50)!.id).toBe('v1');
    expect(clipAt(project(), 999)).toBeNull();
  });
});

describe('edição em grupo', () => {
  const withOverlay = () =>
    produce(project(), (d) => {
      d.tracks.push({
        id: 'ov',
        kind: 'overlay',
        name: 'ov',
        locked: false,
        hidden: false,
        muted: false,
        clips: [
          makeClip({ id: 'o1', type: 'shape', start: 0, duration: 20 }),
          makeClip({ id: 'o2', type: 'shape', start: 30, duration: 20 }),
          makeClip({ id: 'o3', type: 'shape', start: 60, duration: 20 }),
        ],
      });
    });

  it('ripple delete fecha o buraco só na trilha do clipe', () => {
    const p = produce(withOverlay(), (d) => rippleDelete(d, ['o2', 't1']));
    expect(findClip(p, 'o3')!.clip.start).toBe(40);
    expect(findClip(p, 'o1')!.clip.start).toBe(0);
    expect(p.tracks.find((t) => t.id === 'txt')).toBeUndefined(); // trilha vazia some
    const main = produce(withOverlay(), (d) => rippleDelete(d, ['v1']));
    expect(findClip(main, 'v2')!.clip.start).toBe(0);
  });

  it('Q/W cortam até o playhead; fora do clipe não fazem nada', () => {
    const left = produce(withOverlay(), (d) => void trimToPlayhead(d, 'o2', 40, 'left'));
    expect(findClip(left, 'o2')!.clip).toMatchObject({ start: 40, duration: 10 });
    const right = produce(withOverlay(), (d) => void trimToPlayhead(d, 'o2', 40, 'right'));
    expect(findClip(right, 'o2')!.clip).toMatchObject({ start: 30, duration: 10 });
    const p = withOverlay();
    expect(produce(p, (d) => void trimToPlayhead(d, 'o2', 10, 'left'))).toBe(p);
  });

  it('move em grupo só se todos couberem; o grupo para no zero', () => {
    const ok = produce(withOverlay(), (d) => void moveClips(d, ['o2', 'o3'], 5));
    expect([findClip(ok, 'o2')!.clip.start, findClip(ok, 'o3')!.clip.start]).toEqual([35, 65]);
    const p = withOverlay();
    expect(produce(p, (d) => void moveClips(d, ['o2'], -15))).toBe(p); // bateria no o1
    const clamp = produce(withOverlay(), (d) => void moveClips(d, ['o1', 't1'], -50));
    expect(findClip(clamp, 'o1')!.clip.start).toBe(0);
    expect(findClip(clamp, 't1')!.clip.start).toBe(10);
  });

  it('copiar e colar no playhead mantém o espaçamento e cria ids novos', () => {
    const base = withOverlay();
    const cb = copyClips(base, ['o2', 'o3'])!;
    let ids: string[] = [];
    const p = produce(base, (d) => {
      ids = pasteClips(d, cb, 100);
    });
    expect(ids.map((id) => findClip(p, id)!.clip.start)).toEqual([100, 130]);
    expect(ids.some((id) => ['o2', 'o3'].includes(id))).toBe(false);
    expect(findClip(p, ids[0]!)!.track.id).toBe('ov');
  });

  it('alterna mudo/oculto/travado da trilha', () => {
    const p = produce(project(), (d) => toggleTrack(d, 'txt', 'hidden'));
    expect(p.tracks.find((t) => t.id === 'txt')!.hidden).toBe(true);
  });
});
