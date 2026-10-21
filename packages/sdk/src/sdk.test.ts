import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectSchema, type Clip, type Project } from '@caju-motion/schema';
import {
  buildProject,
  buildProjectDir,
  defineProject,
  formatConflicts,
  isProjectDefinition,
  LAST_BUILD_FILE,
  lintDeterminismSource,
  loadProjectDefinition,
  mergeBuild,
  STUDIO_EDITS_TRACK_NAME,
  wasEditedInStudio,
  type ProjectApi,
} from './index';

const template = (title: string, counterTo = 100) =>
  defineProject({ id: 'demo', name: 'Demo', format: 'reel-9x16', duration: 90 }, (p: ProjectApi) => {
    p.scene('abertura', 'Abertura', 0, 90, (s) => {
      s.rect(1080, 1920, { fill: '#171512' }, { id: 'bg', x: 540, y: 960, exit: false });
      s.text(title, { size: 120, weight: 800 }, { id: 'titulo', x: 540, y: 700, enter: { at: 0 } });
      s.component('Counter', { to: counterTo }, { id: 'contador', at: [10, 80], width: 600, height: 200 });
    });
  });

const allClips = (p: Project) => p.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, track: t.id })));
const clipById = (p: Project, id: string) => allClips(p).find((c) => c.id === id);

/** Simula o Studio: adiciona um clipe do editor numa trilha nova, salva com updatedAt novo. */
function studioEdit(p: Project, edit?: (p: Project) => void): Project {
  const next = structuredClone(p) as Project & { tracks: { clips: unknown[] }[] };
  next.tracks.push({
    id: 'overlay-studio',
    kind: 'overlay',
    name: 'Sobreposição',
    locked: false,
    hidden: false,
    muted: false,
    clips: [{ id: 'logo-studio', type: 'shape', start: 20, duration: 30, props: { fill: '#F6B73C' } } as unknown as Clip],
  });
  edit?.(next);
  next.meta = { ...next.meta, updatedAt: '2030-01-01T00:00:00.000Z' };
  return ProjectSchema.parse(next);
}

describe('defineProject / buildProject', () => {
  it('é um objeto simples reconhecível e gera clipes de código', async () => {
    const def = template('Olá');
    expect(isProjectDefinition(def)).toBe(true);
    expect(isProjectDefinition({ ...def })).toBe(true);
    const p = await buildProject(def);
    expect(allClips(p).every((c) => c.origin === 'code')).toBe(true);
    const comp = clipById(p, 'contador')!;
    expect(comp).toMatchObject({ type: 'component', start: 10, duration: 70 });
    expect(comp.props).toEqual({ to: 100, width: 600, height: 200, component: 'Counter' });
    expect(comp.transform).toMatchObject({ x: 540, y: 960 });
    expect(p.meta.generator).toBe('caju-motion/sdk');
  });

  it('componente fora de cena vai para a trilha "Componentes"', async () => {
    const p = await buildProject(
      defineProject({ id: 'x', format: 'square-1x1', duration: 60 }, (b) => {
        b.component('Grain', {});
        b.scene('a', 'A', 0, 60, (s) => s.text('oi', { size: 40 }, { x: 0, y: 0 }));
      }),
    );
    const track = p.tracks.find((t) => t.clips.some((c) => c.type === 'component'))!;
    expect(track.name).toBe('Componentes');
    expect(track.clips[0]).toMatchObject({ start: 0, duration: 60 });
  });
});

describe('s.captions', () => {
  it('um clipe de texto por legenda, em segundos desde a cena, sem sobreposição', async () => {
    const p = await buildProject(
      defineProject({ id: 'cap', format: 'reel-9x16', duration: 150 }, (b) => {
        b.tracks(['Legendas']);
        b.scene('s', 'Cena', 30, 150, (s) => {
          s.captions(
            [
              { text: 'Olá', start: 0, end: 1.5 },
              { text: 'mundo', start: 1, end: 2 }, // começa antes da anterior acabar
            ],
            { size: 54, weight: 800, bg: '#000' },
            { x: 540, y: 1500, track: 'Legendas', offsetSec: 0.5 },
          );
        });
      }),
    );
    const clips = p.tracks.flatMap((t) => t.clips).filter((c) => c.type === 'text');
    expect(clips.map((c) => [c.id, c.start, c.duration, c.props.text])).toEqual([
      ['s-legenda-1', 45, 45 - 15, 'Olá'], // cena começa no 30; 0,5 s de offset → 45; cortada no início da próxima
      ['s-legenda-2', 75, 30, 'mundo'],
    ]);
    expect(new Set(p.tracks.filter((t) => t.clips.some((c) => c.type === 'text')).map((t) => t.name))).toEqual(new Set(['Legendas']));
    expect(clips[0]!.origin).toBe('code');
  });
});

describe('trilhas de áudio', () => {
  it('a trilha da locução não colide com um asset chamado "locucao" (ids são globais)', async () => {
    const make = (assetId: string) =>
      buildProject(
        defineProject({ id: 'a', format: 'reel-9x16', duration: 60 }, (b) => {
          b.asset({ id: assetId, kind: 'audio', src: `assets/audio/vo/${assetId}.wav`, meta: { durationSec: 1 } });
          b.audioClip(assetId, 0, 30, 'Locução');
        }),
      );
    const colliding = await make('locucao');
    expect(colliding.tracks.find((t) => t.kind === 'audio')!.id).toBe('locucao-trilha');
    expect(ProjectSchema.safeParse(colliding).success).toBe(true);
    // qualquer id gerado, não só "locucao": um asset chamado como uma trilha de texto
    const p = await buildProject(
      defineProject({ id: 'b', format: 'reel-9x16', duration: 60 }, (b) => {
        b.asset({ id: 'texto-1', kind: 'image', src: 'assets/x.png', meta: { width: 10, height: 10 } });
        b.scene('s', 'Cena', 0, 60, (s) => void s.text('Oi', { size: 40 }, { x: 10, y: 10 }));
      }),
    );
    expect(p.tracks.map((t) => t.id)).toContain('texto-1-trilha');
    expect(ProjectSchema.safeParse(p).success).toBe(true);
    // sem colisão o id antigo continua (projetos existentes não mudam)
    expect((await make('vo-01')).tracks.find((t) => t.kind === 'audio')!.id).toBe('locucao');
  });
});

describe('mergeBuild', () => {
  it('preserva clipes do editor, troca os de código e detecta edições', async () => {
    const v1 = await buildProject(template('Olá'));
    const edited = studioEdit(v1);
    const v2 = await buildProject(template('Olá, mundo'));
    const r = mergeBuild(edited, v2, v1);
    expect(r.conflicts).toEqual([]);
    expect(r.editorClips).toEqual(['logo-studio']);
    expect(clipById(r.project, 'logo-studio')?.track).toBe('overlay-studio');
    expect(clipById(r.project, 'titulo')?.props.text).toBe('Olá, mundo');

    // clipe de código mexido no Studio → conflito com diff
    const touched = studioEdit(v1, (p) => {
      const c = p.tracks.flatMap((t) => t.clips).find((c) => c.id === 'contador')!;
      c.props.to = 999;
    });
    const r2 = mergeBuild(touched, v2, v1);
    expect(r2.conflicts).toHaveLength(1);
    expect(r2.conflicts[0]).toMatchObject({ clipId: 'contador', kind: 'edited', changes: [{ path: 'props.to', before: 100, after: 999 }] });
    expect(formatConflicts(r2.conflicts)).toContain('props.to: 100 → 999');
  });

  it('metade de um corte vira do editor; trilha de código sumida → "Edições do Studio"; id repetido é renomeado', async () => {
    const v1 = await buildProject(template('Olá'));
    const studio = structuredClone(v1);
    const textTrack = studio.tracks.find((t) => t.clips.some((c) => c.id === 'titulo'))!;
    const half = { ...structuredClone(textTrack.clips[0]!), id: 'titulo-b', start: 95, duration: 5, keyframes: {} };
    textTrack.clips.push(half);
    textTrack.clips.push({ ...structuredClone(half), id: 'logo', origin: 'editor', start: 120, duration: 5 });
    const parsed = ProjectSchema.parse(studio);

    // nova versão do código sem a trilha de texto
    const v2 = await buildProject(
      defineProject({ id: 'demo', format: 'reel-9x16', duration: 90 }, (p) =>
        p.scene('abertura', 'Abertura', 0, 90, (s) => s.rect(10, 10, { fill: '#000' }, { id: 'logo', x: 0, y: 0 })),
      ),
    );
    const r = mergeBuild(parsed, v2, v1);
    expect(r.adopted).toEqual(['titulo-b']);
    expect(r.renamed).toEqual([{ from: 'logo', to: 'logo-studio' }]);
    const moved = r.project.tracks.find((t) => t.name === STUDIO_EDITS_TRACK_NAME)!;
    expect(moved.kind).toBe('text');
    expect(moved.clips.map((c) => [c.id, c.origin])).toEqual([
      ['titulo-b', 'editor'],
      ['logo-studio', 'editor'],
    ]);
  });
});

describe('buildProjectDir (caju build)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'caju-build-')), 'demo');
    await mkdir(dir);
  });
  afterEach(async () => {
    await rm(path.dirname(dir), { recursive: true, force: true });
  });

  const read = async () => ProjectSchema.parse(JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8')));
  const now = new Date('2031-01-01T00:00:00Z');

  it('cria, preserva edições do Studio ao regenerar, recusa conflitos sem --force', async () => {
    const r1 = await buildProjectDir(dir, { definition: template('Olá'), now });
    expect(r1.status).toBe('created');
    expect(existsSync(path.join(dir, LAST_BUILD_FILE))).toBe(true);
    const p1 = await read();
    expect(wasEditedInStudio(p1.meta)).toBe(false);

    // mesmo código de novo: nada muda
    expect((await buildProjectDir(dir, { definition: template('Olá'), now })).status).toBe('unchanged');

    // Studio adiciona um clipe e salva
    await writeFile(path.join(dir, 'project.json'), JSON.stringify(studioEdit(p1)));
    const r2 = await buildProjectDir(dir, { definition: template('Novo título', 250), now: new Date('2032-01-01T00:00:00Z') });
    expect(r2.status).toBe('updated');
    expect(r2.backup && existsSync(r2.backup)).toBe(true);
    const p2 = await read();
    expect(clipById(p2, 'logo-studio')?.origin).toBe('editor');
    expect(clipById(p2, 'titulo')?.props.text).toBe('Novo título');
    expect(clipById(p2, 'contador')?.props.to).toBe(250);
    expect(wasEditedInStudio(p2.meta)).toBe(true);

    // Studio mexe num clipe de código → conflito, nada gravado
    const touched = structuredClone(p2);
    touched.tracks.flatMap((t) => t.clips).find((c) => c.id === 'titulo')!.transform.x = 100;
    await writeFile(path.join(dir, 'project.json'), JSON.stringify(touched));
    const r3 = await buildProjectDir(dir, { definition: template('Outro'), now });
    expect(r3.status).toBe('conflict');
    expect(r3.conflicts[0]?.changes).toEqual([{ path: 'transform.x', before: 540, after: 100 }]);
    expect(clipById(await read(), 'titulo')?.props.text).toBe('Novo título');

    const r4 = await buildProjectDir(dir, { definition: template('Outro'), now, force: true });
    expect(r4.status).toBe('updated');
    const p4 = await read();
    expect(clipById(p4, 'titulo')).toMatchObject({ props: { text: 'Outro' }, transform: { x: 540 } });
    expect(clipById(p4, 'logo-studio')).toBeTruthy();
  });

  it('id do video.ts precisa ser o nome da pasta', async () => {
    const def = defineProject({ id: 'outro', format: 'reel-9x16', duration: 30 }, () => undefined);
    await expect(buildProjectDir(dir, { definition: def })).rejects.toThrow(/nome da pasta/);
  });

  it('carrega video.ts com tsx (TypeScript, sem build)', async () => {
    await writeFile(
      path.join(dir, 'video.ts'),
      `const meta: { id: string; format: 'square-1x1'; duration: number } = { id: 'demo', format: 'square-1x1', duration: 30 };
export default { __caju: 'project', meta, build(p: any) { p.scene('a', 'A', 0, 30, (s: any) => s.text('ts!', { size: 50 }, { x: 1, y: 2 })); } };
`,
    );
    const def = await loadProjectDefinition(path.join(dir, 'video.ts'));
    expect(def.meta.id).toBe('demo');
    const r = await buildProjectDir(dir);
    expect(r.status).toBe('created');
    expect(allClips(await read()).map((c) => c.props.text)).toContain('ts!');
    expect((await readdir(path.join(dir, '.caju'))).includes('last-build.json')).toBe(true);
  });
});

describe('determinismo', () => {
  it('aponta APIs não determinísticas, ignora comentários e caju-lint-allow', () => {
    const src = ['const a = Math.random();', '// Date.now()', 'const b = Date.now(); // caju-lint-allow: teste', 'setTimeout(f, 1);'].join('\n');
    expect(lintDeterminismSource(src, 'x.tsx').map((p) => p.line)).toEqual([1, 4]);
  });
});

describe('movimento, efeitos e mixagem por código', () => {
  it('transições, animações, loop, efeitos, sobreposição, ajuste e settings.audio', async () => {
    const p = await buildProject(
      defineProject(
        { id: 'fx', format: 'square-1x1', duration: 60, audio: { ducking: { enabled: true }, loudness: { targetLufs: -16 } } },
        (b) => {
          b.asset({ id: 'vo1', kind: 'audio', src: 'assets/vo.wav' });
          b.audioClip('vo1', 0, 30, 'Locução');
          b.scene('a', 'A', 0, 60, (s) => {
            s.text('oi', { size: 40 }, {
              x: 0,
              y: 0,
              transitionIn: { type: 'wipe', dur: 12, params: { direction: 'up' } },
              animOut: { type: 'slide', dur: 10, easing: 'expoOut', params: { direction: 'right' } },
              loop: { type: 'float', dur: 40, amplitude: 2 },
              effects: [{ type: 'dropShadow' }],
            });
            s.adjust([{ type: 'grayscale', params: { amount: 0.5 } }], { at: [10, 30] });
            s.overlay('vignette', { amount: 0.4 });
          });
        },
      ),
    );
    const clips = p.tracks.flatMap((t) => t.clips);
    const text = clips.find((c) => c.type === 'text')!;
    expect(text.transitionIn).toMatchObject({ type: 'wipe', duration: 12, params: { direction: 'up' } });
    expect(text.animationOut).toEqual({ preset: 'slide', duration: 10, params: { direction: 'right', easing: 'expoOut' } });
    expect(text.animationLoop).toEqual({ preset: 'float', duration: 40, params: { amplitude: 2 } });
    expect(text.effects).toEqual([{ id: `${text.id}-fx1`, type: 'dropShadow', enabled: true, params: {} }]);
    expect(clips.find((c) => c.type === 'adjustment')).toMatchObject({ start: 10, duration: 20, effects: [{ type: 'grayscale', params: { amount: 0.5 } }] });
    expect(clips.find((c) => c.type === 'effect')?.props).toEqual({ amount: 0.4, effect: 'vignette' });
    expect(p.settings.audio).toMatchObject({ ducking: { enabled: true, ratio: 6 }, loudness: { enabled: true, targetLufs: -16 } });
    expect(p.tracks.find((t) => t.id === 'locucao')?.role).toBe('voice');
  });
});
