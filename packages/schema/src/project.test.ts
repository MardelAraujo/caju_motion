import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  createEmptyProject,
  formatTimecode,
  migrateProject,
  ProjectFormatError,
  projectDuration,
  safeParseProject,
  secondsToFrames,
  type Migration,
} from './index';

function baseDoc() {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'Teste',
    settings: { width: 1080, height: 1920, fps: 30 },
    assets: [{ id: 'img', kind: 'image', src: 'assets/a.png' }],
    tracks: [
      {
        id: 'main',
        kind: 'main',
        clips: [
          { id: 'c1', type: 'image', assetId: 'img', start: 0, duration: 30 },
          { id: 'c2', type: 'text', start: 30, duration: 60, props: { text: 'Olá' } },
        ],
      },
    ],
  } as Record<string, any>;
}

function errorOf(doc: unknown): string {
  const r = safeParseProject(doc);
  expect(r.success).toBe(false);
  return r.success ? '' : r.error;
}

describe('ProjectSchema', () => {
  it('aceita um doc mínimo e aplica defaults', () => {
    const r = safeParseProject(baseDoc());
    expect(r.success).toBe(true);
    if (!r.success) return;
    const clip = r.project.tracks[0]!.clips[0]!;
    expect(clip.transform).toEqual({
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      anchorX: 0.5,
      anchorY: 0.5,
      flipX: false,
      flipY: false,
    });
    expect(clip.opacity).toBe(1);
    expect(clip.origin).toBe('editor');
    expect(r.project.settings.format).toBe('custom');
  });

  it('rejeita clipes sobrepostos na mesma trilha', () => {
    const doc = baseDoc();
    doc.tracks[0].clips[1].start = 10;
    expect(errorOf(doc)).toMatch(/se sobrepõem/);
  });

  it('rejeita ids duplicados', () => {
    const doc = baseDoc();
    doc.tracks[0].clips[1].id = 'c1';
    expect(errorOf(doc)).toMatch(/id duplicado: "c1"/);
  });

  it('exige asset existente e do tipo certo', () => {
    const doc = baseDoc();
    doc.tracks[0].clips[0].assetId = 'nao-existe';
    expect(errorOf(doc)).toMatch(/asset "nao-existe" não existe/);

    const doc2 = baseDoc();
    doc2.tracks[0].clips[0].type = 'video';
    expect(errorOf(doc2)).toMatch(/asset "img" é "image"/);
  });

  it('áudio só em trilha de áudio (e vice-versa)', () => {
    const doc = baseDoc();
    doc.assets.push({ id: 'snd', kind: 'audio', src: 'assets/a.wav' });
    doc.tracks[0].clips.push({ id: 'a1', type: 'audio', assetId: 'snd', start: 100, duration: 10 });
    expect(errorOf(doc)).toMatch(/precisa estar numa trilha de áudio/);

    const doc2 = baseDoc();
    doc2.tracks.push({ id: 'aud', kind: 'audio', clips: [{ id: 't', type: 'text', start: 0, duration: 5 }] });
    expect(errorOf(doc2)).toMatch(/só aceita clipes de áudio/);
  });

  it('keyframes precisam estar dentro do clipe', () => {
    const doc = baseDoc();
    doc.tracks[0].clips[1].keyframes = { opacity: [{ frame: 0, value: 0 }, { frame: 60, value: 1 }] };
    expect(errorOf(doc)).toMatch(/fora do clipe "c2"/);
  });

  it('projectDuration usa o fim do último clipe ou settings.duration', () => {
    const r = safeParseProject(baseDoc());
    if (!r.success) throw new Error(r.error);
    expect(projectDuration(r.project)).toBe(90);
    expect(projectDuration({ ...r.project, settings: { ...r.project.settings, duration: 300 } })).toBe(300);
  });

  it('createEmptyProject gera um doc válido', () => {
    const p = createEmptyProject({ id: 'novo', format: 'landscape-16x9' });
    const r = safeParseProject(JSON.parse(JSON.stringify(p)));
    expect(r.success).toBe(true);
    expect(p.settings.width).toBe(1920);
  });
});

describe('migrações', () => {
  it('recusa versão mais nova que a suportada', () => {
    expect(() => migrateProject({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(ProjectFormatError);
  });

  it('recusa doc sem schemaVersion', () => {
    expect(errorOf({ id: 'x' })).toMatch(/schemaVersion/);
  });

  it('aplica a cadeia de migrações em ordem', () => {
    // simula um futuro v1 -> v2 -> v3 usando um registro próprio
    const chain: Record<number, Migration> = {
      1: (d) => ({ ...d, passos: ['1→2'] }),
      2: (d) => ({ ...d, passos: [...(d.passos as string[]), '2→3'] }),
    };
    const out = migrateProject({ schemaVersion: 1 }, chain, 3);
    expect(out).toEqual({ schemaVersion: 3, passos: ['1→2', '2→3'] });
    expect(migrateProject({ schemaVersion: 2, passos: [] }, chain, 3).passos).toEqual(['2→3']);
  });

  it('falha se faltar um elo da cadeia', () => {
    expect(() => migrateProject({ schemaVersion: 1 }, {}, 2)).toThrow(/sem migração de schema v1 para v2/);
  });
});

describe('tempo', () => {
  it('converte e formata', () => {
    expect(secondsToFrames(2.5, 30)).toBe(75);
    expect(formatTimecode(30 * 61 + 5, 30)).toBe('00:01:01:05');
  });
});
