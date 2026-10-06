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
