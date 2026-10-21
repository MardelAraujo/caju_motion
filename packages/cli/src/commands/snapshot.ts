import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegOk } from '@caju-motion/media';
import { renderStills } from '@caju-motion/renderer-node';
import { projectDuration, type Project } from '@caju-motion/schema';
import { createProjectStore } from '@caju-motion/server';
import { componentsDirFor, studioExtensions } from '../extensions';

/**
 * `caju snapshot <id>`: contact sheet dos quadros-chave (e, com --at-cuts, de cada corte), para
 * o agente (ou a pessoa) revisar o vídeo antes do render. Uma sessão do navegador para tudo.
 */

export type SnapshotFrame = { frame: number; reason: string };

/**
 * Quadros do contact sheet (no máximo `max`). Sem `frames`: início, fim, o meio de cada cena marcada, o meio de
 * cada clipe da trilha principal e, se sobrar espaço, quadros espaçados por igual. Com `atCuts`:
 * um pouco antes e um pouco depois dos cortes onde mais coisa muda ao mesmo tempo.
 */
export function snapshotFrames(
  project: Project,
  { atCuts = false, frames, max = 24 }: { atCuts?: boolean; frames?: number[]; max?: number } = {},
): SnapshotFrame[] {
  const total = projectDuration(project);
  const last = Math.max(0, total - 1);
  const fps = project.settings.fps;
  const out = new Map<number, string>();
  const add = (f: number, reason: string) => {
    const frame = Math.min(last, Math.max(0, Math.round(f)));
    if (!out.has(frame)) out.set(frame, reason);
  };
  const visual = project.tracks.filter((t) => t.kind !== 'audio' && !t.hidden);

  if (frames?.length) {
    for (const f of frames) add(f, 'pedido');
  } else {
    // nos cortes sobra pelo menos metade das vagas
    const budget = atCuts ? Math.max(4, Math.floor(max / 2)) : max;
    add(0, 'início');
    add(last, 'fim');
    // marcadores costumam abrir cenas (tudo ainda entrando): mostra o MEIO da cena, até o próximo marcador
    const marks = [...project.markers].sort((x, y) => x.frame - y.frame);
    marks.forEach((m, i) => {
      const next = marks[i + 1]?.frame ?? total;
      if (out.size < budget) add((m.frame + next) / 2, `meio de ${m.label || m.id}`);
    });
    for (const c of visual.filter((t) => t.kind === 'main').flatMap((t) => t.clips)) {
      if (out.size < budget && !c.hidden) add(c.start + c.duration / 2, `meio de ${c.name ?? c.id}`);
    }
    const fill = budget - out.size;
    for (let i = 1; i <= fill; i++) add((last * i) / (fill + 1), 'amostra');
  }

  if (atCuts) {
    // peso de um corte = quantos clipes começam ou terminam ali (mudança de cena > um detalhe entrando)
    const weight = new Map<number, number>();
    for (const t of visual) {
      for (const c of t.clips) {
        if (c.hidden || c.type === 'adjustment') continue;
        for (const f of [c.start, c.start + c.duration]) if (f > 0 && f < total) weight.set(f, (weight.get(f) ?? 0) + 1);
      }
    }
    const before = Math.max(1, Math.round(fps * 0.1));
    const after = Math.max(1, Math.round(fps * 0.2));
    const slots = Math.max(1, Math.floor((max - out.size) / 2));
    const cuts = [...weight.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, slots)
      .map(([f]) => f)
      .sort((a, b) => a - b);
    for (const cut of cuts) {
      add(cut - before, `corte ${(cut / fps).toFixed(2)} s −${before}`);
      add(cut + after, `corte ${(cut / fps).toFixed(2)} s +${after}`);
    }
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([frame, reason]) => ({ frame, reason }));
}

type SnapshotOpts = {
  dir: string;
  id: string | undefined;
  frames?: string;
  atCuts: boolean;
  max?: string;
  cols?: string;
  resolution?: string;
  out?: string;
  json: boolean;
  serveUrl?: string;
  components?: string;
};

export async function snapshotCommand(o: SnapshotOpts): Promise<number> {
  if (!o.id) throw new Error('uso: caju snapshot <id> [--frames 0,45,90] [--at-cuts] [--max 24] [--cols 4] [--resolution 540] [--out arquivo.png] [--json]');
  const projectsDir = path.resolve(o.dir);
  const store = createProjectStore(projectsDir);
  const project = await store.read(o.id);
  const frames = o.frames
    ?.split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => {
      const n = Number(f);
      if (!Number.isInteger(n) || n < 0) throw new Error(`--frames: quadro inválido "${f}"`);
      return n;
    });
  const max = Math.max(2, Math.min(64, Number(o.max ?? 24) || 24));
  const picks = snapshotFrames(project, { atCuts: o.atCuts, frames, max });
  const cols = Math.max(1, Math.min(8, Number(o.cols ?? 4) || 4));
  const resolution = Number(o.resolution ?? 540) || 540;
  const output = path.resolve(o.out ?? path.join(projectsDir, o.id, 'boards', 'snapshot.png'));

  const extensions = o.serveUrl ? [] : await studioExtensions({ projectsDir, componentsDir: componentsDirFor(projectsDir, o.components) });
  const stills = await renderStills({
    projectsDir,
    projectId: o.id,
    frames: picks.map((p) => p.frame),
    resolution,
    ...(o.serveUrl ? { serveUrl: o.serveUrl } : {}),
    extensions,
  });

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'caju-snapshot-'));
  try {
    await Promise.all(stills.map((s, i) => writeFile(path.join(tmp, `${String(i).padStart(3, '0')}.jpg`), s.data)));
    const rows = Math.ceil(stills.length / cols);
    const { width, height } = project.settings;
    // cada quadro na resolução pedida (lado menor), grade com respiro escuro entre os tiles
    const scale = width <= height ? `scale=${resolution}:-2` : `scale=-2:${resolution}`;
    await mkdir(path.dirname(output), { recursive: true });
    await runFfmpegOk([
      '-y',
      '-framerate', '1',
      '-i', path.join(tmp, '%03d.jpg'),
      '-vf', `${scale},tile=${cols}x${rows}:padding=12:margin=12:color=0x3A3631`,
      '-frames:v', '1',
      output,
    ]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  const fps = project.settings.fps;
  const tiles = picks.map((p, i) => ({ tile: i + 1, row: Math.floor(i / cols) + 1, col: (i % cols) + 1, frame: p.frame, timeSec: +(p.frame / fps).toFixed(3), reason: p.reason }));
  const mapFile = output.replace(/\.[^.]+$/, '.json');
  await writeFile(mapFile, JSON.stringify({ project: o.id, image: path.basename(output), cols, tiles }, null, 2) + '\n');
  if (o.json) {
    console.log(JSON.stringify({ image: output, map: mapFile, cols, tiles }));
    return 0;
  }
  console.log(`✓ ${output} (${tiles.length} quadro(s), ${cols} por linha)`);
  for (const t of tiles) console.log(`  ${String(t.tile).padStart(2)}. quadro ${t.frame} (${t.timeSec.toFixed(2)} s) — ${t.reason}`);
  return 0;
}
