import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildProjectDir, findVideoFile, formatConflicts, type BuildReport } from '@caju-motion/sdk';

type Opts = { dir: string; ids: string[]; force: boolean; dryRun: boolean };

/** Projetos com `video.ts` (defineProject) numa pasta. */
async function codeProjects(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && findVideoFile(path.join(dir, e.name)))
    .map((e) => e.name)
    .sort();
}

function summary(r: BuildReport): string {
  const parts: string[] = [];
  if (r.editorClips.length) parts.push(`${r.editorClips.length} clipe(s) do Studio preservado(s)`);
  if (r.adopted.length) parts.push(`${r.adopted.length} clipe(s) derivado(s) de código no Studio agora são do editor`);
  if (r.moved.length) parts.push(`${r.moved.length} movido(s) para "Edições do Studio"`);
  if (r.renamed.length) parts.push(`renomeado(s): ${r.renamed.map((x) => `${x.from} → ${x.to}`).join(', ')}`);
  return parts.length ? ` — ${parts.join('; ')}` : '';
}

const VERBS: Record<Exclude<BuildReport['status'], 'conflict'>, string> = {
  created: 'criado',
  updated: 'atualizado',
  unchanged: 'sem mudanças',
  'dry-run': 'ok (simulação, nada gravado)',
};

/** `caju build`: roda o video.ts de cada projeto e mescla com as edições do Studio. */
export async function buildCommand({ dir, ids, force, dryRun }: Opts): Promise<number> {
  const root = path.resolve(dir);
  const targets = ids.length ? ids : await codeProjects(root);
  if (targets.length === 0) {
    console.log(`nenhum projeto com video.ts em ${root}`);
    return ids.length ? 1 : 0;
  }

  let failures = 0;
  for (const id of targets) {
    try {
      const r = await buildProjectDir(path.join(root, id), { force, dryRun });
      for (const w of r.warnings) console.log(`  ! ${id}: ${w}`);
      if (r.status === 'conflict') {
        failures++;
        console.log(`✗ ${id}: clipes de código foram editados no Studio desde o último build:\n${formatConflicts(r.conflicts)}`);
        console.log(
          '    Leve a mudança para o video.ts e rode de novo, ou use --force para regenerar mesmo assim\n' +
            '    (o código vence; o project.json atual vai para .caju/history/).',
        );
        continue;
      }
      if (r.conflicts.length) {
        console.log(`  ! ${id}: --force: ${r.conflicts.length} edição(ões) do Studio em clipes de código substituída(s)`);
      }
      console.log(`✓ ${id}: ${VERBS[r.status]}${summary(r)}`);
    } catch (err) {
      failures++;
      console.log(`✗ ${id}: ${(err as Error).message}`);
    }
  }
  return failures === 0 ? 0 : 1;
}
