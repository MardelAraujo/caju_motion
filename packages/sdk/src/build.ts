import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ProjectSchema, type Project } from '@caju-motion/schema';
import { buildProject, findVideoFile, loadProjectDefinition, type ProjectDefinition } from './define';
import { deepEqual, mergeBuild, type MergeResult } from './merge';

/**
 * `caju build` para uma pasta de projeto: roda o `video.ts`, mescla com o `project.json`
 * (edições do Studio) e grava. O último resultado gerado fica em `.caju/last-build.json`:
 * é com ele que o merge sabe se um clipe de código foi mexido no Studio.
 */

export const LAST_BUILD_FILE = path.join('.caju', 'last-build.json');

export type BuildOptions = {
  /** Grava mesmo com conflitos (o código vence; o project.json anterior vai para o histórico). */
  force?: boolean;
  /** Só calcula, não grava. */
  dryRun?: boolean;
  now?: Date;
  /** Definição já carregada (testes); padrão: o `video.ts` da pasta. */
  definition?: ProjectDefinition;
};

export type BuildReport = MergeResult & {
  id: string;
  file: string | null;
  /** `created`: não havia project.json; `conflict`: nada gravado (use `force`). */
  status: 'created' | 'updated' | 'unchanged' | 'conflict' | 'dry-run';
  /** Avisos (ex.: sem último build registrado). */
  warnings: string[];
  /** Cópia do project.json anterior (histórico), quando gravou por cima. */
  backup?: string;
};

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

const withoutMeta = (p: Project) => ({ ...p, meta: {} });

export async function buildProjectDir(projectDir: string, opts: BuildOptions = {}): Promise<BuildReport> {
  const dir = path.resolve(projectDir);
  const id = path.basename(dir);
  const file = opts.definition ? null : findVideoFile(dir);
  if (!opts.definition && !file) throw new Error(`"${id}" não tem video.ts (defineProject)`);
  const def = opts.definition ?? (await loadProjectDefinition(file!));
  if (def.meta.id !== id) {
    throw new Error(`o video.ts de "${id}" declara id "${def.meta.id}" — o id precisa ser o nome da pasta`);
  }

  const generated = await buildProject(def);
  const warnings: string[] = [];
  const projectFile = path.join(dir, 'project.json');
  const lastFile = path.join(dir, LAST_BUILD_FILE);

  let existing: Project | null = null;
  if (existsSync(projectFile)) {
    const parsed = ProjectSchema.safeParse(await readJson(projectFile));
    if (!parsed.success) {
      if (!opts.force) throw new Error(`project.json de "${id}" é inválido — corrija ou use --force para regenerar do zero`);
      warnings.push('project.json inválido: regenerado do zero (cópia no histórico)');
    } else existing = parsed.data;
  }

  let last: Project | null = null;
  if (existsSync(lastFile)) {
    const parsed = ProjectSchema.safeParse(await readJson(lastFile).catch(() => null));
    if (parsed.success) last = parsed.data;
    else warnings.push(`${LAST_BUILD_FILE} ilegível: edições em clipes de código não puderam ser detectadas`);
  } else if (existing && existing.tracks.some((t) => t.clips.some((c) => c.origin === 'code'))) {
    warnings.push(
      `sem ${LAST_BUILD_FILE} (primeiro caju build deste projeto): edições do Studio em clipes de código não podem ser detectadas e serão substituídas`,
    );
  }

  const merge = mergeBuild(existing, generated, last);
  const report: BuildReport = { ...merge, id, file, status: 'created', warnings };

  if (merge.conflicts.length && !opts.force) return { ...report, status: 'conflict' };
  if (opts.dryRun) return { ...report, status: 'dry-run' };

  const now = (opts.now ?? new Date()).toISOString();
  const project = merge.project;
  // createdAt === updatedAt significa "sem edições do Studio" (ver guardOverwrite)
  const hasStudioWork = merge.editorClips.length > 0;
  project.meta = {
    ...project.meta,
    generator: generated.meta.generator,
    createdAt: hasStudioWork ? (existing?.meta.createdAt ?? now) : now,
    updatedAt: now,
  };

  if (existing && last && deepEqual(withoutMeta(existing), withoutMeta(project))) {
    await writeAtomic(lastFile, generated);
    return { ...report, status: 'unchanged' };
  }

  if (existsSync(projectFile)) {
    const historyDir = path.join(dir, '.caju', 'history');
    await mkdir(historyDir, { recursive: true });
    report.backup = path.join(historyDir, `${now.replace(/[:.]/g, '-')}-build.json`);
    await writeFile(report.backup, await readFile(projectFile, 'utf8'), 'utf8');
  }
  await writeAtomic(projectFile, project);
  await writeAtomic(lastFile, generated);
  return { ...report, project, status: existing ? 'updated' : 'created' };
}
