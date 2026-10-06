import path from 'node:path';
import { renderMedia, renderStill, type RenderProgress } from '@caju-motion/renderer-node';
import { formatBytes } from '@caju-motion/schema';
import { stat } from 'node:fs/promises';
import { componentsDirFor, studioExtensions } from '../extensions';

type RenderOpts = {
  dir: string;
  id: string;
  out?: string;
  format?: string;
  resolution?: string;
  fps?: string;
  quality?: string;
  audio: boolean;
  concurrency?: string;
  serveUrl?: string;
  components?: string;
};

function progressPrinter() {
  const tty = process.stdout.isTTY;
  let last = -1;
  return (p: RenderProgress) => {
    if (p.stage !== 'rendering') return;
    const pct = Math.floor((p.frame / p.total) * 100);
    if (!tty && pct < last + 10 && p.frame !== p.total) return;
    last = pct;
    const eta = p.etaSec !== null ? ` · faltam ~${Math.ceil(p.etaSec)} s` : '';
    const line = `  quadro ${p.frame}/${p.total} (${pct}%) · ${p.speed.toFixed(1)} q/s${eta}`;
    if (tty) process.stdout.write(`\r${line.padEnd(70)}`);
    else console.log(line);
  };
}

/** `caju render <id>`: exporta para vídeo/GIF/PNG. */
export async function renderCommand(o: RenderOpts): Promise<number> {
  const projectsDir = path.resolve(o.dir);
  const settings: Record<string, unknown> = { audio: o.audio };
  if (o.format) settings.format = o.format;
  if (o.resolution) settings.resolution = Number(o.resolution);
  if (o.fps) settings.fps = Number(o.fps);
  if (o.quality) settings.quality = o.quality;

  const controller = new AbortController();
  const onSig = () => controller.abort();
  process.once('SIGINT', onSig);
  try {
    const extensions = o.serveUrl
      ? []
      : await studioExtensions({ projectsDir, componentsDir: componentsDirFor(projectsDir, o.components) });
    console.log(`  renderizando "${o.id}"…`);
    const r = await renderMedia({
      projectsDir,
      projectId: o.id,
      settings,
      ...(o.out ? { output: path.resolve(o.out) } : {}),
      ...(o.concurrency ? { concurrency: Number(o.concurrency) } : {}),
      ...(o.serveUrl ? { serveUrl: o.serveUrl } : {}),
      extensions,
      signal: controller.signal,
      onProgress: progressPrinter(),
    });
    if (process.stdout.isTTY) process.stdout.write('\n');
    const size = await stat(r.output).then((s) => (s.isFile() ? ` · ${formatBytes(s.size)}` : ''), () => '');
    console.log(
      `  ✓ ${r.output}\n    ${r.settings.format} · ${r.width}×${r.height} · ${r.settings.fps} fps · ${r.frames} quadros · ${r.durationSec.toFixed(2)} s` +
        `${r.hasAudio ? ' · com áudio' : ' · sem áudio'}${size} · ${(r.elapsedMs / 1000).toFixed(1)} s de render`,
    );
    return 0;
  } finally {
    process.off('SIGINT', onSig);
  }
}

/** `caju still <id> --frame n`: um quadro como PNG. */
export async function stillCommand(o: {
  dir: string;
  id: string;
  frame: string;
  out?: string;
  resolution?: string;
  serveUrl?: string;
  components?: string;
}): Promise<number> {
  const projectsDir = path.resolve(o.dir);
  const frame = Number(o.frame);
  if (!Number.isInteger(frame) || frame < 0) {
    console.error(`quadro inválido: ${o.frame}`);
    return 1;
  }
  const output = path.resolve(o.out ?? `${o.id}-${frame}.png`);
  const extensions = o.serveUrl
    ? []
    : await studioExtensions({ projectsDir, componentsDir: componentsDirFor(projectsDir, o.components) });
  const r = await renderStill({
    projectsDir,
    projectId: o.id,
    frame,
    output,
    type: output.toLowerCase().endsWith('.jpg') || output.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png',
    ...(o.resolution ? { resolution: Number(o.resolution) } : {}),
    ...(o.serveUrl ? { serveUrl: o.serveUrl } : {}),
    extensions,
  });
  console.log(`  ✓ ${output} (quadro ${r.frame}, ${r.width}×${r.height})`);
  return 0;
}
