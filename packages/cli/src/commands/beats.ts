import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeBeats } from '@caju-motion/media';
import { assertProjectId } from '@caju-motion/server';

/**
 * `caju beats <música> [--project id]`: BPM e batidas (segundos) para cortar no tempo. Com
 * --project, grava em `assets/data/<nome>.beats.json` do projeto; senão, ao lado do arquivo.
 */
export async function beatsCommand(o: { dir: string; file: string | undefined; project?: string; out?: string; json: boolean }): Promise<number> {
  if (!o.file) throw new Error('uso: caju beats <musica.mp3> [--project id] [--out arquivo.beats.json] [--json]');
  let projectDir: string | null = null;
  if (o.project) {
    assertProjectId(o.project);
    projectDir = path.resolve(o.dir, o.project);
    if (!existsSync(projectDir)) throw new Error(`projeto "${o.project}" não encontrado em ${path.resolve(o.dir)}`);
  }
  // relativo à pasta atual; se não existir e houver projeto, relativo ao projeto
  const file = existsSync(path.resolve(o.file)) || !projectDir ? path.resolve(o.file) : path.resolve(projectDir, o.file);
  if (!existsSync(file)) throw new Error(`arquivo não encontrado: ${o.file}`);
  const name = path.basename(file, path.extname(file));
  const out = path.resolve(o.out ?? (projectDir ? path.join(projectDir, 'assets', 'data', `${name}.beats.json`) : path.join(path.dirname(file), `${name}.beats.json`)));

  const r = await analyzeBeats(file);
  const source = projectDir ? path.relative(projectDir, file).split(path.sep).join('/') : path.basename(file);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ version: 1, source, ...r }, null, 2) + '\n');
  if (o.json) {
    console.log(JSON.stringify({ file: out, ...r }));
    return 0;
  }
  if (!r.beats.length) {
    console.log(`! ${source}: nenhum pulso encontrado (música sem batida marcada, ou silêncio). Corte por frases/marcadores.`);
    return 0;
  }
  console.log(`✓ ${source}: ${r.bpm} BPM, ${r.beats.length} batidas, ${r.downbeats.length} compassos (confiança ${r.confidence})`);
  console.log(`  ${out}`);
  if (r.confidence < 0.3) console.log('  ! pulso pouco nítido: confira ouvindo antes de cortar tudo nestas batidas');
  console.log(`  primeiras batidas (s): ${r.beats.slice(0, 8).join(', ')}${r.beats.length > 8 ? '…' : ''}`);
  return 0;
}
